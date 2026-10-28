-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[];
