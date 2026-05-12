import 'dotenv/config';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * PrismaPg คือ Driver Adapter สำหรับ Prisma v7 + PostgreSQL
 * เราใช้เชื่อมต่อกับ Supabase PostgreSQL
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,

  /**
   * Supabase ต้องใช้ SSL ในการเชื่อมต่อ Database
   * rejectUnauthorized: false ช่วยลดปัญหา SSL certificate ตอนพัฒนา Local
   */
  ssl: {
    rejectUnauthorized: false,
  },
});

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    /**
     * Prisma v7 ต้องส่ง adapter เข้า PrismaClient
     */
    super({ adapter });
  }

  /**
   * เรียกเมื่อ NestJS Module เริ่มทำงาน
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * เรียกเมื่อ NestJS ปิดระบบ
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
