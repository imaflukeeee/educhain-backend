-- Phase 3: students, automatic claim, workflow, notifications and audit log
CREATE TYPE "StudentClaimStatus" AS ENUM ('UNCLAIMED','CLAIMED','REVIEW_REQUIRED','REJECTED');
CREATE TYPE "CredentialWorkflowStatus" AS ENUM ('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED','PENDING_APPROVAL','REJECTED','APPROVED','ISSUED');
CREATE TYPE "NotificationType" AS ENUM ('STUDENT_CLAIMED','CLAIM_REVIEW_REQUIRED','CREDENTIAL_REVIEW','CREDENTIAL_APPROVAL','CREDENTIAL_CHANGES','CREDENTIAL_ISSUED','SYSTEM');
CREATE TYPE "AuditAction" AS ENUM ('STUDENT_CREATED','STUDENT_IMPORTED','STUDENT_CLAIMED','CLAIM_REVIEWED','WORKFLOW_SUBMITTED','WORKFLOW_REVIEWED','WORKFLOW_APPROVED','WORKFLOW_REJECTED','WORKFLOW_CHANGES_REQUESTED');

ALTER TABLE "Credential"
ADD COLUMN "workflowStatus" "CredentialWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "preparedById" TEXT,
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "approvedById" TEXT,
ADD COLUMN "workflowNote" TEXT,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "approvedAt" TIMESTAMP(3);

CREATE TABLE "StudentRecord" (
 "id" TEXT NOT NULL,
 "universityId" TEXT NOT NULL,
 "studentId" TEXT NOT NULL,
 "namePrefix" "NamePrefix",
 "firstNameTh" TEXT NOT NULL,
 "lastNameTh" TEXT NOT NULL,
 "firstNameEn" TEXT,
 "lastNameEn" TEXT,
 "birthDate" TIMESTAMP(3) NOT NULL,
 "nationalIdHash" TEXT,
 "email" TEXT,
 "facultyId" TEXT,
 "majorId" TEXT,
 "claimStatus" "StudentClaimStatus" NOT NULL DEFAULT 'UNCLAIMED',
 "claimedById" TEXT,
 "claimedAt" TIMESTAMP(3),
 "isActive" BOOLEAN NOT NULL DEFAULT true,
 "createdById" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StudentRecord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClaimAttempt" (
 "id" TEXT NOT NULL,
 "universityId" TEXT NOT NULL,
 "studentRecordId" TEXT,
 "userId" TEXT NOT NULL,
 "studentId" TEXT NOT NULL,
 "matched" BOOLEAN NOT NULL,
 "reason" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ClaimAttempt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Notification" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "universityId" TEXT,
 "type" "NotificationType" NOT NULL,
 "title" TEXT NOT NULL,
 "message" TEXT NOT NULL,
 "link" TEXT,
 "readAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditLog" (
 "id" TEXT NOT NULL,
 "actorId" TEXT,
 "universityId" TEXT,
 "action" "AuditAction" NOT NULL,
 "entityType" TEXT NOT NULL,
 "entityId" TEXT,
 "beforeData" JSONB,
 "afterData" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentRecord_universityId_studentId_key" ON "StudentRecord"("universityId","studentId");
CREATE UNIQUE INDEX "StudentRecord_claimedById_key" ON "StudentRecord"("claimedById");
CREATE INDEX "StudentRecord_universityId_claimStatus_idx" ON "StudentRecord"("universityId","claimStatus");
CREATE INDEX "ClaimAttempt_universityId_createdAt_idx" ON "ClaimAttempt"("universityId","createdAt");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId","readAt","createdAt");
CREATE INDEX "AuditLog_universityId_createdAt_idx" ON "AuditLog"("universityId","createdAt");
CREATE INDEX "Credential_workflowStatus_idx" ON "Credential"("workflowStatus");
ALTER TABLE "StudentRecord" ADD CONSTRAINT "StudentRecord_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentRecord" ADD CONSTRAINT "StudentRecord_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentRecord" ADD CONSTRAINT "StudentRecord_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentRecord" ADD CONSTRAINT "StudentRecord_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentRecord" ADD CONSTRAINT "StudentRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClaimAttempt" ADD CONSTRAINT "ClaimAttempt_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClaimAttempt" ADD CONSTRAINT "ClaimAttempt_studentRecordId_fkey" FOREIGN KEY ("studentRecordId") REFERENCES "StudentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClaimAttempt" ADD CONSTRAINT "ClaimAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
