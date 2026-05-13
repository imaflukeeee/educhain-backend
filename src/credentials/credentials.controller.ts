import {
  Body,
  Controller,
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
import { CreateCredentialDto } from './dto/create-credential.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
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
}
