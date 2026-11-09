-- CreateTable
CREATE TABLE "CoverLetterTemplate" (
    "userId" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverLetterTemplate_pkey" PRIMARY KEY ("userId","language")
);

-- AddForeignKey
ALTER TABLE "CoverLetterTemplate" ADD CONSTRAINT "CoverLetterTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
