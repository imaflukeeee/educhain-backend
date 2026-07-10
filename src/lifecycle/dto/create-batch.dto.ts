import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DOCUMENT_REQUEST_TYPES } from './create-document-request.dto';

export class CreateBatchDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsIn(DOCUMENT_REQUEST_TYPES)
  documentType!: (typeof DOCUMENT_REQUEST_TYPES)[number];

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsString()
  facultyId?: string;

  @IsOptional()
  @IsString()
  majorId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
