-- Add optional profile fields for students and issuing universities
ALTER TABLE "User" ADD COLUMN "firstNameTh" TEXT;
ALTER TABLE "User" ADD COLUMN "lastNameTh" TEXT;
ALTER TABLE "User" ADD COLUMN "firstNameEn" TEXT;
ALTER TABLE "User" ADD COLUMN "lastNameEn" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "studentId" TEXT;
ALTER TABLE "User" ADD COLUMN "faculty" TEXT;
ALTER TABLE "User" ADD COLUMN "major" TEXT;
ALTER TABLE "User" ADD COLUMN "universityNameTh" TEXT;
ALTER TABLE "User" ADD COLUMN "universityNameEn" TEXT;
ALTER TABLE "User" ADD COLUMN "contactPersonTh" TEXT;
ALTER TABLE "User" ADD COLUMN "contactPersonEn" TEXT;
ALTER TABLE "User" ADD COLUMN "website" TEXT;
ALTER TABLE "User" ADD COLUMN "address" TEXT;
