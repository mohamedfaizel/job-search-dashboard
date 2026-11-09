-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationEvent_userId_jobId_idx" ON "ApplicationEvent"("userId", "jobId");

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: each tracked job's current status (and an interview it had before a rejection).
INSERT INTO "ApplicationEvent" ("userId", "jobId", "status", "at")
SELECT "userId", "jobId", 'INTERVIEWING', "interviewAt"
FROM "Application"
WHERE "interviewAt" IS NOT NULL AND "status" = 'REJECTED';

INSERT INTO "ApplicationEvent" ("userId", "jobId", "status", "at")
SELECT "userId", "jobId", "status", "statusChangedAt"
FROM "Application";
