import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateBatchStatusDto } from './dto/update-batch-status.dto';
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

    if (dto.status === 'REJECTED' && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('กรุณาระบุเหตุผลที่ไม่อนุมัติคำร้อง');
    }

    const now = new Date();
    const updated = await this.prisma.documentRequest.update({
      where: { id: request.id },
      data: {
        status: dto.status,
        assignedToId: dto.assignedToId || context.userId,
        staffNote: dto.staffNote?.trim() || null,
        rejectionReason:
          dto.status === 'REJECTED'
            ? dto.rejectionReason?.trim() || null
            : null,
        receivedAt:
          dto.status === 'RECEIVED' && !request.receivedAt
            ? now
            : request.receivedAt,
        completedAt: dto.status === 'COMPLETED' ? now : null,
      },
    });

    return { message: 'อัปเดตสถานะคำร้องเรียบร้อยแล้ว', request: updated };
  }

  async createTemplate(userId: string, dto: CreateTemplateDto) {
    const context = await this.getIssuerContext(userId);
    const template = await this.prisma.documentTemplate.create({
      data: {
        universityId: context.universityId,
        createdById: context.userId,
        name: dto.name.trim(),
        documentType: dto.documentType,
        customTypeName: dto.customTypeName?.trim() || null,
        description: dto.description?.trim() || null,
        content: dto.content,
      },
    });
    return { message: 'สร้างแม่แบบเอกสารเรียบร้อยแล้ว', template };
  }

  async listTemplates(userId: string) {
    const context = await this.getIssuerContext(userId);
    return this.prisma.documentTemplate.findMany({
      where: { universityId: context.universityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteTemplate(userId: string, templateId: string) {
    const context = await this.getIssuerContext(userId);
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, universityId: context.universityId },
      include: { _count: { select: { batches: true } } },
    });
    if (!template) throw new NotFoundException('ไม่พบแม่แบบเอกสาร');
    if (template._count.batches > 0) {
      throw new BadRequestException(
        'แม่แบบนี้ถูกใช้งานแล้ว กรุณาเปลี่ยนเป็นปิดใช้งานแทนการลบ',
      );
    }
    await this.prisma.documentTemplate.delete({ where: { id: template.id } });
    return { message: 'ลบแม่แบบเอกสารเรียบร้อยแล้ว' };
  }

  async createBatch(userId: string, dto: CreateBatchDto) {
    const context = await this.getIssuerContext(userId);

    if (dto.templateId) {
      const template = await this.prisma.documentTemplate.findFirst({
        where: {
          id: dto.templateId,
          universityId: context.universityId,
          status: 'ACTIVE',
        },
      });
      if (!template) throw new BadRequestException('แม่แบบเอกสารไม่พร้อมใช้งาน');
    }

    const totalCount = await this.prisma.studentRecord.count({
      where: {
        universityId: context.universityId,
        isActive: true,
        ...(dto.facultyId ? { facultyId: dto.facultyId } : {}),
        ...(dto.majorId ? { majorId: dto.majorId } : {}),
      },
    });

    const batch = await this.prisma.credentialBatch.create({
      data: {
        universityId: context.universityId,
        createdById: context.userId,
        templateId: dto.templateId || null,
        name: dto.name.trim(),
        documentType: dto.documentType,
        academicYear: dto.academicYear?.trim() || null,
        facultyId: dto.facultyId || null,
        majorId: dto.majorId || null,
        note: dto.note?.trim() || null,
        totalCount,
      },
      include: { template: true },
    });

    return {
      message: `สร้างชุดเอกสารแล้ว พบรายชื่อนักศึกษา ${totalCount} รายการ`,
      batch,
    };
  }

  async listBatches(userId: string) {
    const context = await this.getIssuerContext(userId);
    return this.prisma.credentialBatch.findMany({
      where: { universityId: context.universityId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: true,
        createdBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateBatchStatus(
    userId: string,
    batchId: string,
    dto: UpdateBatchStatusDto,
  ) {
    const context = await this.getIssuerContext(userId);
    const batch = await this.prisma.credentialBatch.findFirst({
      where: { id: batchId, universityId: context.universityId },
    });
    if (!batch) throw new NotFoundException('ไม่พบชุดเอกสาร');

    const now = new Date();
    const updated = await this.prisma.credentialBatch.update({
      where: { id: batch.id },
      data: {
        status: dto.status,
        note: dto.note?.trim() || batch.note,
        reviewedById:
          dto.status === 'PENDING_APPROVAL'
            ? context.userId
            : batch.reviewedById,
        reviewedAt:
          dto.status === 'PENDING_APPROVAL' ? now : batch.reviewedAt,
        approvedById:
          dto.status === 'PROCESSING' ? context.userId : batch.approvedById,
        approvedAt:
          dto.status === 'PROCESSING' ? now : batch.approvedAt,
        completedAt:
          ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'].includes(dto.status)
            ? now
            : null,
      },
    });

    return { message: 'อัปเดตสถานะชุดเอกสารเรียบร้อยแล้ว', batch: updated };
  }
}
