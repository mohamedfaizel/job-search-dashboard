-- AlterTable
ALTER TABLE "JobResume" ADD COLUMN     "claudeAnswers" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "fillSavedAnswers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showStretches" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SavedAnswer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedAnswer_userId_key_key" ON "SavedAnswer"("userId", "key");

-- AddForeignKey
ALTER TABLE "SavedAnswer" ADD CONSTRAINT "SavedAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
