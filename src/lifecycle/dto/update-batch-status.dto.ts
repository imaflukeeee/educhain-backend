import { IsIn, IsOptional, IsString } from 'class-validator';

const BATCH_STATUSES = [
  'PREPARING',
  'PENDING_REVIEW',
  'PENDING_APPROVAL',
  'PROCESSING',
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'FAILED',
] as const;

export class UpdateBatchStatusDto {
  @IsIn(BATCH_STATUSES)
  status!: (typeof BATCH_STATUSES)[number];

  @IsOptional()
  @IsString()
  note?: string;
}
