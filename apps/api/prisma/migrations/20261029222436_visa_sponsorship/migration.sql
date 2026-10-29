-- CreateEnum
CREATE TYPE "VisaSponsorship" AS ENUM ('OFFERS', 'NO', 'NOT_STATED');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "visa" "VisaSponsorship";
