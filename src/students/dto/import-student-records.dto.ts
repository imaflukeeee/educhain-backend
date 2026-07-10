import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateStudentRecordDto } from './create-student-record.dto';

export class ImportStudentRecordsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudentRecordDto)
  rows!: CreateStudentRecordDto[];
}
