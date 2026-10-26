-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "discoveredAtGte" TEXT,
ADD COLUMN     "nextCursor" TEXT;
