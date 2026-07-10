import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export const DOCUMENT_REQUEST_TYPES = [
  'STUDENT_STATUS_CERTIFICATE',
  'TRANSCRIPT',
  'DEGREE_CERTIFICATE',
  'GRADUATION_CERTIFICATE',
  'STUDENT_CARD',
  'OTHER',
] as const;

export class CreateDocumentRequestDto {
  @IsIn(DOCUMENT_REQUEST_TYPES)
  type!: (typeof DOCUMENT_REQUEST_TYPES)[number];

  @ValidateIf((value: CreateDocumentRequestDto) => value.type === 'OTHER')
  @IsString()
  @MaxLength(150)
  customTypeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
