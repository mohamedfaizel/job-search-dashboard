-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('JOBSPIPE', 'ARBEITSAGENTUR');

-- AlterEnum
ALTER TYPE "JobSource" ADD VALUE 'ARBEITSAGENTUR';

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "source" "ImportSource" NOT NULL DEFAULT 'JOBSPIPE';
