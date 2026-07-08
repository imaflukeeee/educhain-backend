/* eslint-disable @typescript-eslint/no-unsafe-call */

import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { STAFF_PERMISSION_VALUES, type StaffPermission } from './create-staff.dto';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  firstNameTh?: string;

  @IsOptional()
  @IsString()
  lastNameTh?: string;

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}
