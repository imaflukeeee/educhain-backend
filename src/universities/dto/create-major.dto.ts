import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class CreateMajorDto {
  @IsString() @IsNotEmpty() facultyId!: string;
  @IsString() @IsNotEmpty() nameTh!: string;
  @IsOptional() @IsString() nameEn?: string;
}
