import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

/**
 * AuthModule ดูแลระบบสมัครสมาชิก, เข้าสู่ระบบ, JWT และ Role Guard
 */
@Module({
  imports: [
    /**
     * ต้อง import UsersModule
     * เพราะ AuthService ต้องใช้ UsersService
     */
    UsersModule,

    /**
     * ตั้งค่า JWT สำหรับสร้างและตรวจสอบ Token
     */
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '7d',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService, JwtAuthGuard, RolesGuard],
  /**
   * Export Guard และ JwtModule
   * เพื่อให้ Module อื่น เช่น CredentialsModule สามารถใช้ @UseGuards ได้
   */
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
