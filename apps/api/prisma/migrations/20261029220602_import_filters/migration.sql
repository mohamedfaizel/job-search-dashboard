-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "employmentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "excludeTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "minSalaryEur" INTEGER,
ADD COLUMN     "remoteOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skipFluentGerman" BOOLEAN NOT NULL DEFAULT false;
