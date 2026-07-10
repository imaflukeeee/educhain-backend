import { Injectable } from '@nestjs/common';
import { PrismaClient, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const STAFF_PERMISSIONS = {
  MANAGE_STAFF: 'MANAGE_STAFF',
  CREATE_CREDENTIAL: 'CREATE_CREDENTIAL',
  REGISTER_CREDENTIAL: 'REGISTER_CREDENTIAL',
  VIEW_ALL_CREDENTIALS: 'VIEW_ALL_CREDENTIALS',
  INVALIDATE_CREDENTIAL: 'INVALIDATE_CREDENTIAL',
} as const;

export const DEFAULT_STAFF_PERMISSIONS = [
  STAFF_PERMISSIONS.CREATE_CREDENTIAL,
  STAFF_PERMISSIONS.REGISTER_CREDENTIAL,
];

const safeUniversityOwnerSelect = {
  id: true,
  email: true,
  name: true,
  universityNameTh: true,
  universityNameEn: true,
};

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  walletAddress: true,
  firstNameTh: true,
  lastNameTh: true,
  firstNameEn: true,
  lastNameEn: true,
  phone: true,
  birthDate: true,
  studentId: true,
  faculty: true,
  major: true,
  universityNameTh: true,
  universityNameEn: true,
  contactFirstNameTh: true,
  contactLastNameTh: true,
  contactFirstNameEn: true,
  contactLastNameEn: true,
  staffPosition: true,
  staffDepartment: true,
  website: true,
  address: true,
  issuerAccountType: true,
  universityOwnerId: true,
  universityOwner: {
    select: safeUniversityOwnerSelect,
  },
  permissions: true,
  isActive: true,
  emailVerifiedAt: true,
  emailVerificationTokenHash: true,
  emailVerificationExpiresAt: true,
  createdAt: true,
  updatedAt: true,
};

const userWithPasswordSelect = {
  ...safeUserSelect,
  password: true,
};

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletAddress: string | null;
  firstNameTh?: string | null;
  lastNameTh?: string | null;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  phone?: string | null;
  birthDate?: Date | string | null;
  studentId?: string | null;
  faculty?: string | null;
  major?: string | null;
  universityNameTh?: string | null;
  universityNameEn?: string | null;
  contactFirstNameTh?: string | null;
  contactLastNameTh?: string | null;
  contactFirstNameEn?: string | null;
  contactLastNameEn?: string | null;
  staffPosition?: string | null;
  staffDepartment?: string | null;
  website?: string | null;
  address?: string | null;
  issuerAccountType?: 'UNIVERSITY_ADMIN' | 'REGISTRAR_STAFF' | null;
  universityOwnerId?: string | null;
  universityOwner?: {
    id: string;
    email: string;
    name: string;
    universityNameTh?: string | null;
    universityNameEn?: string | null;
  } | null;
  permissions?: string[];
  isActive?: boolean;
  emailVerifiedAt?: Date | null;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpiresAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserWithPassword extends SafeUser {
  password: string;
}

export type CreateUserData = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  walletAddress?: string | null;
  firstNameTh?: string | null;
  lastNameTh?: string | null;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  phone?: string | null;
  birthDate?: Date | string | null;
  studentId?: string | null;
  faculty?: string | null;
  major?: string | null;
  universityNameTh?: string | null;
  universityNameEn?: string | null;
  contactFirstNameTh?: string | null;
  contactLastNameTh?: string | null;
  contactFirstNameEn?: string | null;
  contactLastNameEn?: string | null;
  staffPosition?: string | null;
  staffDepartment?: string | null;
  website?: string | null;
  address?: string | null;
  issuerAccountType?: 'UNIVERSITY_ADMIN' | 'REGISTRAR_STAFF' | null;
  universityOwnerId?: string | null;
  permissions?: string[];
  isActive?: boolean;
  emailVerifiedAt?: Date | null;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpiresAt?: Date | null;
};

@Injectable()
export class UsersService {
  private readonly db: PrismaClient;

  constructor(private readonly prisma: PrismaService) {
    this.db = this.prisma as PrismaClient;
  }

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const user = await this.db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: userWithPasswordSelect as never,
    });

    return user as UserWithPassword | null;
  }

  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.db.user.findUnique({
      where: { id },
      select: safeUserSelect as never,
    });

    return user as SafeUser | null;
  }

  async createUser(data: CreateUserData): Promise<SafeUser> {
    const user = await this.db.user.create({
      data: data as never,
      select: safeUserSelect as never,
    });

    return user as SafeUser;
  }

  async setEmailVerification(params: { userId: string; tokenHash: string; expiresAt: Date }) {
    await this.db.user.update({
      where: { id: params.userId },
      data: {
        emailVerificationTokenHash: params.tokenHash,
        emailVerificationExpiresAt: params.expiresAt,
        emailVerifiedAt: null,
      } as never,
    });
  }

  async findByEmailVerificationTokenHash(tokenHash: string): Promise<UserWithPassword | null> {
    const user = await this.db.user.findUnique({
      where: { emailVerificationTokenHash: tokenHash } as never,
      select: userWithPasswordSelect as never,
    });
    return user as UserWithPassword | null;
  }

  async markEmailVerified(userId: string): Promise<SafeUser> {
    const user = await this.db.user.update({
      where: { id: userId },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      } as never,
      select: safeUserSelect as never,
    });
    return user as SafeUser;
  }

  async findHolderByStudentId(studentId: string): Promise<SafeUser | null> {
    const user = await this.db.user.findFirst({
      where: {
        role: 'HOLDER',
        studentId: studentId.trim(),
        isActive: true,
      } as never,
      select: safeUserSelect as never,
    });

    return user as SafeUser | null;
  }

  async updateProfile(params: {
    userId: string;
    data: Partial<Omit<CreateUserData, 'email' | 'password' | 'role'>>;
  }): Promise<SafeUser> {
    const user = await this.db.user.update({
      where: { id: params.userId },
      data: params.data as never,
      select: safeUserSelect as never,
    });

    return user as SafeUser;
  }

  async updatePassword(params: { userId: string; passwordHash: string }) {
    await this.db.user.update({
      where: { id: params.userId },
      data: { password: params.passwordHash },
    });
  }

  async updateWalletAddress(params: { userId: string; walletAddress: string }) {
    const user = await this.db.user.update({
      where: { id: params.userId },
      data: { walletAddress: params.walletAddress },
      select: safeUserSelect as never,
    });

    return user as SafeUser;
  }

  async listStaffMembers(universityOwnerId: string): Promise<SafeUser[]> {
    const users = await this.db.user.findMany({
      where: {
        role: 'ISSUER',
        issuerAccountType: 'REGISTRAR_STAFF',
        universityOwnerId,
      } as never,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }] as never,
      select: safeUserSelect as never,
    });

    return users as SafeUser[];
  }

  async findStaffMember(params: {
    universityOwnerId: string;
    staffId: string;
  }): Promise<SafeUser | null> {
    const user = await this.db.user.findFirst({
      where: {
        id: params.staffId,
        role: 'ISSUER',
        issuerAccountType: 'REGISTRAR_STAFF',
        universityOwnerId: params.universityOwnerId,
      } as never,
      select: safeUserSelect as never,
    });

    return user as SafeUser | null;
  }

  async updateStaffMember(params: {
    staffId: string;
    universityOwnerId: string;
    data: Partial<CreateUserData>;
  }): Promise<SafeUser> {
    const user = await this.db.user.update({
      where: { id: params.staffId },
      data: params.data as never,
      select: safeUserSelect as never,
    });

    return user as SafeUser;
  }
}
