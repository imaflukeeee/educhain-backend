import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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
   * ใช้สำหรับ Login แล้วรับ JWT Token
   */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * GET /auth/me
   * ใช้เช็คว่า Token ปัจจุบันเป็นของใคร
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: Request & { user: { sub: string } }) {
    return this.authService.me(request.user.sub);
  }
}
