import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ISSUER')
  @Get('student/:studentId')
  async findStudentByStudentId(
    @Req() request: AuthenticatedRequest,
    @Param('studentId') studentId: string,
  ) {
    const authUser = request.user;

    if (!authUser) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งาน');
    }

    const issuer = await this.usersService.findById(authUser.sub);

    if (!issuer || issuer.role !== 'ISSUER') {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ออกเอกสาร');
    }

    const student = await this.usersService.findHolderByStudentId(studentId);

    if (!student) {
      throw new NotFoundException('ไม่พบรหัสนักศึกษานี้ในระบบ');
    }

    const issuerUniversityNameTh =
      issuer.issuerAccountType === 'REGISTRAR_STAFF'
        ? issuer.universityOwner?.universityNameTh
        : issuer.universityNameTh;

    const issuerUniversityNameEn =
      issuer.issuerAccountType === 'REGISTRAR_STAFF'
        ? issuer.universityOwner?.universityNameEn
        : issuer.universityNameEn;

    const isSameUniversityTh =
      issuerUniversityNameTh && student.universityNameTh
        ? issuerUniversityNameTh.trim() === student.universityNameTh.trim()
        : true;

    const isSameUniversityEn =
      issuerUniversityNameEn && student.universityNameEn
        ? issuerUniversityNameEn.trim().toLowerCase() ===
          student.universityNameEn.trim().toLowerCase()
        : true;

    if (!isSameUniversityTh || !isSameUniversityEn) {
      throw new NotFoundException('ไม่พบนักศึกษานี้ในมหาวิทยาลัยของคุณ');
    }

    return {
      message: 'พบข้อมูลนักศึกษา',
      student,
    };
  }
}
