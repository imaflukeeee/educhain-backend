-- Phase 4 Simplified:
-- Remove document-template and bulk-document features.
-- Keep document requests, document versions, replacement and revocation fields.

ALTER TABLE "Credential"
  DROP CONSTRAINT IF EXISTS "Credential_batchId_fkey";

DROP INDEX IF EXISTS "Credential_batchId_idx";

ALTER TABLE "Credential"
  DROP COLUMN IF EXISTS "batchId";

DROP TABLE IF EXISTS "CredentialBatch";
DROP TABLE IF EXISTS "DocumentTemplate";

DROP TYPE IF EXISTS "CredentialBatchStatus";
DROP TYPE IF EXISTS "DocumentTemplateStatus";
