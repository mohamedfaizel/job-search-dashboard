-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "savedSearchId" INTEGER;

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "titles" TEXT[],
    "skills" TEXT[],
    "countryCodes" TEXT[],
    "locations" TEXT[],
    "maxAgeDays" INTEGER NOT NULL DEFAULT 7,
    "pageSize" INTEGER NOT NULL DEFAULT 25,
    "maxPages" INTEGER NOT NULL DEFAULT 1,
    "onlyNew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedSearch_name_key" ON "SavedSearch"("name");

-- CreateIndex
CREATE INDEX "SyncRun_savedSearchId_idx" ON "SyncRun"("savedSearchId");

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
