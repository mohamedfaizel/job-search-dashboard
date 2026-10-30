-- CreateTable
CREATE TABLE "JobFit" (
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "JobFit_pkey" PRIMARY KEY ("userId","jobId")
);

-- CreateIndex
CREATE INDEX "JobFit_userId_score_idx" ON "JobFit"("userId", "score");

-- AddForeignKey
ALTER TABLE "JobFit" ADD CONSTRAINT "JobFit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFit" ADD CONSTRAINT "JobFit_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
