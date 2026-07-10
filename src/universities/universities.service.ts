import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UniversitiesService {
  constructor(private readonly prisma: PrismaService) {}

  listMaster() {
    return this.prisma.universityMaster.findMany({ where: { isActive: true }, orderBy: { nameTh: 'asc' } });
  }

  listRegistered() {
    return this.prisma.university.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { master: { nameTh: 'asc' } },
      select: { id: true, master: { select: { nameTh: true, nameEn: true } } },
    });
  }

  async getMaster(id: string) {
    const item = await this.prisma.universityMaster.findFirst({ where: { id, isActive: true } });
    if (!item) throw new NotFoundException('ไม่พบมหาวิทยาลัยที่เลือก');
    return item;
  }

  listFaculties(universityId: string, includeInactive = false) {
    return this.prisma.faculty.findMany({
      where: { universityId, ...(includeInactive ? {} : { isActive: true }) },
      include: { majors: { where: includeInactive ? {} : { isActive: true }, orderBy: { nameTh: 'asc' } } },
      orderBy: { nameTh: 'asc' },
    });
  }

  listMajors(facultyId: string) {
    return this.prisma.major.findMany({ where: { facultyId, isActive: true }, orderBy: { nameTh: 'asc' } });
  }

  async getUniversityForUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { universityId: true, universityOwnerId: true, issuerAccountType: true } });
    if (!user) throw new ForbiddenException('ไม่พบบัญชีผู้ใช้งาน');
    if (user.universityId) return user.universityId;
    if (user.universityOwnerId) {
      const owner = await this.prisma.user.findUnique({ where: { id: user.universityOwnerId }, select: { universityId: true } });
      if (owner?.universityId) return owner.universityId;
    }
    throw new ForbiddenException('บัญชียังไม่ได้ผูกกับมหาวิทยาลัย');
  }

  async createFaculty(userId: string, data: { nameTh: string; nameEn?: string }) {
    const universityId = await this.getUniversityForUser(userId);
    return this.prisma.faculty.create({ data: { universityId, nameTh: data.nameTh.trim(), nameEn: data.nameEn?.trim() || null } });
  }

  async createMajor(userId: string, data: { facultyId: string; nameTh: string; nameEn?: string }) {
    const universityId = await this.getUniversityForUser(userId);
    const faculty = await this.prisma.faculty.findFirst({ where: { id: data.facultyId, universityId } });
    if (!faculty) throw new NotFoundException('ไม่พบคณะของมหาวิทยาลัยนี้');
    return this.prisma.major.create({ data: { facultyId: faculty.id, nameTh: data.nameTh.trim(), nameEn: data.nameEn?.trim() || null } });
  }

  async setFacultyActive(userId: string, id: string, isActive: boolean) {
    const universityId = await this.getUniversityForUser(userId);
    const faculty = await this.prisma.faculty.findFirst({ where: { id, universityId } });
    if (!faculty) throw new NotFoundException('ไม่พบคณะ');
    return this.prisma.faculty.update({ where: { id }, data: { isActive } });
  }

  async setMajorActive(userId: string, id: string, isActive: boolean) {
    const universityId = await this.getUniversityForUser(userId);
    const major = await this.prisma.major.findFirst({ where: { id, faculty: { universityId } } });
    if (!major) throw new NotFoundException('ไม่พบสาขาวิชา');
    return this.prisma.major.update({ where: { id }, data: { isActive } });
  }
}
