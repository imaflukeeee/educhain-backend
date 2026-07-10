import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class CreateFacultyDto {
  @IsString() @IsNotEmpty() nameTh!: string;
  @IsOptional() @IsString() nameEn?: string;
}
