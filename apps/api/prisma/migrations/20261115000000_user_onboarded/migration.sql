-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- Accounts that already exist have set up the app: only new accounts see the first-login steps.
UPDATE "User" SET "onboardedAt" = CURRENT_TIMESTAMP;
