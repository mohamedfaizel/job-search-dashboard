-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "followedUpAt" TIMESTAMP(3),
ADD COLUMN     "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Until now the last change of any kind was the status change.
UPDATE "Application" SET "statusChangedAt" = "updatedAt";
