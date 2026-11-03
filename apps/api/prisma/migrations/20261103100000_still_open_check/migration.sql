-- CreateEnum
CREATE TYPE "PostingCheck" AS ENUM ('OPEN', 'CLOSED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "checkReason" TEXT,
ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "lastCheck" "PostingCheck";

-- CreateIndex
CREATE INDEX "Job_checkedAt_idx" ON "Job"("checkedAt");
