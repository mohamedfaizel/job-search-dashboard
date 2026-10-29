-- AlterTable
ALTER TABLE "JobResume" ADD COLUMN     "coverLetter" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "formAnswers" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "applicationNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "noticePeriod" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "relocation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "salaryExpectation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "workPermit" TEXT NOT NULL DEFAULT '';
