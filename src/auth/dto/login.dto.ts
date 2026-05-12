/* eslint-disable @typescript-eslint/no-unsafe-call */

import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  /**
   * Email ที่ใช้ Login
   */
  @IsEmail()
  email!: string;

  /**
   * Password ที่ผู้ใช้กรอก
   * ระบบจะเอาไปเทียบกับ password hash ใน Database
   */
  @IsString()
  @MinLength(8)
  password!: string;
}
