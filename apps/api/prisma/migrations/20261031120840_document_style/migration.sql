-- CreateTable
CREATE TABLE "DocumentStyle" (
    "userId" INTEGER NOT NULL,
    "resumeTemplate" TEXT NOT NULL DEFAULT 'classic',
    "coverLetterLayout" TEXT NOT NULL DEFAULT 'auto',
    "accentColor" TEXT NOT NULL DEFAULT '1F4E79',
    "font" TEXT NOT NULL DEFAULT 'auto',
    "showPhoto" BOOLEAN NOT NULL DEFAULT false,
    "photo" BYTEA,
    "photoType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentStyle_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "DocumentStyle" ADD CONSTRAINT "DocumentStyle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
