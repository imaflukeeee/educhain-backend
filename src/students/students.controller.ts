import { Body, Controller, Get, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateStudentRecordDto } from './dto/create-student-record.dto';
import { ImportStudentRecordsDto } from './dto/import-student-records.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ISSUER')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  private userId(request: AuthenticatedRequest) {
    if (!request.user) throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    return request.user.sub;
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('claimStatus') claimStatus?: string) {
    return this.studentsService.list(this.userId(request), claimStatus);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateStudentRecordDto) {
    return this.studentsService.create(this.userId(request), dto);
  }

  @Post('import')
  importRows(@Req() request: AuthenticatedRequest, @Body() dto: ImportStudentRecordsDto) {
    return this.studentsService.importRows(this.userId(request), dto.rows);
  }

  @Patch(':id/claim-review')
  reviewClaim(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { approve: boolean },
  ) {
    return this.studentsService.reviewClaim(this.userId(request), id, Boolean(body.approve));
  }
}
