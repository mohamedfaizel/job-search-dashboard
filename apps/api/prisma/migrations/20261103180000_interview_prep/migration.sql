-- CreateTable
CREATE TABLE "InterviewPrep" (
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewPrep_pkey" PRIMARY KEY ("userId","jobId")
);

-- AddForeignKey
ALTER TABLE "InterviewPrep" ADD CONSTRAINT "InterviewPrep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPrep" ADD CONSTRAINT "InterviewPrep_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
