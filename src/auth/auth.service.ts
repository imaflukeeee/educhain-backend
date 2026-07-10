import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ethers } from 'ethers';
import { createHash, randomBytes } from 'crypto';
import {
  DEFAULT_STAFF_PERMISSIONS,
  STAFF_PERMISSIONS,
  UsersService,
  type SafeUser,
} from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { EmailVerificationService } from './email-verification.service';

function normalizeRequiredString(value?: string) {
  return value?.trim() || '';
}

function normalizeNullableString(value?: string) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableDate(value?: string) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return new Date(`${trimmed}T00:00:00.000Z`);
}

function compactName(...parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' ');
}

function getDisplayNameFromUser(user: Pick<SafeUser, 'name' | 'firstNameTh' | 'lastNameTh' | 'firstNameEn' | 'lastNameEn'>) {
  return (
    compactName(user.firstNameTh, user.lastNameTh) ||
    compactName(user.firstNameEn, user.lastNameEn) ||
    user.name
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('อีเมลนี้ถูกใช้งานแล้ว');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const isIssuer = dto.role === 'ISSUER';

    const fallbackName = isIssuer
      ? normalizeRequiredString(dto.universityNameTh) ||
        normalizeRequiredString(dto.universityNameEn) ||
        normalizeRequiredString(dto.name)
      : compactName(dto.firstNameTh, dto.lastNameTh) ||
        compactName(dto.firstNameEn, dto.lastNameEn) ||
        normalizeRequiredString(dto.name);

    const user = await this.usersService.createUser({
      email: dto.email.trim().toLowerCase(),
      password: passwordHash,
      name: fallbackName,
      role: dto.role,
      walletAddress: normalizeNullableString(dto.walletAddress),
      firstNameTh: normalizeNullableString(dto.firstNameTh),
      lastNameTh: normalizeNullableString(dto.lastNameTh),
      firstNameEn: normalizeNullableString(dto.firstNameEn),
      lastNameEn: normalizeNullableString(dto.lastNameEn),
      phone: normalizeNullableString(dto.phone),
      birthDate: normalizeNullableDate(dto.birthDate),
      studentId: normalizeNullableString(dto.studentId),
      faculty: normalizeNullableString(dto.faculty),
      major: normalizeNullableString(dto.major),
      universityNameTh: normalizeNullableString(dto.universityNameTh),
      universityNameEn: normalizeNullableString(dto.universityNameEn),
      contactFirstNameTh: normalizeNullableString(dto.contactFirstNameTh),
      contactLastNameTh: normalizeNullableString(dto.contactLastNameTh),
      contactFirstNameEn: normalizeNullableString(dto.contactFirstNameEn),
      contactLastNameEn: normalizeNullableString(dto.contactLastNameEn),
      staffPosition: normalizeNullableString(dto.staffPosition),
      staffDepartment: normalizeNullableString(dto.staffDepartment),
      website: normalizeNullableString(dto.website),
      address: normalizeNullableString(dto.address),
      issuerAccountType: isIssuer ? 'UNIVERSITY_ADMIN' : null,
      permissions: isIssuer
        ? [
            STAFF_PERMISSIONS.MANAGE_STAFF,
            STAFF_PERMISSIONS.CREATE_CREDENTIAL,
            STAFF_PERMISSIONS.REGISTER_CREDENTIAL,
            STAFF_PERMISSIONS.VIEW_ALL_CREDENTIALS,
            STAFF_PERMISSIONS.INVALIDATE_CREDENTIAL,
          ]
        : [],
      isActive: true,
    });

    const rawVerificationToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawVerificationToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.usersService.setEmailVerification({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const frontendUrl = (process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const verificationUrl = `${frontendUrl}/verify-email?token=${rawVerificationToken}`;

    await this.emailVerificationService.sendVerificationEmail({
      email: user.email,
      displayName: user.name,
      verificationUrl,
    });

    return {
      message: 'ลงทะเบียนสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี',
      email: user.email,
      requiresEmailVerification: true,
      ...(process.env.EMAIL_DEV_RETURN_LINK === 'true' ? { verificationUrl } : {}),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลบัญชี');
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const accessToken = await this.generateToken(user);
    const { password, ...safeUser } = user;
    void password;

    return {
      message: 'เข้าสู่ระบบสำเร็จ',
      user: safeUser,
      accessToken,
    };
  }


  async verifyEmail(rawToken: string) {
    if (!rawToken?.trim()) {
      throw new BadRequestException('ไม่พบรหัสยืนยันอีเมล');
    }

    const tokenHash = createHash('sha256').update(rawToken.trim()).digest('hex');
    const user = await this.usersService.findByEmailVerificationTokenHash(tokenHash);

    if (!user || !user.emailVerificationExpiresAt) {
      throw new BadRequestException('ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือถูกใช้งานแล้ว');
    }

    if (new Date(user.emailVerificationExpiresAt).getTime() < Date.now()) {
      throw new BadRequestException('ลิงก์ยืนยันอีเมลหมดอายุแล้ว กรุณาขอลิงก์ใหม่');
    }

    await this.usersService.markEmailVerified(user.id);

    return { message: 'ยืนยันอีเมลสำเร็จ คุณสามารถเข้าสู่ระบบได้แล้ว' };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return { message: 'หากอีเมลนี้มีอยู่ในระบบ ระบบจะส่งลิงก์ยืนยันให้ใหม่' };
    }

    if (user.emailVerifiedAt) {
      return { message: 'อีเมลนี้ได้รับการยืนยันแล้ว' };
    }

    const rawVerificationToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawVerificationToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.usersService.setEmailVerification({ userId: user.id, tokenHash, expiresAt });

    const frontendUrl = (process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const verificationUrl = `${frontendUrl}/verify-email?token=${rawVerificationToken}`;

    await this.emailVerificationService.sendVerificationEmail({
      email: user.email,
      displayName: user.name,
      verificationUrl,
    });

    return {
      message: 'ส่งลิงก์ยืนยันอีเมลใหม่แล้ว',
      ...(process.env.EMAIL_DEV_RETURN_LINK === 'true' ? { verificationUrl } : {}),
    };
  }

  async me(userId: string) {
    return this.usersService.findById(userId);
  }

  private async generateToken(user: {
    id: string;
    email: string;
    role: string;
  }): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private async getUniversityAdminOrThrow(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('ไม่พบบัญชีผู้ใช้งาน');
    }

    if (user.role !== 'ISSUER' || user.issuerAccountType === 'REGISTRAR_STAFF') {
      throw new ForbiddenException('เฉพาะบัญชีหลักของมหาวิทยาลัยเท่านั้นที่จัดการเจ้าหน้าที่ได้');
    }

    if (user.isActive === false) {
      throw new ForbiddenException('บัญชีนี้ถูกปิดการใช้งาน');
    }

    return user;
  }

  async listStaffMembers(adminUserId: string) {
    const admin = await this.getUniversityAdminOrThrow(adminUserId);
    const staffMembers = await this.usersService.listStaffMembers(admin.id);

    return {
      message: 'ดึงรายชื่อเจ้าหน้าที่สำเร็จ',
      staffMembers,
    };
  }

  async createStaffMember(params: { adminUserId: string; dto: CreateStaffDto }) {
    const admin = await this.getUniversityAdminOrThrow(params.adminUserId);
    const dto = params.dto;
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('อีเมลนี้ถูกใช้งานแล้ว');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const name =
      compactName(dto.firstNameTh, dto.lastNameTh) ||
      compactName(dto.firstNameEn, dto.lastNameEn) ||
      dto.email.trim().toLowerCase();

    const staff = await this.usersService.createUser({
      email: dto.email.trim().toLowerCase(),
      password: passwordHash,
      name,
      role: 'ISSUER',
      issuerAccountType: 'REGISTRAR_STAFF',
      universityOwnerId: admin.id,
      universityNameTh: admin.universityNameTh ?? admin.name,
      universityNameEn: admin.universityNameEn ?? null,
      firstNameTh: normalizeNullableString(dto.firstNameTh),
      lastNameTh: normalizeNullableString(dto.lastNameTh),
      firstNameEn: normalizeNullableString(dto.firstNameEn),
      lastNameEn: normalizeNullableString(dto.lastNameEn),
      phone: normalizeNullableString(dto.phone),
      staffPosition: normalizeNullableString(dto.staffPosition) ?? 'เจ้าหน้าที่ทะเบียน',
      staffDepartment: normalizeNullableString(dto.staffDepartment) ?? 'งานทะเบียน',
      permissions: dto.permissions?.length
        ? dto.permissions
        : DEFAULT_STAFF_PERMISSIONS,
      isActive: true,
    });

    return {
      message: 'เพิ่มบัญชีเจ้าหน้าที่สำเร็จ',
      staff,
    };
  }

  async updateStaffMember(params: {
    adminUserId: string;
    staffId: string;
    dto: UpdateStaffDto;
  }) {
    const admin = await this.getUniversityAdminOrThrow(params.adminUserId);
    const staff = await this.usersService.findStaffMember({
      universityOwnerId: admin.id,
      staffId: params.staffId,
    });

    if (!staff) {
      throw new NotFoundException('ไม่พบเจ้าหน้าที่ในมหาวิทยาลัยนี้');
    }

    const dto = params.dto;
    const firstNameTh = normalizeNullableString(dto.firstNameTh);
    const lastNameTh = normalizeNullableString(dto.lastNameTh);
    const firstNameEn = normalizeNullableString(dto.firstNameEn);
    const lastNameEn = normalizeNullableString(dto.lastNameEn);

    const nextName =
      compactName(firstNameTh ?? staff.firstNameTh, lastNameTh ?? staff.lastNameTh) ||
      compactName(firstNameEn ?? staff.firstNameEn, lastNameEn ?? staff.lastNameEn) ||
      staff.name;

    const updatedStaff = await this.usersService.updateStaffMember({
      staffId: staff.id,
      universityOwnerId: admin.id,
      data: {
        name: nextName,
        firstNameTh,
        lastNameTh,
        firstNameEn,
        lastNameEn,
        phone: normalizeNullableString(dto.phone),
        staffPosition: normalizeNullableString(dto.staffPosition),
        staffDepartment: normalizeNullableString(dto.staffDepartment),
        permissions: dto.permissions,
        isActive: dto.isActive,
      },
    });

    if (dto.newPassword) {
      await this.usersService.updatePassword({
        userId: staff.id,
        passwordHash: await bcrypt.hash(dto.newPassword, 10),
      });
    }

    return {
      message: 'บันทึกข้อมูลเจ้าหน้าที่สำเร็จ',
      staff: updatedStaff,
    };
  }

  async updateMyProfile(params: { userId: string; dto: UpdateProfileDto }) {
    const dto = params.dto;
    const currentUser = await this.usersService.findById(params.userId);

    if (!currentUser) {
      throw new UnauthorizedException('ไม่พบบัญชีผู้ใช้งาน');
    }

    const isStaff = currentUser.issuerAccountType === 'REGISTRAR_STAFF';
    const isIssuer = currentUser.role === 'ISSUER';
    const nextName = isIssuer && !isStaff
      ? normalizeRequiredString(dto.universityNameTh) ||
        normalizeRequiredString(dto.universityNameEn) ||
        normalizeRequiredString(dto.name) ||
        currentUser.name
      : compactName(dto.firstNameTh, dto.lastNameTh) ||
        compactName(dto.firstNameEn, dto.lastNameEn) ||
        normalizeRequiredString(dto.name) ||
        currentUser.name;

    const profileData = isStaff
      ? {
          phone: normalizeNullableString(dto.phone),
        }
      : currentUser.role === 'HOLDER'
        ? {
            name: nextName,
            firstNameTh: normalizeNullableString(dto.firstNameTh),
            lastNameTh: normalizeNullableString(dto.lastNameTh),
            firstNameEn: normalizeNullableString(dto.firstNameEn),
            lastNameEn: normalizeNullableString(dto.lastNameEn),
            phone: normalizeNullableString(dto.phone),
          }
        : {
            phone: normalizeNullableString(dto.phone),
            website: normalizeNullableString(dto.website),
            address: normalizeNullableString(dto.address),
          };

    const user = await this.usersService.updateProfile({
      userId: params.userId,
      data: profileData,
    });

    return {
      message: 'บันทึกข้อมูลบัญชีสำเร็จ',
      user,
    };
  }

  async changeMyPassword(params: { userId: string; dto: ChangePasswordDto }) {
    const user = await this.usersService.findById(params.userId);
    const userWithPassword = user
      ? await this.usersService.findByEmail(user.email)
      : null;

    if (!userWithPassword) {
      throw new UnauthorizedException('ไม่พบบัญชีผู้ใช้งาน');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      params.dto.currentPassword,
      userWithPassword.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }

    await this.usersService.updatePassword({
      userId: params.userId,
      passwordHash: await bcrypt.hash(params.dto.newPassword, 10),
    });

    return {
      message: 'เปลี่ยนรหัสผ่านสำเร็จ',
    };
  }

  async updateMyWalletAddress(params: {
    userId: string;
    walletAddress: string;
  }) {
    if (!ethers.isAddress(params.walletAddress)) {
      throw new BadRequestException('รูปแบบบัญชีดิจิทัลไม่ถูกต้อง');
    }

    const normalizedWalletAddress = ethers.getAddress(params.walletAddress);

    if (normalizedWalletAddress === ethers.ZeroAddress) {
      throw new BadRequestException('ไม่สามารถใช้บัญชีดิจิทัลนี้ได้');
    }

    const user = await this.usersService.updateWalletAddress({
      userId: params.userId,
      walletAddress: normalizedWalletAddress,
    });

    return {
      message: 'บันทึกบัญชีดิจิทัลสำเร็จ',
      user,
    };
  }
}
