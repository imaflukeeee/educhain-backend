import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { CredentialStatus, UserRole } from '../generated/prisma/client';
import { BlockchainService } from '../blockchain/blockchain.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { CreateCredentialDto } from './dto/create-credential.dto';

const PERMISSIONS = {
  CREATE_CREDENTIAL: 'CREATE_CREDENTIAL',
  REGISTER_CREDENTIAL: 'REGISTER_CREDENTIAL',
  VIEW_ALL_CREDENTIALS: 'VIEW_ALL_CREDENTIALS',
  INVALIDATE_CREDENTIAL: 'INVALIDATE_CREDENTIAL',
} as const;

function decodeUploadedFileName(fileName: string) {
  const urlDecoded = (() => {
    if (!fileName.includes('%')) {
      return fileName;
    }

    try {
      return decodeURIComponent(fileName);
    } catch {
      return fileName;
    }
  })();

  if (!/(?:à¸|à¹|àº|Ã|Â)/.test(urlDecoded)) {
    return urlDecoded;
  }

  try {
    const decoded = Buffer.from(urlDecoded, 'latin1').toString('utf8');
    return /[ก-๙]/.test(decoded) ? decoded : urlDecoded;
  } catch {
    return urlDecoded;
  }
}

function compactName(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}

type IssuerContext = {
  userId: string;
  universityId: string;
  isUniversityAdmin: boolean;
  permissions: string[];
  issuedByName: string;
  issuedByEmail: string;
  issuedByPosition?: string | null;
  issuedByDepartment?: string | null;
};

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
    private readonly blockchainService: BlockchainService,
  ) {}

  private async getIssuerContext(
    userId: string,
    requiredPermission?: string,
  ): Promise<IssuerContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        firstNameTh: true,
        lastNameTh: true,
        firstNameEn: true,
        lastNameEn: true,
        staffPosition: true,
        staffDepartment: true,
        issuerAccountType: true,
        universityOwnerId: true,
        permissions: true,
        isActive: true,
      },
    });

    if (!user || user.role !== UserRole.ISSUER) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ใช้งานส่วนมหาวิทยาลัย');
    }

    if (user.isActive === false) {
      throw new ForbiddenException('บัญชีนี้ถูกปิดการใช้งาน');
    }

    const isStaff = user.issuerAccountType === 'REGISTRAR_STAFF';
    const universityId = isStaff ? user.universityOwnerId : user.id;

    if (!universityId) {
      throw new ForbiddenException(
        'บัญชีเจ้าหน้าที่ยังไม่ได้ผูกกับมหาวิทยาลัย',
      );
    }

    const permissions = user.permissions ?? [];

    if (
      isStaff &&
      requiredPermission &&
      !permissions.includes(requiredPermission)
    ) {
      throw new ForbiddenException(
        'บัญชีนี้ยังไม่ได้รับสิทธิ์สำหรับการทำรายการนี้',
      );
    }

    return {
      userId: user.id,
      universityId,
      isUniversityAdmin: !isStaff,
      permissions,
      issuedByName:
        compactName(user.firstNameTh, user.lastNameTh) ||
        compactName(user.firstNameEn, user.lastNameEn) ||
        user.name,
      issuedByEmail: user.email,
      issuedByPosition: user.staffPosition,
      issuedByDepartment: user.staffDepartment,
    };
  }

  private canViewCredentialAsIssuer(
    credential: {
      issuerId: string;
      issuerStaffId?: string | null;
    },
    context: IssuerContext,
  ) {
    if (credential.issuerId !== context.universityId) {
      return false;
    }

    if (context.isUniversityAdmin) {
      return true;
    }

    if (context.permissions.includes(PERMISSIONS.VIEW_ALL_CREDENTIALS)) {
      return true;
    }

    return credential.issuerStaffId === context.userId;
  }

  async createCredential(params: {
    issuerId: string;
    dto: CreateCredentialDto;
    file: Express.Multer.File;
  }) {
    const { dto, file } = params;
    const issuerContext = await this.getIssuerContext(
      params.issuerId,
      PERMISSIONS.CREATE_CREDENTIAL,
    );

    if (!file) {
      throw new BadRequestException('กรุณาอัปโหลดไฟล์ PDF');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('รองรับเฉพาะไฟล์ PDF เท่านั้น');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('ขนาดไฟล์ต้องไม่เกิน 10MB');
    }

    const holder = await this.prisma.user.findUnique({
      where: { email: dto.holderEmail.trim().toLowerCase() },
      select: { id: true, role: true },
    });

    if (!holder || holder.role !== UserRole.HOLDER) {
      throw new NotFoundException('ไม่พบนักศึกษาในระบบ');
    }

    const documentHash = createHash('sha256').update(file.buffer).digest('hex');
    const safeFileName = `${Date.now()}_${randomUUID()}.pdf`;
    const storagePath = `${issuerContext.universityId}/${holder.id}/${safeFileName}`;

    await this.storageService.uploadPdf({
      fileBuffer: file.buffer,
      storagePath,
      mimeType: file.mimetype,
    });

    const credential = await this.prisma.credential.create({
      data: {
        issuerId: issuerContext.universityId,
        issuerStaffId: issuerContext.userId,
        holderId: holder.id,
        issuedByName: issuerContext.issuedByName,
        issuedByEmail: issuerContext.issuedByEmail,
        issuedByPosition: issuerContext.issuedByPosition,
        issuedByDepartment: issuerContext.issuedByDepartment,
        studentName: dto.studentName,
        studentId: dto.studentId,
        faculty: dto.faculty,
        major: dto.major,
        documentTitle: dto.documentTitle,
        issuedAt: new Date(dto.issuedAt),
        fileName: decodeUploadedFileName(file.originalname),
        fileSize: file.size,
        mimeType: file.mimetype,
        storagePath,
        documentHash,
        status: CredentialStatus.PENDING,
      },
      include: {
        issuerStaff: {
          select: {
            id: true,
            name: true,
            email: true,
            firstNameTh: true,
            lastNameTh: true,
            staffPosition: true,
            staffDepartment: true,
          },
        },
      },
    });

    return {
      message: 'สร้างข้อมูลเอกสารสำเร็จ รอการยืนยันเอกสาร',
      credential,
    };
  }

  async findByIssuer(issuerId: string) {
    const context = await this.getIssuerContext(issuerId);
    const shouldViewAll =
      context.isUniversityAdmin ||
      context.permissions.includes(PERMISSIONS.VIEW_ALL_CREDENTIALS);

    return this.prisma.credential.findMany({
      where: shouldViewAll
        ? { issuerId: context.universityId }
        : { issuerId: context.universityId, issuerStaffId: context.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        holder: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
          },
        },
        issuerStaff: {
          select: {
            id: true,
            email: true,
            name: true,
            firstNameTh: true,
            lastNameTh: true,
            firstNameEn: true,
            lastNameEn: true,
            staffPosition: true,
            staffDepartment: true,
          },
        },
      },
    });
  }

  async findByHolder(holderId: string) {
    return this.prisma.credential.findMany({
      where: { holderId },
      orderBy: { createdAt: 'desc' },
      include: {
        issuer: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
          },
        },
        issuerStaff: {
          select: {
            id: true,
            email: true,
            name: true,
            staffPosition: true,
            staffDepartment: true,
          },
        },
      },
    });
  }

  async findOneForUser(params: {
    credentialId: string;
    userId: string;
    role: 'ISSUER' | 'HOLDER';
  }) {
    const credential = await this.prisma.credential.findUnique({
      where: { id: params.credentialId },
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
        issuerStaff: {
          select: {
            id: true,
            email: true,
            name: true,
            firstNameTh: true,
            lastNameTh: true,
            firstNameEn: true,
            lastNameEn: true,
            staffPosition: true,
            staffDepartment: true,
          },
        },
      },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    let isAllowed = false;

    if (params.role === 'HOLDER') {
      isAllowed = credential.holderId === params.userId;
    }

    if (params.role === 'ISSUER') {
      const context = await this.getIssuerContext(params.userId);
      isAllowed = this.canViewCredentialAsIssuer(credential, context);
    }

    if (!isAllowed) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้');
    }

    return credential;
  }

  async createDownloadUrl(params: {
    credentialId: string;
    userId: string;
    role: 'ISSUER' | 'HOLDER';
  }) {
    const credential = await this.prisma.credential.findUnique({
      where: { id: params.credentialId },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    let isAllowed = false;

    if (params.role === 'HOLDER') {
      isAllowed = credential.holderId === params.userId;
    }

    if (params.role === 'ISSUER') {
      const context = await this.getIssuerContext(params.userId);
      isAllowed = this.canViewCredentialAsIssuer(credential, context);
    }

    if (!isAllowed) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ดาวน์โหลดเอกสารนี้');
    }

    if (params.role === 'HOLDER' && credential.status !== 'VERIFIED') {
      throw new BadRequestException(
        'เอกสารยังไม่พร้อมให้ดาวน์โหลด กรุณารอการยืนยัน',
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

  async registerCredentialOnChain(params: {
    credentialId: string;
    issuerId: string;
  }) {
    const context = await this.getIssuerContext(
      params.issuerId,
      PERMISSIONS.REGISTER_CREDENTIAL,
    );

    const credential = await this.prisma.credential.findUnique({
      where: { id: params.credentialId },
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

    if (!this.canViewCredentialAsIssuer(credential, context)) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ยืนยันเอกสารนี้');
    }

    if (credential.status === 'VERIFIED') {
      throw new BadRequestException('เอกสารนี้ถูกยืนยันแล้ว');
    }

    if (credential.transactionHash) {
      throw new BadRequestException('เอกสารนี้มีเลขอ้างอิงการยืนยันแล้ว');
    }

    if (!credential.holder.walletAddress) {
      throw new BadRequestException('นักศึกษายังไม่ได้ตั้งค่าบัญชีดิจิทัล');
    }

    const blockchainResult =
      await this.blockchainService.registerCredentialOnChain({
        credentialId: credential.credentialId,
        documentHash: credential.documentHash,
        holderAddress: credential.holder.walletAddress,
      });

    const updatedCredential = await this.prisma.credential.update({
      where: { id: credential.id },
      data: {
        status: 'VERIFIED',
        network: blockchainResult.network,
        transactionHash: blockchainResult.transactionHash,
        blockNumber: blockchainResult.blockNumber,
      },
      include: {
        issuerStaff: {
          select: {
            id: true,
            email: true,
            name: true,
            staffPosition: true,
            staffDepartment: true,
          },
        },
      },
    });

    return {
      message: 'ยืนยันเอกสารสำเร็จ',
      credential: updatedCredential,
      blockchain: blockchainResult,
    };
  }

  async verifyCredentialOnChain(params: {
    credentialId: string;
    userId: string;
    role: 'ISSUER' | 'HOLDER';
  }) {
    const credential = await this.prisma.credential.findUnique({
      where: { id: params.credentialId },
      include: {
        holder: {
          select: { id: true, email: true, name: true, walletAddress: true },
        },
        issuer: {
          select: { id: true, email: true, name: true, walletAddress: true },
        },
        issuerStaff: {
          select: {
            id: true,
            email: true,
            name: true,
            staffPosition: true,
            staffDepartment: true,
          },
        },
      },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    let isAllowed = false;

    if (params.role === 'HOLDER') {
      isAllowed = credential.holderId === params.userId;
    }

    if (params.role === 'ISSUER') {
      const context = await this.getIssuerContext(params.userId);
      isAllowed = this.canViewCredentialAsIssuer(credential, context);
    }

    if (!isAllowed) {
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
        ? 'ตรวจสอบเอกสารสำเร็จ ข้อมูลตรงกับข้อมูลยืนยันของระบบ'
        : !isDatabaseVerified
          ? 'ตรวจสอบเอกสารไม่สำเร็จ เอกสารนี้ถูกเพิกถอนหรือยังไม่ถูกยืนยัน'
          : 'ตรวจสอบเอกสารไม่สำเร็จ ข้อมูลเอกสารไม่ตรงกับข้อมูลที่ยืนยันไว้',
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
        issuedByName: credential.issuedByName,
        issuedByPosition: credential.issuedByPosition,
        issuedByDepartment: credential.issuedByDepartment,
      },
      blockchain: blockchainCredential,
    };
  }

  async verifyPublicCredential(params: { credentialId: string }) {
    if (!params.credentialId) {
      throw new BadRequestException('กรุณาระบุรหัสเอกสาร');
    }

    const credential = await this.prisma.credential.findUnique({
      where: { credentialId: params.credentialId },
      include: {
        issuer: {
          select: { id: true, name: true, email: true, walletAddress: true },
        },
        holder: {
          select: { id: true, name: true, email: true, walletAddress: true },
        },
        issuerStaff: {
          select: {
            id: true,
            name: true,
            email: true,
            staffPosition: true,
            staffDepartment: true,
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
        ? 'ตรวจสอบเอกสารสำเร็จ เอกสารนี้ถูกต้องและมีข้อมูลยืนยันในระบบ'
        : !isDatabaseVerified
          ? 'ตรวจสอบเอกสารไม่สำเร็จ เอกสารนี้ถูกเพิกถอนหรือยังไม่ถูกยืนยัน'
          : 'ตรวจสอบเอกสารไม่สำเร็จ ข้อมูลเอกสารไม่ตรงกับข้อมูลที่ยืนยันไว้',
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
        issuedByName: credential.issuedByName,
        issuedByPosition: credential.issuedByPosition,
        issuedByDepartment: credential.issuedByDepartment,
      },
      issuer: {
        name: credential.issuer.name,
        walletAddress: credential.issuer.walletAddress,
      },
      issuedBy: {
        name:
          credential.issuedByName ??
          credential.issuerStaff?.name ??
          credential.issuer.name,
        email:
          credential.issuedByEmail ?? credential.issuerStaff?.email ?? null,
        position:
          credential.issuedByPosition ??
          credential.issuerStaff?.staffPosition ??
          null,
        department:
          credential.issuedByDepartment ??
          credential.issuerStaff?.staffDepartment ??
          null,
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

  async verifyPublicCredentialFile(params: {
    credentialId: string;
    file: Express.Multer.File;
  }) {
    if (!params.credentialId) {
      throw new BadRequestException('กรุณาระบุรหัสเอกสาร');
    }

    if (!params.file) {
      throw new BadRequestException('กรุณาอัปโหลดไฟล์เอกสาร');
    }

    if (params.file.mimetype !== 'application/pdf') {
      throw new BadRequestException('รองรับเฉพาะไฟล์ PDF เท่านั้น');
    }

    const credential = await this.prisma.credential.findUnique({
      where: { credentialId: params.credentialId },
      include: {
        issuer: { select: { name: true, walletAddress: true } },
        holder: { select: { name: true, walletAddress: true } },
        issuerStaff: {
          select: {
            name: true,
            email: true,
            staffPosition: true,
            staffDepartment: true,
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
        ? 'ตรวจสอบไฟล์เอกสารสำเร็จ ไฟล์นี้ถูกต้องและตรงกับข้อมูลที่ยืนยันไว้'
        : !isDatabaseVerified
          ? 'ตรวจสอบไฟล์เอกสารไม่สำเร็จ เอกสารนี้ถูกเพิกถอนหรือยังไม่ถูกยืนยัน'
          : !isUploadedFileMatched
            ? 'ตรวจสอบไฟล์เอกสารไม่สำเร็จ ไฟล์นี้ไม่ตรงกับข้อมูลที่บันทึกไว้'
            : 'ตรวจสอบไฟล์เอกสารไม่สำเร็จ ข้อมูลเอกสารไม่ตรงกับข้อมูลที่ยืนยันไว้',
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
        fileName: decodeUploadedFileName(params.file.originalname),
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
        issuedByName: credential.issuedByName,
        issuedByPosition: credential.issuedByPosition,
        issuedByDepartment: credential.issuedByDepartment,
      },
      issuer: {
        name: credential.issuer.name,
        walletAddress: credential.issuer.walletAddress,
      },
      issuedBy: {
        name:
          credential.issuedByName ??
          credential.issuerStaff?.name ??
          credential.issuer.name,
        email:
          credential.issuedByEmail ?? credential.issuerStaff?.email ?? null,
        position:
          credential.issuedByPosition ??
          credential.issuerStaff?.staffPosition ??
          null,
        department:
          credential.issuedByDepartment ??
          credential.issuerStaff?.staffDepartment ??
          null,
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

  async createShareLink(params: { credentialId: string; holderId: string }) {
    const credential = await this.prisma.credential.findUnique({
      where: { id: params.credentialId },
    });

    if (!credential) {
      throw new NotFoundException('ไม่พบข้อมูลเอกสาร');
    }

    if (credential.holderId !== params.holderId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์สร้างลิงก์ตรวจสอบเอกสารนี้');
    }

    if (credential.status !== 'VERIFIED') {
      throw new BadRequestException(
        'สามารถสร้างลิงก์ตรวจสอบได้เฉพาะเอกสารที่ยืนยันแล้วเท่านั้น',
      );
    }

    if (!credential.transactionHash) {
      throw new BadRequestException('เอกสารนี้ยังไม่มีเลขอ้างอิงการยืนยัน');
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
      message: 'สร้างลิงก์ตรวจสอบเอกสารสำเร็จ',
      shareLink: {
        token: shareLink.token,
        verifyUrl: `${baseUrl}/credentials/share/${shareLink.token}/verify`,
        expiresAt: shareLink.expiresAt,
      },
    };
  }

  async verifySharedCredential(params: {
    token: string;
    file?: Express.Multer.File;
  }) {
    if (!params.token) {
      throw new BadRequestException('กรุณาระบุลิงก์ตรวจสอบ');
    }

    const shareLink = await this.prisma.credentialShareLink.findUnique({
      where: { token: params.token },
      include: {
        credential: {
          include: {
            issuer: { select: { name: true, walletAddress: true } },
            holder: { select: { name: true, walletAddress: true } },
            issuerStaff: {
              select: {
                name: true,
                email: true,
                staffPosition: true,
                staffDepartment: true,
              },
            },
          },
        },
      },
    });

    if (!shareLink) {
      throw new NotFoundException('ไม่พบลิงก์ตรวจสอบเอกสาร');
    }

    if (shareLink.revokedAt) {
      throw new BadRequestException('ลิงก์ตรวจสอบเอกสารนี้ถูกยกเลิกแล้ว');
    }

    if (shareLink.expiresAt < new Date()) {
      throw new BadRequestException('ลิงก์ตรวจสอบเอกสารนี้หมดอายุแล้ว');
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

    let uploadedFileHash: string | undefined;
    let isUploadedFileMatched: boolean | undefined;

    if (params.file) {
      if (params.file.mimetype !== 'application/pdf') {
        throw new BadRequestException('รองรับเฉพาะไฟล์ PDF เท่านั้น');
      }

      uploadedFileHash = createHash('sha256')
        .update(params.file.buffer)
        .digest('hex');
      isUploadedFileMatched =
        uploadedFileHash.toLowerCase() ===
        credential.documentHash.toLowerCase();
    }

    const isValid =
      isDocumentHashMatched &&
      isHolderAddressMatched &&
      isDatabaseVerified &&
      hasTransaction &&
      (isUploadedFileMatched ?? true);

    return {
      message: isValid
        ? params.file
          ? 'ตรวจสอบเอกสารจากลิงก์สำเร็จ ไฟล์ PDF ตรงกับข้อมูลที่ยืนยันไว้'
          : 'ตรวจสอบเอกสารจากลิงก์สำเร็จ เอกสารนี้ถูกต้องและมีข้อมูลยืนยันในระบบ'
        : !isDatabaseVerified
          ? 'ตรวจสอบเอกสารจากลิงก์ไม่สำเร็จ เอกสารนี้ถูกเพิกถอนหรือยังไม่ถูกยืนยัน'
          : isUploadedFileMatched === false
            ? 'ตรวจสอบเอกสารจากลิงก์ไม่สำเร็จ ไฟล์ PDF ไม่ตรงกับข้อมูลที่ยืนยันไว้'
            : 'ตรวจสอบเอกสารจากลิงก์ไม่สำเร็จ ข้อมูลไม่ตรงกับข้อมูลที่ยืนยันไว้',
      isValid,
      verifiedAt: new Date().toISOString(),
      shareLink: { expiresAt: shareLink.expiresAt },
      checks: {
        uploadedFileMatched: isUploadedFileMatched,
        documentHashMatched: isDocumentHashMatched,
        holderAddressMatched: isHolderAddressMatched,
        databaseStatusVerified: isDatabaseVerified,
        hasTransaction,
      },
      uploadedFile: params.file
        ? {
            fileName: decodeUploadedFileName(params.file.originalname),
            fileSize: params.file.size,
            mimeType: params.file.mimetype,
            sha256Hash: uploadedFileHash,
          }
        : undefined,
      credential: {
        credentialId: credential.credentialId,
        documentTitle: credential.documentTitle,
        studentName: credential.studentName,
        studentId: credential.studentId,
        faculty: credential.faculty,
        major: credential.major,
        issuedAt: credential.issuedAt,
        status: credential.status,
        issuedByName: credential.issuedByName,
        issuedByPosition: credential.issuedByPosition,
        issuedByDepartment: credential.issuedByDepartment,
      },
      issuer: {
        name: credential.issuer.name,
        walletAddress: credential.issuer.walletAddress,
      },
      issuedBy: {
        name:
          credential.issuedByName ??
          credential.issuerStaff?.name ??
          credential.issuer.name,
        email:
          credential.issuedByEmail ?? credential.issuerStaff?.email ?? null,
        position:
          credential.issuedByPosition ??
          credential.issuerStaff?.staffPosition ??
          null,
        department:
          credential.issuedByDepartment ??
          credential.issuerStaff?.staffDepartment ??
          null,
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

  async revokeShareLink(params: { token: string; holderId: string }) {
    if (!params.token) {
      throw new BadRequestException('กรุณาระบุลิงก์ตรวจสอบ');
    }

    const shareLink = await this.prisma.credentialShareLink.findUnique({
      where: { token: params.token },
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
      throw new NotFoundException('ไม่พบลิงก์ตรวจสอบเอกสาร');
    }

    if (shareLink.holderId !== params.holderId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ยกเลิกลิงก์นี้');
    }

    if (shareLink.revokedAt) {
      throw new BadRequestException('ลิงก์ตรวจสอบเอกสารนี้ถูกยกเลิกไปแล้ว');
    }

    const updatedShareLink = await this.prisma.credentialShareLink.update({
      where: { token: params.token },
      data: { revokedAt: new Date() },
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
      message: 'ยกเลิกลิงก์ตรวจสอบเอกสารสำเร็จ',
      shareLink: {
        token: updatedShareLink.token,
        revokedAt: updatedShareLink.revokedAt,
        expiresAt: updatedShareLink.expiresAt,
      },
      credential: updatedShareLink.credential,
    };
  }

  async listShareLinks(params: { credentialId: string; holderId: string }) {
    const credential = await this.prisma.credential.findUnique({
      where: { id: params.credentialId },
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
        'คุณไม่มีสิทธิ์ดูรายการลิงก์ตรวจสอบของเอกสารนี้',
      );
    }

    const shareLinks = await this.prisma.credentialShareLink.findMany({
      where: { credentialId: credential.id, holderId: params.holderId },
      orderBy: { createdAt: 'desc' },
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
      message: 'ดึงรายการลิงก์ตรวจสอบเอกสารสำเร็จ',
      credential: {
        id: credential.id,
        credentialId: credential.credentialId,
        documentTitle: credential.documentTitle,
        studentName: credential.studentName,
        status: credential.status,
      },
      total: shareLinks.length,
      shareLinks: shareLinks.map((link) => ({
        token: link.token,
        verifyUrl: `${baseUrl}/credentials/share/${link.token}/verify`,
        status: link.revokedAt
          ? 'REVOKED'
          : link.expiresAt < now
            ? 'EXPIRED'
            : 'ACTIVE',
        expiresAt: link.expiresAt,
        revokedAt: link.revokedAt,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      })),
    };
  }

  async invalidateCredential(params: {
    credentialId: string;
    issuerId: string;
  }) {
    const context = await this.getIssuerContext(
      params.issuerId,
      PERMISSIONS.INVALIDATE_CREDENTIAL,
    );

    const credential = await this.prisma.credential.findUnique({
      where: { id: params.credentialId },
      select: {
        id: true,
        credentialId: true,
        issuerId: true,
        issuerStaffId: true,
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

    if (!this.canViewCredentialAsIssuer(credential, context)) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เพิกถอนเอกสารนี้');
    }

    if (credential.status === 'INVALID') {
      throw new BadRequestException('เอกสารนี้ถูกเพิกถอนไปแล้ว');
    }

    const revokedAt = new Date();

    await this.prisma.credentialShareLink.updateMany({
      where: { credentialId: credential.id, revokedAt: null },
      data: { revokedAt },
    });

    const updatedCredential = await this.prisma.credential.update({
      where: { id: credential.id },
      data: { status: 'INVALID' },
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
