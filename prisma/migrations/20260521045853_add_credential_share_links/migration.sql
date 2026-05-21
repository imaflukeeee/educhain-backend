-- CreateTable
CREATE TABLE "CredentialShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CredentialShareLink_token_key" ON "CredentialShareLink"("token");

-- CreateIndex
CREATE INDEX "CredentialShareLink_credentialId_idx" ON "CredentialShareLink"("credentialId");

-- CreateIndex
CREATE INDEX "CredentialShareLink_holderId_idx" ON "CredentialShareLink"("holderId");

-- CreateIndex
CREATE INDEX "CredentialShareLink_token_idx" ON "CredentialShareLink"("token");

-- AddForeignKey
ALTER TABLE "CredentialShareLink" ADD CONSTRAINT "CredentialShareLink_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialShareLink" ADD CONSTRAINT "CredentialShareLink_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
