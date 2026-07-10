import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';

/**
 * AuthModule ดูแลระบบสมัครสมาชิก เข้าสู่ระบบ และยืนยันอีเมล
 * ส่วน JWT/Guards ใช้จาก SecurityModule กลาง
 */
@Module({
  imports: [UsersModule, PrismaModule, SecurityModule],
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService],
  exports: [AuthService],
})
export class AuthModule {}
