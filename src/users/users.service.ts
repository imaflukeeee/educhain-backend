import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Type สำหรับ User ที่ใช้ตอน Login
 * ต้องมี password เพราะต้องเอาไปเทียบกับ bcrypt
 */
type UserWithPassword = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    password: true;
    name: true;
    role: true;
    walletAddress: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

/**
 * Type สำหรับ User ที่ส่งกลับไปให้ Client
 * ไม่มี password เพื่อความปลอดภัย
 */
type SafeUser = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    name: true;
    role: true;
    walletAddress: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

@Injectable()
export class UsersService {
  /**
   * กำหนด db เป็น PrismaClient ชัดเจน
   * เพื่อให้ TypeScript / ESLint รู้จัก property เช่น db.user
   */
  private readonly db: PrismaClient;

  constructor(private readonly prisma: PrismaService) {
    /**
     * PrismaService extends มาจาก PrismaClient อยู่แล้ว
     * การ cast นี้ช่วยให้ ESLint เห็น type ของ PrismaClient ชัดเจนขึ้น
     */
    this.db = this.prisma as PrismaClient;
  }

  /**
   * หา User จาก email
   * ใช้ใน Register เพื่อตรวจ email ซ้ำ
   * ใช้ใน Login เพื่อเอา password hash มาเทียบ
   */
  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const user = await this.db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        walletAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * หา User จาก id
   * ใช้กับ /auth/me
   * ไม่ส่ง password กลับไปเด็ดขาด
   */
  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        walletAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * สร้าง User ใหม่
   * password ที่รับเข้ามาต้องเป็น hash แล้วเท่านั้น
   */
  async createUser(data: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    walletAddress?: string;
  }): Promise<SafeUser> {
    const user = await this.db.user.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        walletAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }
  /**
   * อัปเดต Wallet Address ของผู้ใช้งาน
   */
  async updateWalletAddress(params: { userId: string; walletAddress: string }) {
    return this.prisma.user.update({
      where: {
        id: params.userId,
      },
      data: {
        walletAddress: params.walletAddress,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        walletAddress: true,
        updatedAt: true,
      },
    });
  }
}
