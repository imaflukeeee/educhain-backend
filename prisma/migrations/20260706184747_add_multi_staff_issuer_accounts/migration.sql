/*
  Warnings:

  - You are about to drop the column `contactPersonEn` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `contactPersonTh` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "IssuerAccountType" AS ENUM ('UNIVERSITY_ADMIN', 'REGISTRAR_STAFF');

-- AlterTable
ALTER TABLE "Credential" ADD COLUMN     "issuedByDepartment" TEXT,
ADD COLUMN     "issuedByEmail" TEXT,
ADD COLUMN     "issuedByName" TEXT,
ADD COLUMN     "issuedByPosition" TEXT,
ADD COLUMN     "issuerStaffId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "contactPersonEn",
DROP COLUMN "contactPersonTh",
ADD COLUMN     "contactFirstNameEn" TEXT,
ADD COLUMN     "contactFirstNameTh" TEXT,
ADD COLUMN     "contactLastNameEn" TEXT,
ADD COLUMN     "contactLastNameTh" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "issuerAccountType" "IssuerAccountType",
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "staffDepartment" TEXT,
ADD COLUMN     "staffPosition" TEXT,
ADD COLUMN     "universityOwnerId" TEXT;

-- CreateIndex
CREATE INDEX "Credential_issuerId_idx" ON "Credential"("issuerId");

-- CreateIndex
CREATE INDEX "Credential_issuerStaffId_idx" ON "Credential"("issuerStaffId");

-- CreateIndex
CREATE INDEX "Credential_holderId_idx" ON "Credential"("holderId");

-- CreateIndex
CREATE INDEX "User_universityOwnerId_idx" ON "User"("universityOwnerId");

-- CreateIndex
CREATE INDEX "User_role_issuerAccountType_idx" ON "User"("role", "issuerAccountType");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_universityOwnerId_fkey" FOREIGN KEY ("universityOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_issuerStaffId_fkey" FOREIGN KEY ("issuerStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
