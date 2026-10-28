-- CreateTable
CREATE TABLE "JobResume" (
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "fileName" TEXT,
    "file" BYTEA,
    "fileType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobResume_pkey" PRIMARY KEY ("userId","jobId")
);

-- AddForeignKey
ALTER TABLE "JobResume" ADD CONSTRAINT "JobResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobResume" ADD CONSTRAINT "JobResume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
