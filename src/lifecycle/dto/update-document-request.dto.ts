import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const REQUEST_STATUSES = [
  'RECEIVED',
  'IN_PROGRESS',
  'NEED_MORE_INFORMATION',
  'REJECTED',
  'COMPLETED',
] as const;

export class UpdateDocumentRequestDto {
  @IsIn(REQUEST_STATUSES)
  status!: (typeof REQUEST_STATUSES)[number];

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
