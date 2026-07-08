/* eslint-disable @typescript-eslint/no-unsafe-call */

import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export const STAFF_PERMISSION_VALUES = [
  'CREATE_CREDENTIAL',
  'REGISTER_CREDENTIAL',
  'VIEW_ALL_CREDENTIALS',
  'INVALIDATE_CREDENTIAL',
] as const;

export type StaffPermission = (typeof STAFF_PERMISSION_VALUES)[number];

export class CreateStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstNameTh!: string;

  @IsString()
  lastNameTh!: string;

  @IsOptional()
  @IsString()
  firstNameEn?: string;

  @IsOptional()
  @IsString()
  lastNameEn?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  staffPosition?: string;

  @IsOptional()
  @IsString()
  staffDepartment?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(STAFF_PERMISSION_VALUES, { each: true })
  permissions?: StaffPermission[];
}
