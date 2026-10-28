-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "language" TEXT;

-- Fill it in for jobs already imported: the original JobsPipe record is kept in "raw".
UPDATE "Job" SET "language" = lower("raw"->>'language') WHERE "raw" ? 'language' AND "raw"->>'language' IS NOT NULL;
