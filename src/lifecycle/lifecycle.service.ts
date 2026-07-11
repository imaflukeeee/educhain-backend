import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { UpdateDocumentRequestDto } from './dto/update-document-request.dto';

@Injectable()
export class LifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  private async getIssuerContext(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        issuerAccountType: true,
        universityId: true,
        universityOwnerId: true,
        isActive: true,
      },
    });

    if (!user || user.role !== 'ISSUER' || user.isActive === false) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ใช้งานส่วนมหาวิทยาลัย');
    }

    const universityId =
      user.universityId ??
      (user.issuerAccountType === 'REGISTRAR_STAFF'
        ? user.universityOwnerId
        : null);

    if (!universityId) {
      const owned = await this.prisma.university.findUnique({
        where: { ownerUserId: user.id },
        select: { id: true },
      });

      if (!owned) {
        throw new ForbiddenException('ไม่พบมหาวิทยาลัยที่เชื่อมกับบัญชีนี้');
      }

      return { userId: user.id, universityId: owned.id };
    }

    return { userId: user.id, universityId };
  }

  async createHolderRequest(holderId: string, dto: CreateDocumentRequestDto) {
    const holder = await this.prisma.user.findUnique({
      where: { id: holderId },
      select: { id: true, role: true, universityId: true },
    });

    if (!holder || holder.role !== 'HOLDER') {
      throw new ForbiddenException('เฉพาะบัญชีนักศึกษาเท่านั้น');
    }

    if (!holder.universityId) {
      throw new BadRequestException(
        'บัญชียังไม่ได้เชื่อมกับมหาวิทยาลัย จึงไม่สามารถส่งคำร้องได้',
      );
    }

    const request = await this.prisma.documentRequest.create({
      data: {
        universityId: holder.universityId,
        holderId,
        type: dto.type,
        customTypeName:
          dto.type === 'OTHER' ? dto.customTypeName?.trim() || null : null,
        purpose: dto.purpose?.trim() || null,
        details: dto.details?.trim() || null,
      },
      include: {
        university: { include: { master: true } },
      },
    });

    return { message: 'ส่งคำร้องเอกสารเรียบร้อยแล้ว', request };
  }

  listHolderRequests(holderId: string) {
    return this.prisma.documentRequest.findMany({
      where: { holderId },
      orderBy: { createdAt: 'desc' },
      include: {
        university: { include: { master: true } },
        credential: {
          select: {
            id: true,
            credentialId: true,
            documentTitle: true,
            status: true,
          },
        },
      },
    });
  }

  async cancelHolderRequest(holderId: string, requestId: string) {
    const request = await this.prisma.documentRequest.findFirst({
      where: { id: requestId, holderId },
    });

    if (!request) {
      throw new NotFoundException('ไม่พบคำร้องเอกสาร');
    }

    if (!['SUBMITTED', 'NEED_MORE_INFORMATION'].includes(request.status)) {
      throw new BadRequestException('คำร้องนี้ไม่สามารถยกเลิกได้แล้ว');
    }

    return this.prisma.documentRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  async listIssuerRequests(userId: string, status?: string) {
    const context = await this.getIssuerContext(userId);

    return this.prisma.documentRequest.findMany({
      where: {
        universityId: context.universityId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        holder: {
          select: {
            id: true,
            name: true,
            email: true,
            studentId: true,
            faculty: true,
            major: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        credential: {
          select: {
            id: true,
            credentialId: true,
            documentTitle: true,
            status: true,
          },
        },
      },
    });
  }

  async updateIssuerRequest(
    userId: string,
    requestId: string,
    dto: UpdateDocumentRequestDto,
  ) {
    const context = await this.getIssuerContext(userId);
    const request = await this.prisma.documentRequest.findFirst({
      where: { id: requestId, universityId: context.universityId },
    });

    if (!request) {
      throw new NotFoundException('ไม่พบคำร้องเอกสาร');
    }

    const nextStatus = dto.status ?? request.status;

    if (nextStatus === 'REJECTED' && !dto.rejectionReason?.trim() && !request.rejectionReason) {
      throw new BadRequestException('กรุณาระบุเหตุผลที่ไม่อนุมัติคำร้อง');
    }

    if (dto.type === 'OTHER' && !dto.customTypeName?.trim() && !request.customTypeName) {
      throw new BadRequestException('กรุณาระบุชื่อเอกสาร');
    }

    const now = new Date();
    const updated = await this.prisma.documentRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        type: dto.type,
        customTypeName:
          dto.type === 'OTHER'
            ? dto.customTypeName?.trim() || request.customTypeName
            : dto.type
              ? null
              : undefined,
        purpose: dto.purpose !== undefined ? dto.purpose.trim() || null : undefined,
        details: dto.details !== undefined ? dto.details.trim() || null : undefined,
        assignedToId: dto.assignedToId || context.userId,
        staffNote: dto.staffNote !== undefined ? dto.staffNote.trim() || null : undefined,
        rejectionReason:
          nextStatus === 'REJECTED'
            ? dto.rejectionReason?.trim() || request.rejectionReason
            : dto.status
              ? null
              : undefined,
        receivedAt:
          nextStatus === 'RECEIVED' && !request.receivedAt
            ? now
            : request.receivedAt,
        completedAt: nextStatus === 'COMPLETED' ? now : null,
      },
    });

    return { message: 'อัปเดตสถานะคำร้องเรียบร้อยแล้ว', request: updated };
  }

}
