import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * รูปแบบข้อมูลที่เราเก็บไว้ใน JWT Token
 * sub = user id
 */
type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

/**
 * เพิ่ม property user เข้าไปใน Express Request
 * เพราะหลังจาก verify token สำเร็จ เราจะเอา payload ไปเก็บไว้ที่ request.user
 */
type AuthenticatedRequest = Request & {
  user?: JwtPayload;
};

/**
 * JwtAuthGuard ใช้ป้องกัน API ที่ต้อง Login ก่อน
 * Client ต้องส่ง Header:
 * Authorization: Bearer <token>
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    /**
     * กำหนด type ให้ request ชัดเจน
     * เพื่อไม่ให้ TypeScript / ESLint มองเป็น any
     */
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    /**
     * ใช้ request.header() แทน request.headers.authorization
     * เพราะจะได้ type เป็น string | undefined ชัดเจน
     */
    const authHeader = request.header('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token');
    }

    /**
     * ตัดคำว่า Bearer ออก เพื่อเอาเฉพาะ token
     */
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    /**
     * JWT_SECRET ต้องมีใน .env
     * ถ้าไม่มีให้ error ทันที เพื่อป้องกันการ verify token แบบ secret ว่าง
     */
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    try {
      /**
       * ตรวจสอบ token ว่าถูกต้องและยังไม่หมดอายุ
       * พร้อมกำหนด type ของ payload เป็น JwtPayload
       */
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwtSecret,
      });

      /**
       * แนบข้อมูล user จาก token เข้า request
       * เพื่อให้ Controller เอาไปใช้งานต่อได้
       */
      request.user = payload;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
