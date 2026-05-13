import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { CredentialStatus, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { CreateCredentialDto } from './dto/create-credential.dto';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  /**
   * Issuer ใช้สร้าง Credential จากไฟล์ PDF และ Metadata
   */
  async createCredential(params: {
    issuerId: string;
    dto: CreateCredentialDto;
    file: Express.Multer.File;
  }) {
    const { issuerId, dto, file } = params;

    if (!file) {
      throw new BadRequestException('กรุณาอัปโหลดไฟล์ PDF');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('รองรับเฉพาะไฟล์ PDF เท่านั้น');
    }

    /**
     * จำกัดขนาดไฟล์ 10MB
     */
    const maxFileSize = 10 * 1024 * 1024;

    if (file.size > maxFileSize) {
      throw new BadRequestException('ขนาดไฟล์ต้องไม่เกิน 10MB');
    }

    /**
     * ตรวจสอบว่า Holder มีอยู่จริง และต้องเป็น role HOLDER
     */
    const holder = await this.prisma.user.findUnique({
      where: { email: dto.holderEmail },
      select: {
        id: true,
        role: true,
      },
    });

    if (!holder || holder.role !== UserRole.HOLDER) {
      throw new NotFoundException('ไม่พบนักศึกษาหรือ Holder ในระบบ');
    }

    /**
     * สร้าง SHA-256 Hash จากไฟล์ PDF จริง
     * หากไฟล์ถูกแก้ไข ค่า Hash จะเปลี่ยนทันที
     */
    const documentHash = createHash('sha256').update(file.buffer).digest('hex');

    /**
     * ตั้ง path สำหรับเก็บไฟล์ใน Supabase Storage
     * แยก folder ตาม issuerId / holderId เพื่อจัดการง่าย
     */
    const timestamp = Date.now();
    const safeFileName = file.originalname.replace(/\s+/g, '_');
    const storagePath = `${issuerId}/${holder.id}/${timestamp}_${safeFileName}`;

    await this.storageService.uploadPdf({
      fileBuffer: file.buffer,
      storagePath,
      mimeType: file.mimetype,
    });

    /**
     * บันทึก Metadata ลง PostgreSQL
     * ตอนนี้ตั้ง status เป็น PENDING ก่อน
     * ขั้นตอน Blockchain จะมาอัปเดตเป็น VERIFIED ภายหลัง
     */
    const credential = await this.prisma.credential.create({
      data: {
        issuerId,
        holderId: holder.id,
        studentName: dto.studentName,
        studentId: dto.studentId,
        faculty: dto.faculty,
        major: dto.major,
        documentTitle: dto.documentTitle,
        issuedAt: new Date(dto.issuedAt),
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storagePath,
        documentHash,

        /**
         * ใช้ string literal แทน CredentialStatus.PENDING
         * เพื่อลดปัญหา ESLint resolve enum จาก generated Prisma Client
         */
        status: CredentialStatus.PENDING,
      },
    });

    return {
      message: 'สร้างข้อมูลเอกสารสำเร็จรอการบันทึกลง Blockchain',
      credential,
    };
  }
}
