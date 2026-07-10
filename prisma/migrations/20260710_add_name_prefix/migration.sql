DO $$ BEGIN
  CREATE TYPE "NamePrefix" AS ENUM ('MR', 'MISS', 'MRS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "namePrefix" "NamePrefix";
