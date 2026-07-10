ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "emailVerificationTokenHash" TEXT,
ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_emailVerificationTokenHash_key" ON "User"("emailVerificationTokenHash");

-- บัญชีเดิมก่อนติดตั้ง Phase 1 ถือว่ายืนยันแล้ว เพื่อไม่ให้ผู้ใช้เดิมถูกล็อกออกจากระบบ
UPDATE "User"
SET "emailVerifiedAt" = NOW()
WHERE "emailVerifiedAt" IS NULL;
