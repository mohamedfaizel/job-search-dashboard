-- CreateEnum
CREATE TYPE "JobMatchStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "JobMatch" (
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "JobMatchStatus" NOT NULL,
    "error" TEXT,
    "rmJobId" TEXT,
    "score" DOUBLE PRECISION,
    "keywordMatchBefore" DOUBLE PRECISION,
    "keywordMatch" DOUBLE PRECISION,
    "skillsCoverage" DOUBLE PRECISION,
    "titleMatch" DOUBLE PRECISION,
    "sectionCompleteness" DOUBLE PRECISION,
    "dateConsistency" DOUBLE PRECISION,
    "missingKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "injectableKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resumeFileName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("userId","jobId")
);

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
