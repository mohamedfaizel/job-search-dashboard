-- CreateEnum
CREATE TYPE "MatcherResumeStatus" AS ENUM ('READY', 'FAILED');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "resumeFile" BYTEA,
ADD COLUMN     "resumeFileType" TEXT,
ADD COLUMN     "resumeUploadedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MatcherResume" (
    "userId" INTEGER NOT NULL,
    "rmResumeId" TEXT,
    "status" "MatcherResumeStatus" NOT NULL,
    "error" TEXT,
    "fileName" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatcherResume_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "MatcherResume" ADD CONSTRAINT "MatcherResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
