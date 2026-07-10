import {
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { OperationsService } from './operations.service';

/**
 * ใช้ /operations เป็น route หลัก
 * และคง /phase3 ชั่วคราวเพื่อไม่ให้ Frontend เวอร์ชันเดิมเสียทันที
 */
@Controller(['operations', 'phase3'])
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationsController {
  constructor(private readonly service: OperationsService) {}

  private user(request: AuthenticatedRequest) {
    if (!request.user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    }

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
