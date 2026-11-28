-- Key pool: users wait (default 24 hours) before the server gives them a key.
ALTER TABLE "AppSetting" ADD COLUMN "poolWaitHours" INTEGER NOT NULL DEFAULT 24;

ALTER TABLE "KeyRequest" ADD COLUMN "autoAt" TIMESTAMP(3);

CREATE INDEX "KeyRequest_status_autoAt_idx" ON "KeyRequest"("status", "autoAt");
