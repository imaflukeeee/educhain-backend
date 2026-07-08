/* eslint-disable @typescript-eslint/no-unsafe-call */

import { IsDateString, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

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
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  faculty?: string;

  @IsOptional()
  @IsString()
  major?: string;

  @IsOptional()
  @IsString()
  universityNameTh?: string;

  @IsOptional()
  @IsString()
  universityNameEn?: string;

  @IsOptional()
  @IsString()
  contactFirstNameTh?: string;

  @IsOptional()
  @IsString()
  contactLastNameTh?: string;

  @IsOptional()
  @IsString()
  contactFirstNameEn?: string;

  @IsOptional()
  @IsString()
  contactLastNameEn?: string;

  @IsOptional()
  @IsString()
  staffPosition?: string;

  @IsOptional()
  @IsString()
  staffDepartment?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsUrl({ require_protocol: true })
  website?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
