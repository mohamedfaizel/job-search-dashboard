-- Rename the import source in both enums. Existing rows keep their value under the new name.
ALTER TYPE "JobSource" RENAME VALUE 'JOBSPIPE' TO 'JOBHUNTER';
ALTER TYPE "ImportSource" RENAME VALUE 'JOBSPIPE' TO 'JOBHUNTER';

-- New saved searches default to the renamed value.
ALTER TABLE "SavedSearch" ALTER COLUMN "source" SET DEFAULT 'JOBHUNTER';
