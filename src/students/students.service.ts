import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentRecordDto } from './dto/create-student-record.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getIssuerUniversity(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { universityId: true, role: true },
    });

    if (!user || user.role !== 'ISSUER' || !user.universityId) {
      throw new BadRequestException('ไม่พบมหาวิทยาลัยของผู้ใช้งาน');
    }

    return user.universityId;
  }

  async list(userId: string, claimStatus?: string) {
    const universityId = await this.getIssuerUniversity(userId);
    const allowed = ['UNCLAIMED', 'CLAIMED', 'REVIEW_REQUIRED', 'REJECTED'];

    return this.prisma.studentRecord.findMany({
      where: {
        universityId,
        ...(claimStatus && allowed.includes(claimStatus)
          ? { claimStatus: claimStatus as 'UNCLAIMED' | 'CLAIMED' | 'REVIEW_REQUIRED' | 'REJECTED' }
          : {}),
      },
      include: {
        faculty: true,
        major: true,
        claimedBy: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateStudentRecordDto, imported = false) {
    const universityId = await this.getIssuerUniversity(userId);

    const duplicate = await this.prisma.studentRecord.findUnique({
      where: {
        universityId_studentId: {
          universityId,
          studentId: dto.studentId.trim(),
        },
      },
    });

    if (duplicate) {
      throw new ConflictException(`รหัสนักศึกษา ${dto.studentId} มีอยู่แล้ว`);
    }

    const record = await this.prisma.studentRecord.create({
      data: {
        universityId,
        studentId: dto.studentId.trim(),
        namePrefix: dto.namePrefix,
        firstNameTh: dto.firstNameTh.trim(),
        lastNameTh: dto.lastNameTh.trim(),
        firstNameEn: dto.firstNameEn?.trim() || null,
        lastNameEn: dto.lastNameEn?.trim() || null,
        birthDate: new Date(dto.birthDate),
        nationalIdHash: dto.nationalId
          ? createHash('sha256').update(dto.nationalId.trim()).digest('hex')
          : null,
        email: dto.email?.trim().toLowerCase() || null,
        facultyId: dto.facultyId || null,
        majorId: dto.majorId || null,
        createdById: userId,
      },
      include: { faculty: true, major: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        universityId,
        action: imported ? 'STUDENT_IMPORTED' : 'STUDENT_CREATED',
        entityType: 'StudentRecord',
        entityId: record.id,
        afterData: JSON.parse(JSON.stringify(record)),
      },
    });

    return record;
  }

  async importRows(userId: string, rows: CreateStudentRecordDto[]) {
    if (!rows.length) {
      throw new BadRequestException('ไม่พบข้อมูลสำหรับนำเข้า');
    }

    if (rows.length > 2000) {
      throw new BadRequestException('นำเข้าได้สูงสุดครั้งละ 2,000 รายการ');
    }

    const results: Array<{ row: number; success: boolean; studentId: string; error?: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      try {
        await this.create(userId, row, true);
        results.push({ row: index + 1, success: true, studentId: row.studentId });
      } catch (error) {
        results.push({
          row: index + 1,
          success: false,
          studentId: row.studentId,
          error: error instanceof Error ? error.message : 'นำเข้าไม่สำเร็จ',
        });
      }
    }

    return {
      total: rows.length,
      success: results.filter((item) => item.success).length,
      failed: results.filter((item) => !item.success).length,
      results,
    };
  }

  async reviewClaim(userId: string, recordId: string, approve: boolean) {
    const universityId = await this.getIssuerUniversity(userId);
    const record = await this.prisma.studentRecord.findFirst({
      where: { id: recordId, universityId },
    });

    if (!record) {
      throw new NotFoundException('ไม่พบข้อมูลนักศึกษา');
    }

    const updated = await this.prisma.studentRecord.update({
      where: { id: record.id },
      data: {
        claimStatus: approve ? 'UNCLAIMED' : 'REJECTED',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        universityId,
        action: 'CLAIM_REVIEWED',
        entityType: 'StudentRecord',
        entityId: record.id,
        beforeData: JSON.parse(JSON.stringify(record)),
        afterData: JSON.parse(JSON.stringify(updated)),
      },
    });

    return updated;
  }
}
