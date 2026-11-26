-- AlterTable
ALTER TABLE "JobResume" ADD COLUMN     "costMicroUsd" INTEGER,
ADD COLUMN     "savedMicroUsd" INTEGER,
ADD COLUMN     "usedMaster" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "kitMasterMin" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "kitUseMaster" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kitWriteAnswers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kitWriteCover" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kitWriteResume" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastKitRun" JSONB;
