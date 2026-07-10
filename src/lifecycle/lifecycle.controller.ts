import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateBatchDto } from './dto/create-batch.dto';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateBatchStatusDto } from './dto/update-batch-status.dto';
import { UpdateDocumentRequestDto } from './dto/update-document-request.dto';
import { LifecycleService } from './lifecycle.service';

@Controller('document-lifecycle')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LifecycleController {
  constructor(private readonly service: LifecycleService) {}

  private userId(request: AuthenticatedRequest) {
    if (!request.user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งานจาก Token');
    }
    return request.user.sub;
  }

  @Roles('HOLDER')
  @Post('requests')
  createRequest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateDocumentRequestDto,
  ) {
    return this.service.createHolderRequest(this.userId(request), dto);
  }

  @Roles('HOLDER')
  @Get('requests/my')
  listMyRequests(@Req() request: AuthenticatedRequest) {
    return this.service.listHolderRequests(this.userId(request));
  }

  @Roles('HOLDER')
  @Patch('requests/:id/cancel')
  cancelRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.cancelHolderRequest(this.userId(request), id);
  }

  @Roles('ISSUER')
  @Get('requests')
  listRequests(
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    return this.service.listIssuerRequests(this.userId(request), status);
  }

  @Roles('ISSUER')
  @Patch('requests/:id')
  updateRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentRequestDto,
  ) {
    return this.service.updateIssuerRequest(this.userId(request), id, dto);
  }

  @Roles('ISSUER')
  @Post('templates')
  createTemplate(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.service.createTemplate(this.userId(request), dto);
  }

  @Roles('ISSUER')
  @Get('templates')
  listTemplates(@Req() request: AuthenticatedRequest) {
    return this.service.listTemplates(this.userId(request));
  }

  @Roles('ISSUER')
  @Delete('templates/:id')
  deleteTemplate(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.deleteTemplate(this.userId(request), id);
  }

  @Roles('ISSUER')
  @Post('batches')
  createBatch(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBatchDto,
  ) {
    return this.service.createBatch(this.userId(request), dto);
  }

  @Roles('ISSUER')
  @Get('batches')
  listBatches(@Req() request: AuthenticatedRequest) {
    return this.service.listBatches(this.userId(request));
  }

  @Roles('ISSUER')
  @Patch('batches/:id/status')
  updateBatchStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateBatchStatusDto,
  ) {
    return this.service.updateBatchStatus(this.userId(request), id, dto);
  }
}
