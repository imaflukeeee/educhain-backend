import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule ทำหน้าที่ export PrismaService
 * เพื่อให้ Module อื่น ๆ เช่น Auth, Users เรียกใช้งาน Database ได้
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
