-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "resumeLanguage" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "LanguageResume" (
    "userId" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "fileName" TEXT,
    "file" BYTEA,
    "fileType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LanguageResume_pkey" PRIMARY KEY ("userId","language")
);

-- AddForeignKey
ALTER TABLE "LanguageResume" ADD CONSTRAINT "LanguageResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
