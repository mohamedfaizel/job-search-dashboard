-- AlterTable
ALTER TABLE "ApplyQueueItem" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Number the jobs already queued in the order they were added (1, 2, 3 per user).
UPDATE "ApplyQueueItem" AS q
SET "position" = n.rn
FROM (
  SELECT "userId", "jobId", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "addedAt") AS rn
  FROM "ApplyQueueItem"
) AS n
WHERE q."userId" = n."userId" AND q."jobId" = n."jobId";
