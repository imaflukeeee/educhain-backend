import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { CredentialStatus, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { CreateCredentialDto } from './dto/create-credential.dto';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
    private readonly blockchainService: BlockchainService,
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

    const maxFileSize = 10 * 1024 * 1024;

    if (file.size > maxFileSize) {
      throw new BadRequestException('ขนาดไฟล์ต้องไม่เกิน 10MB');
    }

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

    const documentHash = createHash('sha256').update(file.buffer).digest('hex');

    const timestamp = Date.now();
    const safeFileName = file.originalname.replace(/\s+/g, '_');
    const storagePath = `${issuerId}/${holder.id}/${timestamp}_${safeFileName}`;

    await this.storageService.uploadPdf({
      fileBuffer: file.buffer,
      storagePath,
      mimeType: file.mimetype,
    });

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
        status: CredentialStatus.PENDING,
      },
    });

    return {
      message: 'สร้างข้อมูลเอกสารสำเร็จรอการบันทึกลง Blockchain',
      credential,
    };
  }

  /**
   * Issuer ดูรายการเอกสารที่ตัวเองเป็นผู้ออก
   */
  async findByIssuer(issuerId: string) {
    return this.prisma.credential.findMany({
      where: {
        issuerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        holder: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
          },
        },
      },
    });
  }

  /**
   * Holder ดูรายการเอกสารของตัวเอง
   */
  async findByHolder(holderId: string) {
    return this.prisma.credential.findMany({
      where: {
        holderId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        issuer: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
          },
        },
      },
    });
  }

  /**
   * ดูรายละเอียดเอกสาร โดยต้องเป็นเจ้าของสิทธิ์ที่เกี่ยวข้องเท่านั้น
   * Issuer ดูได้เฉพาะเอกสารที่ตัวเองออก
   * Holder ดูได้เฉพาะเอกสารของตัวเอง
   */
  async findOneForUser(params: {
    credentialId: string;
    userId: string;
    role: 'ISSUER' | 'HOLDER';
  }) {
    const credential = await this.prisma.credential.findUnique({
      where: {
        id: params.credentialId,
      },
      include: {
        issuer: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
          },
        },
        holder: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
          },
        },
      },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    const isIssuerOwner =
      params.role === 'ISSUER' && credential.issuerId === params.userId;

    const isHolderOwner =
      params.role === 'HOLDER' && credential.holderId === params.userId;

    if (!isIssuerOwner && !isHolderOwner) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้');
    }

    return credential;
  }

  /**
   * สร้าง Signed URL สำหรับดาวน์โหลด PDF
   */
  async createDownloadUrl(params: {
    credentialId: string;
    userId: string;
    role: 'ISSUER' | 'HOLDER';
  }) {
    const credential = await this.prisma.credential.findUnique({
      where: {
        id: params.credentialId,
      },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    const isIssuerOwner =
      params.role === 'ISSUER' && credential.issuerId === params.userId;

    const isHolderOwner =
      params.role === 'HOLDER' && credential.holderId === params.userId;

    if (!isIssuerOwner && !isHolderOwner) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ดาวน์โหลดเอกสารนี้');
    }

    if (params.role === 'HOLDER' && credential.status !== 'VERIFIED') {
      throw new BadRequestException(
        'เอกสารยังไม่พร้อมให้ดาวน์โหลด กรุณารอการยืนยันบน Blockchain',
      );
    }

    const downloadUrl = await this.storageService.createSignedUrl({
      storagePath: credential.storagePath,
      expiresInSeconds: 60 * 5,
    });

    return {
      message: 'สร้างลิงก์ดาวน์โหลดเอกสารสำเร็จ',
      downloadUrl,
      expiresInSeconds: 60 * 5,
    };
  }

  /**
   * Issuer ใช้บันทึก Credential Hash ลง Blockchain
   * หลังบันทึกสำเร็จ ระบบจะอัปเดตสถานะเอกสารเป็น VERIFIED
   */
  async registerCredentialOnChain(params: {
    credentialId: string;
    issuerId: string;
  }) {
    const credential = await this.prisma.credential.findUnique({
      where: {
        id: params.credentialId,
      },
      include: {
        holder: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
          },
        },
      },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    if (credential.issuerId !== params.issuerId) {
      throw new ForbiddenException(
        'คุณไม่มีสิทธิ์บันทึกเอกสารนี้ลง Blockchain',
      );
    }

    if (credential.status === 'VERIFIED') {
      throw new BadRequestException('เอกสารนี้ถูกยืนยันบน Blockchain แล้ว');
    }

    if (credential.transactionHash) {
      throw new BadRequestException(
        'เอกสารนี้มี Transaction บน Blockchain แล้ว',
      );
    }

    if (!credential.holder.walletAddress) {
      throw new BadRequestException('Holder ยังไม่ได้ตั้งค่า Wallet Address');
    }

    const blockchainResult =
      await this.blockchainService.registerCredentialOnChain({
        credentialId: credential.credentialId,
        documentHash: credential.documentHash,
        holderAddress: credential.holder.walletAddress,
      });

    const updatedCredential = await this.prisma.credential.update({
      where: {
        id: credential.id,
      },
      data: {
        status: 'VERIFIED',
        network: blockchainResult.network,
        transactionHash: blockchainResult.transactionHash,
        blockNumber: blockchainResult.blockNumber,
      },
    });

    return {
      message: 'บันทึกข้อมูลเอกสารลง Blockchain สำเร็จ',
      credential: updatedCredential,
      blockchain: blockchainResult,
    };
  }

  /**
   * ตรวจสอบข้อมูล Credential ระหว่าง Database กับ Blockchain
   */
  async verifyCredentialOnChain(params: {
    credentialId: string;
    userId: string;
    role: 'ISSUER' | 'HOLDER';
  }) {
    const credential = await this.prisma.credential.findUnique({
      where: {
        id: params.credentialId,
      },
      include: {
        holder: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
          },
        },
        issuer: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
          },
        },
      },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    const isIssuerOwner =
      params.role === 'ISSUER' && credential.issuerId === params.userId;

    const isHolderOwner =
      params.role === 'HOLDER' && credential.holderId === params.userId;

    if (!isIssuerOwner && !isHolderOwner) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ตรวจสอบเอกสารนี้');
    }

    const blockchainCredential =
      await this.blockchainService.getCredentialFromChain(
        credential.credentialId,
      );

    const isDocumentHashMatched =
      credential.documentHash.toLowerCase() ===
      blockchainCredential.documentHash.toLowerCase();

    const isHolderAddressMatched =
      credential.holder.walletAddress?.toLowerCase() ===
      blockchainCredential.holderAddress.toLowerCase();

    const isDatabaseVerified = credential.status === 'VERIFIED';

    const isValid =
      isDocumentHashMatched && isHolderAddressMatched && isDatabaseVerified;

    return {
      message: isValid
        ? 'ตรวจสอบเอกสารสำเร็จ ข้อมูลตรงกับ Blockchain'
        : !isDatabaseVerified
          ? 'ตรวจสอบเอกสารไม่สำเร็จ เอกสารนี้ถูกเพิกถอนหรือไม่ได้อยู่ในสถานะยืนยัน'
          : 'ตรวจสอบเอกสารไม่สำเร็จ ข้อมูลเอกสารไม่ตรงกับ Blockchain',
      isValid,
      checks: {
        documentHashMatched: isDocumentHashMatched,
        holderAddressMatched: isHolderAddressMatched,
        databaseStatusVerified: isDatabaseVerified,
      },
      database: {
        id: credential.id,
        credentialId: credential.credentialId,
        documentHash: credential.documentHash,
        status: credential.status,
        transactionHash: credential.transactionHash,
        blockNumber: credential.blockNumber,
        network: credential.network,
        holderWalletAddress: credential.holder.walletAddress,
      },
      blockchain: blockchainCredential,
    };
  }

  /**
   * Public Verify API
   * Verifier ใช้ตรวจสอบเอกสารจาก credentialId โดยไม่ต้อง Login
   */
  async verifyPublicCredential(params: { credentialId: string }) {
    if (!params.credentialId) {
      throw new BadRequestException('กรุณาระบุ Credential ID');
    }

    const credential = await this.prisma.credential.findUnique({
      where: {
        credentialId: params.credentialId,
      },
      include: {
        issuer: {
          select: {
            id: true,
            name: true,
            email: true,
            walletAddress: true,
          },
        },
        holder: {
          select: {
            id: true,
            name: true,
            email: true,
            walletAddress: true,
          },
        },
      },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    const blockchainCredential =
      await this.blockchainService.getCredentialFromChain(
        credential.credentialId,
      );

    const isDocumentHashMatched =
      credential.documentHash.toLowerCase() ===
      blockchainCredential.documentHash.toLowerCase();

    const isHolderAddressMatched =
      credential.holder.walletAddress?.toLowerCase() ===
      blockchainCredential.holderAddress.toLowerCase();

    const isDatabaseVerified = credential.status === 'VERIFIED';

    const hasTransaction =
      Boolean(credential.transactionHash) &&
      Boolean(credential.blockNumber) &&
      Boolean(credential.network);

    const isValid =
      isDocumentHashMatched &&
      isHolderAddressMatched &&
      isDatabaseVerified &&
      hasTransaction;

    return {
      message: isValid
        ? 'ตรวจสอบเอกสารสำเร็จ เอกสารนี้ถูกต้องและอยู่บน Blockchain'
        : !isDatabaseVerified
          ? 'ตรวจสอบเอกสารไม่สำเร็จ เอกสารนี้ถูกเพิกถอนหรือไม่ได้อยู่ในสถานะยืนยัน'
          : 'ตรวจสอบเอกสารไม่สำเร็จ ข้อมูลเอกสารไม่ตรงกับ Blockchain',
      isValid,
      verifiedAt: new Date().toISOString(),
      checks: {
        documentHashMatched: isDocumentHashMatched,
        holderAddressMatched: isHolderAddressMatched,
        databaseStatusVerified: isDatabaseVerified,
        hasTransaction,
      },
      credential: {
        credentialId: credential.credentialId,
        documentTitle: credential.documentTitle,
        studentName: credential.studentName,
        studentId: credential.studentId,
        faculty: credential.faculty,
        major: credential.major,
        issuedAt: credential.issuedAt,
        status: credential.status,
      },
      issuer: {
        name: credential.issuer.name,
        walletAddress: credential.issuer.walletAddress,
      },
      holder: {
        name: credential.holder.name,
        walletAddress: credential.holder.walletAddress,
      },
      blockchain: {
        network: credential.network,
        transactionHash: credential.transactionHash,
        blockNumber: credential.blockNumber,
        credentialId: blockchainCredential.credentialId,
        documentHash: blockchainCredential.documentHash,
        issuerAddress: blockchainCredential.issuerAddress,
        holderAddress: blockchainCredential.holderAddress,
        timestamp: blockchainCredential.timestamp,
      },
    };
  }

  /**
   * Public Verify File API
   * Verifier อัปโหลดไฟล์ PDF เพื่อตรวจสอบว่า Hash ของไฟล์ตรงกับ Database และ Blockchain หรือไม่
   */
  async verifyPublicCredentialFile(params: {
    credentialId: string;
    file: Express.Multer.File;
  }) {
    if (!params.credentialId) {
      throw new BadRequestException('กรุณาระบุ Credential ID');
    }

    if (!params.file) {
      throw new BadRequestException('กรุณาอัปโหลดไฟล์เอกสาร');
    }

    if (params.file.mimetype !== 'application/pdf') {
      throw new BadRequestException('รองรับเฉพาะไฟล์ PDF เท่านั้น');
    }

    const credential = await this.prisma.credential.findUnique({
      where: {
        credentialId: params.credentialId,
      },
      include: {
        issuer: {
          select: {
            name: true,
            walletAddress: true,
          },
        },
        holder: {
          select: {
            name: true,
            walletAddress: true,
          },
        },
      },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    const uploadedFileHash = createHash('sha256')
      .update(params.file.buffer)
      .digest('hex');

    const blockchainCredential =
      await this.blockchainService.getCredentialFromChain(
        credential.credentialId,
      );

    const isUploadedFileMatched =
      uploadedFileHash.toLowerCase() === credential.documentHash.toLowerCase();

    const isDocumentHashMatched =
      credential.documentHash.toLowerCase() ===
      blockchainCredential.documentHash.toLowerCase();

    const isHolderAddressMatched =
      credential.holder.walletAddress?.toLowerCase() ===
      blockchainCredential.holderAddress.toLowerCase();

    const isDatabaseVerified = credential.status === 'VERIFIED';

    const hasTransaction =
      Boolean(credential.transactionHash) &&
      Boolean(credential.blockNumber) &&
      Boolean(credential.network);

    const isValid =
      isUploadedFileMatched &&
      isDocumentHashMatched &&
      isHolderAddressMatched &&
      isDatabaseVerified &&
      hasTransaction;

    return {
      message: isValid
        ? 'ตรวจสอบไฟล์เอกสารสำเร็จ ไฟล์นี้ถูกต้องและตรงกับข้อมูลบน Blockchain'
        : !isDatabaseVerified
          ? 'ตรวจสอบไฟล์เอกสารไม่สำเร็จ เอกสารนี้ถูกเพิกถอนหรือไม่ได้อยู่ในสถานะยืนยัน'
          : !isUploadedFileMatched
            ? 'ตรวจสอบไฟล์เอกสารไม่สำเร็จ ไฟล์นี้ไม่ตรงกับข้อมูลที่บันทึกไว้'
            : 'ตรวจสอบไฟล์เอกสารไม่สำเร็จ ข้อมูลเอกสารไม่ตรงกับ Blockchain',
      isValid,
      verifiedAt: new Date().toISOString(),
      checks: {
        uploadedFileMatched: isUploadedFileMatched,
        documentHashMatched: isDocumentHashMatched,
        holderAddressMatched: isHolderAddressMatched,
        databaseStatusVerified: isDatabaseVerified,
        hasTransaction,
      },
      uploadedFile: {
        fileName: params.file.originalname,
        fileSize: params.file.size,
        mimeType: params.file.mimetype,
        sha256Hash: uploadedFileHash,
      },
      credential: {
        credentialId: credential.credentialId,
        documentTitle: credential.documentTitle,
        studentName: credential.studentName,
        studentId: credential.studentId,
        faculty: credential.faculty,
        major: credential.major,
        issuedAt: credential.issuedAt,
        status: credential.status,
      },
      issuer: {
        name: credential.issuer.name,
        walletAddress: credential.issuer.walletAddress,
      },
      holder: {
        name: credential.holder.name,
        walletAddress: credential.holder.walletAddress,
      },
      blockchain: {
        network: credential.network,
        transactionHash: credential.transactionHash,
        blockNumber: credential.blockNumber,
        credentialId: blockchainCredential.credentialId,
        documentHash: blockchainCredential.documentHash,
        issuerAddress: blockchainCredential.issuerAddress,
        holderAddress: blockchainCredential.holderAddress,
        timestamp: blockchainCredential.timestamp,
      },
    };
  }

  /**
   * Holder ใช้สร้าง Share Link สำหรับให้ Verifier ตรวจสอบเอกสาร
   */
  async createShareLink(params: { credentialId: string; holderId: string }) {
    const credential = await this.prisma.credential.findUnique({
      where: {
        id: params.credentialId,
      },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    if (credential.holderId !== params.holderId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์สร้างลิงก์แชร์เอกสารนี้');
    }

    if (credential.status !== 'VERIFIED') {
      throw new BadRequestException(
        'สามารถสร้างลิงก์แชร์ได้เฉพาะเอกสารที่ยืนยันแล้วเท่านั้น',
      );
    }

    if (!credential.transactionHash) {
      throw new BadRequestException(
        'เอกสารนี้ยังไม่มีข้อมูล Transaction บน Blockchain',
      );
    }

    const token = randomBytes(32).toString('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const shareLink = await this.prisma.credentialShareLink.create({
      data: {
        token,
        credentialId: credential.id,
        holderId: params.holderId,
        expiresAt,
      },
    });

    const baseUrl = (
      process.env.APP_BASE_URL ?? 'http://localhost:4000'
    ).replace(/\/$/, '');

    return {
      message: 'สร้างลิงก์แชร์เอกสารสำเร็จ',
      shareLink: {
        token: shareLink.token,
        verifyUrl: `${baseUrl}/credentials/share/${shareLink.token}/verify`,
        expiresAt: shareLink.expiresAt,
      },
    };
  }

  /**
   * Verifier ใช้ตรวจสอบเอกสารผ่าน Share Link โดยไม่ต้อง Login
   */
  async verifySharedCredential(params: { token: string }) {
    if (!params.token) {
      throw new BadRequestException('กรุณาระบุ Share Token');
    }

    const shareLink = await this.prisma.credentialShareLink.findUnique({
      where: {
        token: params.token,
      },
      include: {
        credential: {
          include: {
            issuer: {
              select: {
                name: true,
                walletAddress: true,
              },
            },
            holder: {
              select: {
                name: true,
                walletAddress: true,
              },
            },
          },
        },
      },
    });

    if (!shareLink) {
      throw new NotFoundException('ไม่พบลิงก์แชร์เอกสาร');
    }

    if (shareLink.revokedAt) {
      throw new BadRequestException('ลิงก์แชร์เอกสารนี้ถูกยกเลิกแล้ว');
    }

    if (shareLink.expiresAt < new Date()) {
      throw new BadRequestException('ลิงก์แชร์เอกสารนี้หมดอายุแล้ว');
    }

    const credential = shareLink.credential;

    const blockchainCredential =
      await this.blockchainService.getCredentialFromChain(
        credential.credentialId,
      );

    const isDocumentHashMatched =
      credential.documentHash.toLowerCase() ===
      blockchainCredential.documentHash.toLowerCase();

    const isHolderAddressMatched =
      credential.holder.walletAddress?.toLowerCase() ===
      blockchainCredential.holderAddress.toLowerCase();

    const isDatabaseVerified = credential.status === 'VERIFIED';

    const hasTransaction =
      Boolean(credential.transactionHash) &&
      Boolean(credential.blockNumber) &&
      Boolean(credential.network);

    const isValid =
      isDocumentHashMatched &&
      isHolderAddressMatched &&
      isDatabaseVerified &&
      hasTransaction;

    return {
      message: isValid
        ? 'ตรวจสอบเอกสารจากลิงก์แชร์สำเร็จ เอกสารนี้ถูกต้องและอยู่บน Blockchain'
        : !isDatabaseVerified
          ? 'ตรวจสอบเอกสารจากลิงก์แชร์ไม่สำเร็จ เอกสารนี้ถูกเพิกถอนหรือไม่ได้อยู่ในสถานะยืนยัน'
          : 'ตรวจสอบเอกสารจากลิงก์แชร์ไม่สำเร็จ ข้อมูลไม่ตรงกับ Blockchain',
      isValid,
      verifiedAt: new Date().toISOString(),
      shareLink: {
        expiresAt: shareLink.expiresAt,
      },
      checks: {
        documentHashMatched: isDocumentHashMatched,
        holderAddressMatched: isHolderAddressMatched,
        databaseStatusVerified: isDatabaseVerified,
        hasTransaction,
      },
      credential: {
        credentialId: credential.credentialId,
        documentTitle: credential.documentTitle,
        studentName: credential.studentName,
        studentId: credential.studentId,
        faculty: credential.faculty,
        major: credential.major,
        issuedAt: credential.issuedAt,
        status: credential.status,
      },
      issuer: {
        name: credential.issuer.name,
        walletAddress: credential.issuer.walletAddress,
      },
      holder: {
        name: credential.holder.name,
        walletAddress: credential.holder.walletAddress,
      },
      blockchain: {
        network: credential.network,
        transactionHash: credential.transactionHash,
        blockNumber: credential.blockNumber,
        credentialId: blockchainCredential.credentialId,
        documentHash: blockchainCredential.documentHash,
        issuerAddress: blockchainCredential.issuerAddress,
        holderAddress: blockchainCredential.holderAddress,
        timestamp: blockchainCredential.timestamp,
      },
    };
  }

  /**
   * Holder ใช้ยกเลิก Share Link ที่เคยสร้างไว้
   */
  async revokeShareLink(params: { token: string; holderId: string }) {
    if (!params.token) {
      throw new BadRequestException('กรุณาระบุ Share Token');
    }

    const shareLink = await this.prisma.credentialShareLink.findUnique({
      where: {
        token: params.token,
      },
      include: {
        credential: {
          select: {
            id: true,
            credentialId: true,
            documentTitle: true,
            studentName: true,
            status: true,
          },
        },
      },
    });

    if (!shareLink) {
      throw new NotFoundException('ไม่พบลิงก์แชร์เอกสาร');
    }

    if (shareLink.holderId !== params.holderId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ยกเลิกลิงก์แชร์นี้');
    }

    if (shareLink.revokedAt) {
      throw new BadRequestException('ลิงก์แชร์เอกสารนี้ถูกยกเลิกไปแล้ว');
    }

    const updatedShareLink = await this.prisma.credentialShareLink.update({
      where: {
        token: params.token,
      },
      data: {
        revokedAt: new Date(),
      },
      include: {
        credential: {
          select: {
            credentialId: true,
            documentTitle: true,
            studentName: true,
            status: true,
          },
        },
      },
    });

    return {
      message: 'ยกเลิกลิงก์แชร์เอกสารสำเร็จ',
      shareLink: {
        token: updatedShareLink.token,
        revokedAt: updatedShareLink.revokedAt,
        expiresAt: updatedShareLink.expiresAt,
      },
      credential: updatedShareLink.credential,
    };
  }

  /**
   * Holder ใช้ดูรายการ Share Link ทั้งหมดของเอกสาร
   */
  async listShareLinks(params: { credentialId: string; holderId: string }) {
    const credential = await this.prisma.credential.findUnique({
      where: {
        id: params.credentialId,
      },
      select: {
        id: true,
        credentialId: true,
        documentTitle: true,
        studentName: true,
        status: true,
        holderId: true,
      },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    if (credential.holderId !== params.holderId) {
      throw new ForbiddenException(
        'คุณไม่มีสิทธิ์ดูรายการลิงก์แชร์ของเอกสารนี้',
      );
    }

    const shareLinks = await this.prisma.credentialShareLink.findMany({
      where: {
        credentialId: credential.id,
        holderId: params.holderId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        token: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const baseUrl = (
      process.env.APP_BASE_URL ?? 'http://localhost:4000'
    ).replace(/\/$/, '');

    const now = new Date();

    return {
      message: 'ดึงรายการลิงก์แชร์เอกสารสำเร็จ',
      credential: {
        id: credential.id,
        credentialId: credential.credentialId,
        documentTitle: credential.documentTitle,
        studentName: credential.studentName,
        status: credential.status,
      },
      total: shareLinks.length,
      shareLinks: shareLinks.map((link) => {
        const status = link.revokedAt
          ? 'REVOKED'
          : link.expiresAt < now
            ? 'EXPIRED'
            : 'ACTIVE';

        return {
          token: link.token,
          verifyUrl: `${baseUrl}/credentials/share/${link.token}/verify`,
          status,
          expiresAt: link.expiresAt,
          revokedAt: link.revokedAt,
          createdAt: link.createdAt,
          updatedAt: link.updatedAt,
        };
      }),
    };
  }

  /**
   * Issuer ใช้เพิกถอน / ยกเลิก Credential
   * เมื่อเอกสารถูกทำให้ INVALID ระบบจะยกเลิก Share Link ทั้งหมดของเอกสารนี้ด้วย
   */
  async invalidateCredential(params: {
    credentialId: string;
    issuerId: string;
  }) {
    const credential = await this.prisma.credential.findUnique({
      where: {
        id: params.credentialId,
      },
      select: {
        id: true,
        credentialId: true,
        issuerId: true,
        holderId: true,
        documentTitle: true,
        studentName: true,
        studentId: true,
        status: true,
        transactionHash: true,
        blockNumber: true,
        network: true,
      },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    if (credential.issuerId !== params.issuerId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เพิกถอนเอกสารนี้');
    }

    if (credential.status === 'INVALID') {
      throw new BadRequestException('เอกสารนี้ถูกเพิกถอนไปแล้ว');
    }

    const revokedAt = new Date();

    await this.prisma.credentialShareLink.updateMany({
      where: {
        credentialId: credential.id,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });

    const updatedCredential = await this.prisma.credential.update({
      where: {
        id: credential.id,
      },
      data: {
        status: 'INVALID',
      },
      select: {
        id: true,
        credentialId: true,
        documentTitle: true,
        studentName: true,
        studentId: true,
        status: true,
        transactionHash: true,
        blockNumber: true,
        network: true,
        updatedAt: true,
      },
    });

    return {
      message: 'เพิกถอนเอกสารสำเร็จ',
      credential: updatedCredential,
      revokedShareLinksAt: revokedAt,
    };
  }
}
