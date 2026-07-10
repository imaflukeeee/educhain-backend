CREATE TYPE "DocumentRequestType" AS ENUM (
  'STUDENT_STATUS_CERTIFICATE',
  'TRANSCRIPT',
  'DEGREE_CERTIFICATE',
  'GRADUATION_CERTIFICATE',
  'STUDENT_CARD',
  'OTHER'
);

CREATE TYPE "DocumentRequestStatus" AS ENUM (
  'SUBMITTED',
  'RECEIVED',
  'IN_PROGRESS',
  'NEED_MORE_INFORMATION',
  'REJECTED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "CredentialBatchStatus" AS ENUM (
  'DRAFT',
  'PREPARING',
  'PENDING_REVIEW',
  'PENDING_APPROVAL',
  'PROCESSING',
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'FAILED'
);

CREATE TYPE "DocumentTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "Credential"
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "batchId" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "parentCredentialId" TEXT,
  ADD COLUMN "replacedById" TEXT,
  ADD COLUMN "revokedReason" TEXT,
  ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE TABLE "DocumentRequest" (
  "id" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "holderId" TEXT NOT NULL,
  "type" "DocumentRequestType" NOT NULL,
  "customTypeName" TEXT,
  "purpose" TEXT,
  "details" TEXT,
  "status" "DocumentRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "assignedToId" TEXT,
  "staffNote" TEXT,
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentTemplate" (
  "id" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "documentType" "DocumentRequestType" NOT NULL,
  "customTypeName" TEXT,
  "description" TEXT,
  "content" TEXT NOT NULL,
  "status" "DocumentTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CredentialBatch" (
  "id" TEXT NOT NULL,
  "universityId" TEXT NOT NULL,
  "templateId" TEXT,
  "name" TEXT NOT NULL,
  "documentType" "DocumentRequestType" NOT NULL,
  "academicYear" TEXT,
  "facultyId" TEXT,
  "majorId" TEXT,
  "status" "CredentialBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "approvedById" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CredentialBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Credential_requestId_key" ON "Credential"("requestId");
CREATE UNIQUE INDEX "Credential_replacedById_key" ON "Credential"("replacedById");
CREATE UNIQUE INDEX "DocumentTemplate_universityId_name_key" ON "DocumentTemplate"("universityId", "name");
CREATE INDEX "DocumentRequest_universityId_status_createdAt_idx" ON "DocumentRequest"("universityId", "status", "createdAt");
CREATE INDEX "DocumentRequest_holderId_createdAt_idx" ON "DocumentRequest"("holderId", "createdAt");
CREATE INDEX "DocumentRequest_assignedToId_idx" ON "DocumentRequest"("assignedToId");
CREATE INDEX "DocumentTemplate_universityId_status_idx" ON "DocumentTemplate"("universityId", "status");
CREATE INDEX "CredentialBatch_universityId_status_createdAt_idx" ON "CredentialBatch"("universityId", "status", "createdAt");
CREATE INDEX "CredentialBatch_templateId_idx" ON "CredentialBatch"("templateId");
CREATE INDEX "Credential_batchId_idx" ON "Credential"("batchId");
CREATE INDEX "Credential_parentCredentialId_idx" ON "Credential"("parentCredentialId");

ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CredentialBatch" ADD CONSTRAINT "CredentialBatch_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CredentialBatch" ADD CONSTRAINT "CredentialBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CredentialBatch" ADD CONSTRAINT "CredentialBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CredentialBatch" ADD CONSTRAINT "CredentialBatch_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CredentialBatch" ADD CONSTRAINT "CredentialBatch_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CredentialBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_parentCredentialId_fkey" FOREIGN KEY ("parentCredentialId") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
