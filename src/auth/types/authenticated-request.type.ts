import type { Request } from 'express';
import type { JwtPayload } from './jwt-payload.type';

/**
 * Request ที่ผ่าน JwtAuthGuard แล้ว
 * จะมี request.user เป็นข้อมูลจาก JWT Payload
 */
export type AuthenticatedRequest = Request & {
  user?: JwtPayload;
};
