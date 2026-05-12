/* eslint-disable @typescript-eslint/no-unsafe-call */

import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * Role ที่อนุญาตให้สมัครผ่าน API ได้
 * Verifier ไม่อยู่ในนี้ เพราะ Verifier ไม่ต้อง Login
 */
export const REGISTER_ROLES = ['ISSUER', 'HOLDER'] as const;

/**
 * Type ของ role ที่รับจาก Register API
 */
export type RegisterRole = (typeof REGISTER_ROLES)[number];

export class RegisterDto {
  /**
   * Email สำหรับ Login
   */
  @IsEmail()
  email!: string;

  /**
   * Password ขั้นต่ำ 8 ตัวอักษร
   * ตอนเก็บจริงจะถูก hash ด้วย bcrypt ก่อนลง Database
   */
  @IsString()
  @MinLength(8)
  password!: string;

  /**
   * ชื่อผู้ใช้งาน
   * ถ้าเป็น Issuer เป็นชื่อมหาวิทยาลัย
   * ถ้าเป็น Holder เป็นชื่อนักศึกษา
   */
  @IsString()
  name!: string;

  /**
   * Role ในระบบ
   * อนุญาตเฉพาะ Issuer หรือ Holder เท่านั้น
   */
  @IsIn(REGISTER_ROLES)
  role!: RegisterRole;

  /**
   * Wallet Address
   */
  @IsOptional()
  @IsString()
  walletAddress?: string;
}
