-- Application status moves from the shared Job row to one row per user and job.

-- CreateTable
CREATE TABLE "Application" (
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("userId","jobId")
);

-- CreateIndex
CREATE INDEX "Application_userId_status_idx" ON "Application"("userId", "status");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the statuses set so far: before logins they were all the admin's, so give them to the
-- first admin account. With no admin yet, there is nobody to give them to.
INSERT INTO "Application" ("userId", "jobId", "status", "createdAt", "updatedAt")
SELECT admin."id", job."id", job."applicationStatus", job."updatedAt", job."updatedAt"
FROM "Job" AS job
CROSS JOIN (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "id" LIMIT 1) AS admin
WHERE job."applicationStatus" <> 'NONE';

-- DropIndex
DROP INDEX "Job_applicationStatus_idx";

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "applicationStatus";
