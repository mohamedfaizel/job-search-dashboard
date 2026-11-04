CREATE TABLE "TableSettings" (
    "userId" INTEGER NOT NULL,
    "settings" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableSettings_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "TableSettings" ADD CONSTRAINT "TableSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
