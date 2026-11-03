-- AlterEnum
ALTER TYPE "ImportSource" ADD VALUE 'COMPANY_BOARDS';

-- AlterEnum
ALTER TYPE "JobSource" ADD VALUE 'COMPANY_BOARD';

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "boards" TEXT[] DEFAULT ARRAY[]::TEXT[];
