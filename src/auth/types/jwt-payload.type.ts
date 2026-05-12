import type { AppRole } from '../decorators/roles.decorator';

/**
 * รูปแบบข้อมูลที่เราเก็บไว้ใน JWT Token
 * sub = user id
 */
export type JwtPayload = {
  sub: string;
  email: string;
  role: AppRole;
};
