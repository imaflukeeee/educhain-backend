import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DOCUMENT_REQUEST_TYPES } from './create-document-request.dto';

export class CreateTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsIn(DOCUMENT_REQUEST_TYPES)
  documentType!: (typeof DOCUMENT_REQUEST_TYPES)[number];

  @IsOptional()
  @IsString()
  customTypeName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(1)
  content!: string;
}
