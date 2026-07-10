-- Phase 2: University, faculty, major and structured address
CREATE TYPE "UniversityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "User"
  ADD COLUMN "addressDetail" TEXT,
  ADD COLUMN "province" TEXT,
  ADD COLUMN "district" TEXT,
  ADD COLUMN "subDistrict" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "nationalIdHash" TEXT,
  ADD COLUMN "universityId" TEXT;

CREATE TABLE "UniversityMaster" (
  "id" TEXT NOT NULL,
  "nameTh" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UniversityMaster_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UniversityMaster_nameTh_key" ON "UniversityMaster"("nameTh");

CREATE TABLE "University" (
  "id" TEXT NOT NULL,
  "masterId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "phone" TEXT,
  "website" TEXT,
  "addressDetail" TEXT,
  "province" TEXT,
  "district" TEXT,
  "subDistrict" TEXT,
  "postalCode" TEXT,
  "status" "UniversityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "University_ownerUserId_key" ON "University"("ownerUserId");
CREATE INDEX "University_masterId_idx" ON "University"("masterId");
CREATE INDEX "University_status_idx" ON "University"("status");

CREATE TABLE "Faculty" (
  "id" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "nameTh" TEXT NOT NULL,
  "nameEn" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Faculty_universityId_nameTh_key" ON "Faculty"("universityId", "nameTh");
CREATE INDEX "Faculty_universityId_isActive_idx" ON "Faculty"("universityId", "isActive");

CREATE TABLE "Major" (
  "id" TEXT NOT NULL,
  "facultyId" TEXT NOT NULL,
  "nameTh" TEXT NOT NULL,
  "nameEn" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Major_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Major_facultyId_nameTh_key" ON "Major"("facultyId", "nameTh");
CREATE INDEX "Major_facultyId_isActive_idx" ON "Major"("facultyId", "isActive");

CREATE INDEX "User_universityId_idx" ON "User"("universityId");
CREATE INDEX "User_studentId_universityId_idx" ON "User"("studentId", "universityId");

ALTER TABLE "University" ADD CONSTRAINT "University_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "UniversityMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "University" ADD CONSTRAINT "University_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Major" ADD CONSTRAINT "Major_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
