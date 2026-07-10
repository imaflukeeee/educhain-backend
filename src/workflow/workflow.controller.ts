import { Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { WorkflowService } from './workflow.service';

@Controller('workflow')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ISSUER')
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  private userId(request: AuthenticatedRequest) {
    if (!request.user) throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    return request.user.sub;
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('status') status?: string) {
    return this.service.list(this.userId(request), status);
  }

  @Post(':id/:action')
  transition(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: { note?: string },
  ) {
    return this.service.transition(this.userId(request), id, action, body.note);
  }
}
