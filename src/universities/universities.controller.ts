import { Body, Controller, Get, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateFacultyDto } from './dto/create-faculty.dto';
import { CreateMajorDto } from './dto/create-major.dto';
import { UpdateActiveDto } from './dto/update-active.dto';
import { UniversitiesService } from './universities.service';

@Controller('universities')
export class UniversitiesController {
  constructor(private readonly service: UniversitiesService) {}
  @Get('master') listMaster() { return this.service.listMaster(); }
  @Get('registered') listRegistered() { return this.service.listRegistered(); }
  @Get(':id/faculties') listFaculties(@Param('id') id: string) { return this.service.listFaculties(id); }
  @Get('faculties/:id/majors') listMajors(@Param('id') id: string) { return this.service.listMajors(id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ISSUER') @Get('issuer/mine/faculties')
  async mine(@Req() req: AuthenticatedRequest) { if (!req.user) throw new UnauthorizedException(); const id=await this.service.getUniversityForUser(req.user.sub); return this.service.listFaculties(id, true); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ISSUER') @Post('issuer/faculties')
  createFaculty(@Req() req: AuthenticatedRequest, @Body() dto: CreateFacultyDto) { if (!req.user) throw new UnauthorizedException(); return this.service.createFaculty(req.user.sub, dto); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ISSUER') @Post('issuer/majors')
  createMajor(@Req() req: AuthenticatedRequest, @Body() dto: CreateMajorDto) { if (!req.user) throw new UnauthorizedException(); return this.service.createMajor(req.user.sub, dto); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ISSUER') @Patch('issuer/faculties/:id/active')
  facultyActive(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateActiveDto) { if (!req.user) throw new UnauthorizedException(); return this.service.setFacultyActive(req.user.sub,id,dto.isActive); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ISSUER') @Patch('issuer/majors/:id/active')
  majorActive(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateActiveDto) { if (!req.user) throw new UnauthorizedException(); return this.service.setMajorActive(req.user.sub,id,dto.isActive); }
}
