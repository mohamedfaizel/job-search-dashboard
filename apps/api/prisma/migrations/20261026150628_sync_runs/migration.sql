-- CreateTable
CREATE TABLE "SyncRun" (
    "id" SERIAL NOT NULL,
    "searchKey" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "complete" BOOLEAN NOT NULL,
    "fetched" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "creditsCharged" INTEGER,
    "jobsAlreadyPaid" INTEGER,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncRun_searchKey_startedAt_idx" ON "SyncRun"("searchKey", "startedAt");
