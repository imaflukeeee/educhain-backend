import { SetMetadata } from '@nestjs/common';

/**
 * Key สำหรับเก็บ metadata ของ role ที่ Controller ต้องการ
 * เช่น @Roles('ISSUER')
 */
export const ROLES_KEY = 'roles';

/**
 * Role หลักของระบบตอนนี้
 * Verifier ไม่อยู่ในนี้ เพราะ Verifier ไม่ต้อง Login
 */
export type AppRole = 'ISSUER' | 'HOLDER';

/**
 * Decorator สำหรับกำหนดว่า API นี้ให้ role ไหนเข้าได้
 *
 * ตัวอย่าง:
 * @Roles('ISSUER')
 * @Roles('HOLDER')
 * @Roles('ISSUER', 'HOLDER')
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
