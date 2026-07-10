import { Controller, Get, Param, Patch, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { Phase3Service } from './phase3.service';

@Controller('phase3')
@UseGuards(JwtAuthGuard, RolesGuard)
export class Phase3Controller {
  constructor(private readonly service: Phase3Service) {}

  private user(request: AuthenticatedRequest) {
    if (!request.user) throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    return request.user;
  }

  @Get('dashboard')
  @Roles('ISSUER')
  dashboard(@Req() request: AuthenticatedRequest) {
    return this.service.dashboard(this.user(request).sub);
  }

  @Get('notifications')
  @Roles('ISSUER', 'HOLDER')
  notifications(@Req() request: AuthenticatedRequest) {
    return this.service.notifications(this.user(request).sub);
  }

  @Patch('notifications/:id/read')
  @Roles('ISSUER', 'HOLDER')
  markRead(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.markNotificationRead(this.user(request).sub, id);
  }
}
