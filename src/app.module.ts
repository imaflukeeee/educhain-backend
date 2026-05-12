import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

/**
 * AppModule คือ Module หลักของ Backend
 */
@Module({
  imports: [
    /**
     * โหลด .env ให้ใช้ได้ทั้งระบบ
     */
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
