import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const REQUEST_STATUSES = [
  'RECEIVED',
  'IN_PROGRESS',
  'NEED_MORE_INFORMATION',
  'REJECTED',
  'COMPLETED',
] as const;

const REQUEST_TYPES = [
  'STUDENT_STATUS_CERTIFICATE',
  'TRANSCRIPT',
  'DEGREE_CERTIFICATE',
  'GRADUATION_CERTIFICATE',
  'STUDENT_CARD',
  'OTHER',
] as const;

export class UpdateDocumentRequestDto {
  @IsOptional()
  @IsIn(REQUEST_STATUSES)
  status?: (typeof REQUEST_STATUSES)[number];

  @IsOptional()
  @IsIn(REQUEST_TYPES)
  type?: (typeof REQUEST_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  customTypeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  staffNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}
