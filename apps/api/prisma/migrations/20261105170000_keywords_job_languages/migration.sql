-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "JobLanguages" (
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "JobLanguages_pkey" PRIMARY KEY ("userId","jobId")
);

-- AddForeignKey
ALTER TABLE "JobLanguages" ADD CONSTRAINT "JobLanguages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLanguages" ADD CONSTRAINT "JobLanguages_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
