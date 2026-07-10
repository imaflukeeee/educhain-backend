import { IsDateString, IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CreateStudentRecordDto {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsIn(['MR', 'MISS', 'MRS'])
  namePrefix?: 'MR' | 'MISS' | 'MRS';

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

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsString()
  @Length(13, 13)
  nationalId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  facultyId?: string;

  @IsOptional()
  @IsString()
  majorId?: string;
}
