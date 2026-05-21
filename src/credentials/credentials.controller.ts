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
   * POST /credentials/:id/register-chain
   * Issuer ใช้บันทึก documentHash ของเอกสารลง Blockchain
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ISSUER')
  @Post(':id/register-chain')
  registerCredentialOnChain(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งานจาก Token');
    }

    return this.credentialsService.registerCredentialOnChain({
      credentialId: id,
      issuerId: user.sub,
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
   * สร้าง Signed URL สำหรับดาวน์โหลด PDF
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
   * GET /credentials/:id/verify-chain
   * ตรวจสอบข้อมูลเอกสารระหว่าง Database กับ Blockchain
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ISSUER', 'HOLDER')
  @Get(':id/verify-chain')
  verifyCredentialOnChain(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งานจาก Token');
    }

    return this.credentialsService.verifyCredentialOnChain({
      credentialId: id,
      userId: user.sub,
      role: user.role,
    });
  }

  /**
   * GET /credentials/public/:credentialId/verify
   * Public Verify API สำหรับ Verifier ตรวจสอบเอกสารโดยไม่ต้อง Login
   */
  @Get('public/:credentialId/verify')
  verifyPublicCredential(@Param('credentialId') credentialId: string) {
    return this.credentialsService.verifyPublicCredential({
      credentialId,
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
  /**
   * POST /credentials/:id/share-link
   * Holder ใช้สร้างลิงก์แชร์เอกสาร
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOLDER')
  @Post(':id/share-link')
  createShareLink(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งานจาก Token');
    }

    return this.credentialsService.createShareLink({
      credentialId: id,
      holderId: user.sub,
    });
  }
  /**
   * GET /credentials/share/:token/verify
   * Verifier ตรวจสอบเอกสารจาก Share Link โดยไม่ต้อง Login
   */
  @Get('share/:token/verify')
  verifySharedCredential(@Param('token') token: string) {
    return this.credentialsService.verifySharedCredential({
      token,
    });
  }
  /**
   * POST /credentials/share/:token/revoke
   * Holder ใช้ยกเลิกลิงก์แชร์เอกสาร
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOLDER')
  @Post('share/:token/revoke')
  revokeShareLink(
    @Req() request: AuthenticatedRequest,
    @Param('token') token: string,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('ไม่พบข้อมูลผู้ใช้งานจาก Token');
    }

    return this.credentialsService.revokeShareLink({
      token,
      holderId: user.sub,
    });
  }
}
