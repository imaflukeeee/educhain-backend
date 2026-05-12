import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import type { JwtPayload } from '../types/jwt-payload.type';

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
     * เพื่อไม่ให้ ESLint มองเป็น any
     */
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

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

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    try {
      /**
       * ตรวจสอบ token และแปลง payload ให้เป็น type JwtPayload
       */
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwtSecret,
      });

      /**
       * แนบ payload เข้า request.user
       * เพื่อให้ Controller หรือ Guard ตัวอื่นเอาไปใช้ต่อ
       */
      request.user = payload;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
