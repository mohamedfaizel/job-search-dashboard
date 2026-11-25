-- Nightly kits at your own time, and catch-up when the PC was off at that time.
ALTER TABLE "Profile" ADD COLUMN "nightlyKitsAt" TEXT NOT NULL DEFAULT '03:00';
ALTER TABLE "Profile" ADD COLUMN "nightlyKitsRanAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "weeklySentAt" TIMESTAMP(3);

-- Existing users count as done for now, so nothing runs (or costs AI credits) the moment
-- they update. From the next due time on, missed runs catch up.
UPDATE "Profile" SET "nightlyKitsRanAt" = CURRENT_TIMESTAMP, "weeklySentAt" = CURRENT_TIMESTAMP;
