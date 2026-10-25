-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('JOBSPIPE', 'MANUAL');

-- CreateEnum
CREATE TYPE "Workplace" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NONE', 'SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED');

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "source" "JobSource" NOT NULL,
    "title" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "url" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "seniority" TEXT,
    "jobFunction" TEXT,
    "skills" TEXT[],
    "city" TEXT,
    "location" TEXT,
    "countryCode" TEXT,
    "salaryMinUsd" INTEGER,
    "salaryMaxUsd" INTEGER,
    "salaryEstimated" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "workplace" "Workplace",
    "industry" TEXT,
    "description" TEXT,
    "postingStatus" TEXT NOT NULL DEFAULT 'active',
    "applicationStatus" "ApplicationStatus" NOT NULL DEFAULT 'NONE',
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Job_externalId_key" ON "Job"("externalId");

-- CreateIndex
CREATE INDEX "Job_postedAt_idx" ON "Job"("postedAt");

-- CreateIndex
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");

-- CreateIndex
CREATE INDEX "Job_applicationStatus_idx" ON "Job"("applicationStatus");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
