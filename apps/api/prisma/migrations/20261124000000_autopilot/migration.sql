-- Autopilot rules on saved searches: queue jobs that fit well, hide poor ones.
ALTER TABLE "SavedSearch" ADD COLUMN "autopilot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "autoQueueFitMin" INTEGER NOT NULL DEFAULT 75,
ADD COLUMN "autoQueueNeedsVisa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "autoHideFitBelow" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN "autoQueueMaxPerDay" INTEGER NOT NULL DEFAULT 10;

-- Apply queue: which jobs Autopilot added.
ALTER TABLE "ApplyQueueItem" ADD COLUMN "auto" BOOLEAN NOT NULL DEFAULT false;
