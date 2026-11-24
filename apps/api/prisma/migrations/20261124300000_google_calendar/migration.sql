-- Interviews into Google Calendar.
ALTER TABLE "Application" ADD COLUMN "calendarEventId" TEXT;

-- CreateTable
CREATE TABLE "GoogleCalendar" (
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,

    CONSTRAINT "GoogleCalendar_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "GoogleCalendar" ADD CONSTRAINT "GoogleCalendar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
