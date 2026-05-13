import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { CredentialsService } from './credentials.service';

@Controller('credentials')
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  /**
   * POST /credentials
   * Issuer ใช้อัปโหลดไฟล์ PDF และสร้าง Credential Metadata
   *
   * Body type: multipart/form-data
   * Field file: pdf
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ISSUER')
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  createCredential(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCredentialDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งานจาก Token');
    }

    return this.credentialsService.createCredential({
      issuerId: user.sub,
      dto,
      file,
    });
  }

  /**
   * GET /credentials/issuer
   * Issuer ใช้ดูรายการเอกสารที่ตัวเองออก
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ISSUER')
  @Get('issuer')
  findIssuerCredentials(@Req() request: AuthenticatedRequest) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งานจาก Token');
    }

    return this.credentialsService.findByIssuer(user.sub);
  }

  /**
   * GET /credentials/holder
   * Holder ใช้ดูรายการเอกสารของตัวเอง
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOLDER')
  @Get('holder')
  findHolderCredentials(@Req() request: AuthenticatedRequest) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งานจาก Token');
    }

    return this.credentialsService.findByHolder(user.sub);
  }

  /**
   * GET /credentials/:id/download-url
   * สร้าง signed URL สำหรับดาวน์โหลด PDF
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ISSUER', 'HOLDER')
  @Get(':id/download-url')
  createDownloadUrl(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งานจาก Token');
    }

    return this.credentialsService.createDownloadUrl({
      credentialId: id,
      userId: user.sub,
      role: user.role,
    });
  }
  /**
   * GET /credentials/:id
   * ดูรายละเอียดเอกสาร
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ISSUER', 'HOLDER')
  @Get(':id')
  findOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งานจาก Token');
    }

    return this.credentialsService.findOneForUser({
      credentialId: id,
      userId: user.sub,
      role: user.role,
    });
  }
}
