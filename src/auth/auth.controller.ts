import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Roles } from './decorators/roles.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import type { AuthenticatedRequest } from './types/authenticated-request.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * ใช้สำหรับสมัครสมาชิก Issuer หรือ Holder
   */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * ใช้สำหรับเข้าสู่ระบบและรับ JWT Token
   */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * GET /auth/me
   * ใช้ตรวจสอบว่า Token ปัจจุบันเป็นของผู้ใช้งานคนไหน
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งานจาก Token');
    }

    return this.authService.me(user.sub);
  }

  /**
   * GET /auth/issuer-only
   * Endpoint สำหรับทดสอบสิทธิ์ Issuer
   *
   * ในอนาคต logic แบบนี้จะใช้กับ API ออกเอกสาร VC
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ISSUER')
  @Get('issuer-only')
  issuerOnly(@Req() request: AuthenticatedRequest) {
    return {
      message: 'อนุญาตให้เข้าถึงสำหรับ Issuer',
      user: request.user,
    };
  }

  /**
   * GET /auth/holder-only
   * Endpoint สำหรับทดสอบสิทธิ์ Holder
   *
   * ในอนาคต logic แบบนี้จะใช้กับ API สร้าง VP Link
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOLDER')
  @Get('holder-only')
  holderOnly(@Req() request: AuthenticatedRequest) {
    return {
      message: 'อนุญาตให้เข้าถึงสำหรับ Holder',
      user: request.user,
    };
  }
}
