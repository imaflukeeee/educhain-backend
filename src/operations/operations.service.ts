import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async universityId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { universityId: true, role: true },
    });
    if (!user || user.role !== 'ISSUER' || !user.universityId) {
      throw new BadRequestException('ไม่พบมหาวิทยาลัยของผู้ใช้งาน');
    }
    return user.universityId;
  }

  async dashboard(userId: string) {
    const universityId = await this.universityId(userId);
    const issuerIds = (
      await this.prisma.user.findMany({
        where: { universityId, role: 'ISSUER' },
        select: { id: true },
      })
    ).map((user) => user.id);

    const [
      studentsTotal,
      studentsClaimed,
      studentsUnclaimed,
      studentsReview,
      draft,
      pendingReview,
      pendingApproval,
      changesRequested,
      approved,
      issued,
      recentAudit,
    ] = await Promise.all([
      this.prisma.studentRecord.count({ where: { universityId } }),
      this.prisma.studentRecord.count({ where: { universityId, claimStatus: 'CLAIMED' } }),
      this.prisma.studentRecord.count({ where: { universityId, claimStatus: 'UNCLAIMED' } }),
      this.prisma.studentRecord.count({ where: { universityId, claimStatus: 'REVIEW_REQUIRED' } }),
      this.prisma.credential.count({ where: { issuerId: { in: issuerIds }, workflowStatus: 'DRAFT' } }),
      this.prisma.credential.count({ where: { issuerId: { in: issuerIds }, workflowStatus: 'PENDING_REVIEW' } }),
      this.prisma.credential.count({ where: { issuerId: { in: issuerIds }, workflowStatus: 'PENDING_APPROVAL' } }),
      this.prisma.credential.count({ where: { issuerId: { in: issuerIds }, workflowStatus: 'CHANGES_REQUESTED' } }),
      this.prisma.credential.count({ where: { issuerId: { in: issuerIds }, workflowStatus: 'APPROVED' } }),
      this.prisma.credential.count({ where: { issuerId: { in: issuerIds }, workflowStatus: 'ISSUED' } }),
      this.prisma.auditLog.findMany({
        where: { universityId },
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      students: {
        total: studentsTotal,
        claimed: studentsClaimed,
        unclaimed: studentsUnclaimed,
        reviewRequired: studentsReview,
      },
      workflow: {
        draft,
        pendingReview,
        pendingApproval,
        changesRequested,
        approved,
        issued,
      },
      recentAudit,
    };
  }

  async notifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markNotificationRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }
}
