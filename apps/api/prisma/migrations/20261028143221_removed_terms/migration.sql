-- CreateTable
CREATE TABLE "RemovedTerm" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "jobId" TEXT,
    "term" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemovedTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemovedTerm_userId_jobId_idx" ON "RemovedTerm"("userId", "jobId");

-- AddForeignKey
ALTER TABLE "RemovedTerm" ADD CONSTRAINT "RemovedTerm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemovedTerm" ADD CONSTRAINT "RemovedTerm_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
