import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ethers } from 'ethers';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register สำหรับ Issuer / Holder
   */
  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('อีเมลนี้ถูกใช้งานแล้ว');
    }

    /**
     * Hash password ก่อนเก็บลง Database
     * ห้ามเก็บ plain password เด็ดขาด
     */
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.createUser({
      email: dto.email,
      password: passwordHash,
      name: dto.name,
      role: dto.role,
      walletAddress: dto.walletAddress,
    });

    const accessToken = await this.generateToken(user);

    return {
      message: 'สมัครสมาชิกสำเร็จ',
      user,
      accessToken,
    };
  }

  /**
   * Login ด้วย email/password
   */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    /**
     * เทียบ password ที่ผู้ใช้กรอกกับ password hash ใน Database
     */
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const accessToken = await this.generateToken(user);

    return {
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
      },
      accessToken,
    };
  }

  /**
   * ดึงข้อมูลตัวเองจาก user id ใน JWT
   */
  async me(userId: string) {
    return this.usersService.findById(userId);
  }

  /**
   * สร้าง JWT Token
   */
  private async generateToken(user: {
    id: string;
    email: string;
    role: string;
  }): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload);
  }
  /**
   * อัปเดต Wallet Address ของผู้ใช้งานปัจจุบัน
   */
  async updateMyWalletAddress(params: {
    userId: string;
    walletAddress: string;
  }) {
    if (!ethers.isAddress(params.walletAddress)) {
      throw new BadRequestException('Wallet Address ไม่ถูกต้อง');
    }

    const normalizedWalletAddress = ethers.getAddress(params.walletAddress);

    if (normalizedWalletAddress === ethers.ZeroAddress) {
      throw new BadRequestException('ไม่สามารถใช้ Zero Address ได้');
    }

    const user = await this.usersService.updateWalletAddress({
      userId: params.userId,
      walletAddress: normalizedWalletAddress,
    });

    return {
      message: 'อัปเดต Wallet Address สำเร็จ',
      user,
    };
  }
}
