-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC', 'OPENAI');

-- CreateEnum
CREATE TYPE "ApiKeyKind" AS ENUM ('JOBHUNTER', 'ANTHROPIC', 'OPENAI');

-- DropIndex
DROP INDEX "SavedSearch_name_key";

-- AlterTable: every saved search and past import so far was the admin's (only the admin could
-- import). They go to the first admin, or the first account when there is no admin.
ALTER TABLE "SavedSearch" ADD COLUMN     "userId" INTEGER;
ALTER TABLE "SyncRun" ADD COLUMN     "userId" INTEGER;

UPDATE "SavedSearch" SET "userId" = (SELECT "id" FROM "User" ORDER BY ("role" = 'ADMIN') DESC, "id" LIMIT 1);
UPDATE "SyncRun" SET "userId" = (SELECT "id" FROM "User" ORDER BY ("role" = 'ADMIN') DESC, "id" LIMIT 1);
-- Only possible with no accounts at all: nobody could own these searches.
DELETE FROM "SavedSearch" WHERE "userId" IS NULL;
ALTER TABLE "SavedSearch" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiProvider" "AiProvider" NOT NULL DEFAULT 'ANTHROPIC',
ADD COLUMN     "envKeysAdopted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ApiKey" (
    "userId" INTEGER NOT NULL,
    "kind" "ApiKeyKind" NOT NULL,
    "secret" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "model" TEXT,
    "credits" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("userId","kind")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedSearch_userId_name_key" ON "SavedSearch"("userId", "name");

-- CreateIndex
CREATE INDEX "SyncRun_userId_finishedAt_idx" ON "SyncRun"("userId", "finishedAt");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

