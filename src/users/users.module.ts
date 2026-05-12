import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersService } from './users.service';

/**
 * UsersModule ดูแลการจัดการข้อมูล User
 * เช่น ค้นหา user, สร้าง user, ดึง profile
 */
@Module({
  imports: [PrismaModule],
  providers: [UsersService],

  /**
   * ต้อง export UsersService
   * เพื่อให้ Module อื่น เช่น AuthModule เรียกใช้งานได้
   */
  exports: [UsersService],
})
export class UsersModule {}
