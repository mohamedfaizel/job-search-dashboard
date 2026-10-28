-- CreateTable
CREATE TABLE "TailoredResume" (
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "JobMatchStatus" NOT NULL,
    "error" TEXT,
    "rmResumeId" TEXT,
    "rmJobId" TEXT,
    "score" DOUBLE PRECISION,
    "coverLetter" TEXT,
    "resumeFileName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "TailoredResume_pkey" PRIMARY KEY ("userId","jobId")
);

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
