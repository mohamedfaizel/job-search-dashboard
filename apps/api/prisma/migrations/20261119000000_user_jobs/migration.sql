-- CreateTable
CREATE TABLE "UserJob" (
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserJob_pkey" PRIMARY KEY ("userId","jobId")
);

-- CreateIndex
CREATE INDEX "UserJob_jobId_idx" ON "UserJob"("jobId");

-- AddForeignKey
ALTER TABLE "UserJob" ADD CONSTRAINT "UserJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserJob" ADD CONSTRAINT "UserJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Jobs saved so far: admins keep every one, so the owner's list stays as it was.
INSERT INTO "UserJob" ("userId", "jobId", "addedAt")
SELECT u."id", j."id", j."createdAt" FROM "User" u CROSS JOIN "Job" j WHERE u."role" = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Everyone else keeps the jobs they already acted on (tracker, hidden, Apply queue).
INSERT INTO "UserJob" ("userId", "jobId", "addedAt")
SELECT "userId", "jobId", CURRENT_TIMESTAMP FROM "Application"
UNION SELECT "userId", "jobId", CURRENT_TIMESTAMP FROM "HiddenJob"
UNION SELECT "userId", "jobId", CURRENT_TIMESTAMP FROM "ApplyQueueItem"
ON CONFLICT DO NOTHING;
