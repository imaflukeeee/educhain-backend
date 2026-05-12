import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppRole, ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

/**
 * RolesGuard ใช้ตรวจสอบสิทธิ์ตาม Role ของผู้ใช้งาน
 *
 * ตัวอย่างการใช้งาน:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('ISSUER')
 *
 * หมายเหตุ:
 * Guard นี้ต้องใช้ร่วมกับ JwtAuthGuard เสมอ
 * เพราะ RolesGuard จะอ่าน role จาก request.user
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    /**
     * อ่านข้อมูล Role ที่กำหนดไว้จาก @Roles(...)
     * เช่น @Roles('ISSUER') หรือ @Roles('HOLDER')
     */
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    /**
     * ถ้า API ไหนไม่ได้กำหนด @Roles(...)
     * แปลว่าไม่ต้องตรวจสอบ Role
     */
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    /**
     * ดึง request ที่ผ่าน JwtAuthGuard มาแล้ว
     * โดย request.user จะมีข้อมูลจาก JWT Payload
     */
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const userRole = request.user?.role;

    if (!userRole) {
      throw new ForbiddenException('ไม่พบสิทธิ์ของผู้ใช้งาน');
    }

    /**
     * ตรวจสอบว่า role ของ user อยู่ในรายการ role ที่ API อนุญาตหรือไม่
     */
    const isAllowed = requiredRoles.includes(userRole);

    if (!isAllowed) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ใช้งาน');
    }

    return true;
  }
}
