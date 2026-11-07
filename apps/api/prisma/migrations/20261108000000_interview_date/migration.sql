-- When your interview for a job is, and when the app last reminded you of it.
ALTER TABLE "Application" ADD COLUMN "interviewAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "interviewRemindedAt" TIMESTAMP(3);
CREATE INDEX "Application_interviewAt_idx" ON "Application"("interviewAt");
