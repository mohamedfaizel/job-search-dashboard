-- Nightly apply kits: write queued jobs' kits at night with the user's own AI key.
ALTER TABLE "Profile" ADD COLUMN "nightlyKits" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "nightlyKitsMax" INTEGER NOT NULL DEFAULT 5;
