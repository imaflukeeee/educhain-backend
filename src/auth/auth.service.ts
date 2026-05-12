import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

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
      throw new ConflictException('Email already exists');
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
      message: 'Register successfully',
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
      throw new UnauthorizedException('Invalid email or password');
    }

    /**
     * เทียบ password ที่ผู้ใช้กรอกกับ password hash ใน Database
     */
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.generateToken(user);

    return {
      message: 'Login successfully',
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
}
