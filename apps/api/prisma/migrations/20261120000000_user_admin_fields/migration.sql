-- Admin › Users: an admin can disable an account, and sees when each account last used the app.
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3),
ADD COLUMN "lastSeenAt" TIMESTAMP(3);
