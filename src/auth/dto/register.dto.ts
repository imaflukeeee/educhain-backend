/* eslint-disable @typescript-eslint/no-unsafe-call */

import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';

export const REGISTER_ROLES = ['ISSUER', 'HOLDER'] as const;
export type RegisterRole = (typeof REGISTER_ROLES)[number];

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'รหัสผ่านต้องมีตัวอักษรพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข อย่างน้อย 8 ตัวอักษร',
  })
  password!: string;

  @IsString()
  name!: string;

  @IsIn(REGISTER_ROLES)
  role!: RegisterRole;

  @IsOptional()
  @IsString()
  walletAddress?: string;

  @ValidateIf((o) => o.role === 'HOLDER')
  @IsNotEmpty()
  @IsString()
  firstNameTh?: string;

  @ValidateIf((o) => o.role === 'HOLDER')
  @IsNotEmpty()
  @IsString()
  lastNameTh?: string;

  @IsOptional()
  @IsString()
  firstNameEn?: string;

  @IsOptional()
  @IsString()
  lastNameEn?: string;

  @IsNotEmpty()
  @IsString()
  phone?: string;

  @ValidateIf((o) => o.role === 'HOLDER')
  @IsNotEmpty()
  @IsDateString()
  birthDate?: string;

  @ValidateIf((o) => o.role === 'HOLDER')
  @IsNotEmpty()
  @IsString()
  studentId?: string;

  @ValidateIf((o) => o.role === 'HOLDER')
  @IsNotEmpty()
  @IsString()
  faculty?: string;

  @ValidateIf((o) => o.role === 'HOLDER')
  @IsNotEmpty()
  @IsString()
  major?: string;

  @IsNotEmpty()
  @IsString()
  universityNameTh?: string;

  @IsNotEmpty()
  @IsString()
  universityNameEn?: string;

  @ValidateIf((o) => o.role === 'ISSUER')
  @IsNotEmpty()
  @IsString()
  contactFirstNameTh?: string;

  @ValidateIf((o) => o.role === 'ISSUER')
  @IsNotEmpty()
  @IsString()
  contactLastNameTh?: string;

  @IsOptional()
  @IsString()
  contactFirstNameEn?: string;

  @IsOptional()
  @IsString()
  contactLastNameEn?: string;

  @ValidateIf((o) => o.role === 'ISSUER')
  @IsNotEmpty()
  @IsString()
  staffPosition?: string;

  @ValidateIf((o) => o.role === 'ISSUER')
  @IsNotEmpty()
  @IsString()
  staffDepartment?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsUrl({ require_protocol: true })
  website?: string;

  @IsNotEmpty()
  @IsString()
  address?: string;
}
