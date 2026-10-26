-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('OFF', 'HOURLY', 'DAILY', 'WEEKDAYS');

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "nextRunAt" TIMESTAMP(3),
ADD COLUMN     "runAt" TEXT NOT NULL DEFAULT '07:00',
ADD COLUMN     "schedule" "ScheduleFrequency" NOT NULL DEFAULT 'OFF',
ADD COLUMN     "scheduleNote" TEXT;

-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "scheduled" BOOLEAN NOT NULL DEFAULT false;
