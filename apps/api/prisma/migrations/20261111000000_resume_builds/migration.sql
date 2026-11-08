-- Your master resume as the Resume builder edits it: sections as JSON, one row per language.
CREATE TABLE "ResumeBuild" (
    "userId" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "doc" JSONB NOT NULL,
    "syncedText" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeBuild_pkey" PRIMARY KEY ("userId","language")
);

ALTER TABLE "ResumeBuild" ADD CONSTRAINT "ResumeBuild_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
