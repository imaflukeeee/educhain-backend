import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * SecurityModule เป็นจุดกลางสำหรับ JWT และ Guards
 * ทุก Module ที่ใช้ @UseGuards(JwtAuthGuard, RolesGuard) ต้อง import Module นี้
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error('JWT_SECRET is not configured');
        }

        return {
          secret,
          signOptions: {
            expiresIn: '7d',
          },
        };
      },
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class SecurityModule {}
