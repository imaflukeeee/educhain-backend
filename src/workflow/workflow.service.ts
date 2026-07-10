import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  private async context(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, universityId: true, role: true, permissions: true, issuerAccountType: true },
    });
    if (!user || user.role !== 'ISSUER' || !user.universityId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ใช้งาน Workflow');
    }
    return user;
  }

  private can(user: { permissions: string[]; issuerAccountType: string | null }, permission: string) {
    return user.issuerAccountType === 'UNIVERSITY_ADMIN' || user.permissions.includes(permission);
  }

  async list(userId: string, status?: string) {
    const user = await this.context(userId);
    const issuerIds = (
      await this.prisma.user.findMany({
        where: { universityId: user.universityId, role: 'ISSUER' },
        select: { id: true },
      })
    ).map((item) => item.id);

    return this.prisma.credential.findMany({
      where: {
        issuerId: { in: issuerIds },
        ...(status ? { workflowStatus: status as never } : {}),
      },
      include: {
        holder: { select: { name: true, email: true, studentId: true } },
        preparedBy: { select: { name: true, email: true } },
        reviewedBy: { select: { name: true, email: true } },
        approvedBy: { select: { name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async transition(userId: string, credentialId: string, action: string, note?: string) {
    const user = await this.context(userId);
    const credential = await this.prisma.credential.findUnique({ where: { id: credentialId } });
    if (!credential) throw new NotFoundException('ไม่พบเอกสาร');

    const issuer = await this.prisma.user.findUnique({
      where: { id: credential.issuerId },
      select: { universityId: true },
    });
    if (issuer?.universityId !== user.universityId) {
      throw new ForbiddenException('ไม่สามารถจัดการเอกสารของมหาวิทยาลัยอื่น');
    }

    const now = new Date();
    let data: any;
    let auditAction:
      | 'WORKFLOW_SUBMITTED'
      | 'WORKFLOW_REVIEWED'
      | 'WORKFLOW_APPROVED'
      | 'WORKFLOW_REJECTED'
      | 'WORKFLOW_CHANGES_REQUESTED';

    if (action === 'submit-review') {
      if (!this.can(user, 'PREPARE_CREDENTIAL')) throw new ForbiddenException('ไม่มีสิทธิ์จัดเตรียมเอกสาร');
      if (!['DRAFT', 'CHANGES_REQUESTED'].includes(credential.workflowStatus)) throw new BadRequestException('สถานะเอกสารไม่รองรับ');
      data = { workflowStatus: 'PENDING_REVIEW', preparedById: user.id, submittedAt: now, workflowNote: note || null };
      auditAction = 'WORKFLOW_SUBMITTED';
    } else if (action === 'request-changes') {
      if (!this.can(user, 'REVIEW_CREDENTIAL')) throw new ForbiddenException('ไม่มีสิทธิ์ตรวจสอบเอกสาร');
      if (!['PENDING_REVIEW', 'PENDING_APPROVAL'].includes(credential.workflowStatus)) throw new BadRequestException('สถานะเอกสารไม่รองรับ');
      data = { workflowStatus: 'CHANGES_REQUESTED', reviewedById: user.id, reviewedAt: now, workflowNote: note || null };
      auditAction = 'WORKFLOW_CHANGES_REQUESTED';
    } else if (action === 'pass-review') {
      if (!this.can(user, 'REVIEW_CREDENTIAL')) throw new ForbiddenException('ไม่มีสิทธิ์ตรวจสอบเอกสาร');
      if (credential.workflowStatus !== 'PENDING_REVIEW') throw new BadRequestException('เอกสารไม่ได้อยู่ในขั้นตรวจสอบ');
      data = { workflowStatus: 'PENDING_APPROVAL', reviewedById: user.id, reviewedAt: now, workflowNote: note || null };
      auditAction = 'WORKFLOW_REVIEWED';
    } else if (action === 'approve') {
      if (!this.can(user, 'APPROVE_CREDENTIAL')) throw new ForbiddenException('ไม่มีสิทธิ์อนุมัติเอกสาร');
      if (credential.workflowStatus !== 'PENDING_APPROVAL') throw new BadRequestException('เอกสารไม่ได้อยู่ในขั้นอนุมัติ');
      data = { workflowStatus: 'APPROVED', approvedById: user.id, approvedAt: now, workflowNote: note || null };
      auditAction = 'WORKFLOW_APPROVED';
    } else if (action === 'reject') {
      if (!this.can(user, 'APPROVE_CREDENTIAL')) throw new ForbiddenException('ไม่มีสิทธิ์ปฏิเสธเอกสาร');
      data = { workflowStatus: 'REJECTED', approvedById: user.id, approvedAt: now, workflowNote: note || null };
      auditAction = 'WORKFLOW_REJECTED';
    } else {
      throw new BadRequestException('ไม่รู้จักคำสั่ง Workflow');
    }

    const updated = await this.prisma.credential.update({
      where: { id: credential.id },
      data,
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        universityId: user.universityId,
        action: auditAction,
        entityType: 'Credential',
        entityId: credential.id,
        beforeData: JSON.parse(JSON.stringify(credential)),
        afterData: JSON.parse(JSON.stringify(updated)),
      },
    });

    return updated;
  }
}
