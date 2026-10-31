-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "dateOfBirth" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "drivingLicence" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "employmentType" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gender" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "nationality" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "workplacePreference" TEXT NOT NULL DEFAULT '';
