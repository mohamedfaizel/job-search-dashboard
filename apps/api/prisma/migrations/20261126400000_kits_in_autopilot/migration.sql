-- Apply kits move from the Nightly apply kits settings into each saved search's Autopilot:
-- they are written right after the search runs, for the jobs Autopilot queued.
ALTER TABLE "SavedSearch" ADD COLUMN "autoKits" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SavedSearch" ADD COLUMN "kitScoreTarget" INTEGER NOT NULL DEFAULT 90;

-- Who had nightly kits on keeps kits for their Autopilot searches, with the same target.
UPDATE "SavedSearch" s
SET "autoKits" = p."nightlyKits", "kitScoreTarget" = p."kitScoreTarget"
FROM "Profile" p
WHERE p."userId" = s."userId";

ALTER TABLE "Profile" DROP COLUMN "nightlyKits",
DROP COLUMN "nightlyKitsMax",
DROP COLUMN "nightlyKitsAt",
DROP COLUMN "nightlyKitsFitMin",
DROP COLUMN "kitScoreTarget",
DROP COLUMN "nightlyKitsRanAt";
