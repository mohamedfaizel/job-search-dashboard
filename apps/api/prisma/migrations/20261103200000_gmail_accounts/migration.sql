-- CreateEnum
CREATE TYPE "SuggestionState" AS ENUM ('PENDING', 'APPROVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "GmailAccount" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "GmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailSuggestion" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "ApplicationStatus" NOT NULL,
    "state" "SuggestionState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_userId_email_key" ON "GmailAccount"("userId", "email");

-- CreateIndex
CREATE INDEX "MailSuggestion_userId_state_idx" ON "MailSuggestion"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "MailSuggestion_accountId_messageId_key" ON "MailSuggestion"("accountId", "messageId");

-- AddForeignKey
ALTER TABLE "GmailAccount" ADD CONSTRAINT "GmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailSuggestion" ADD CONSTRAINT "MailSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailSuggestion" ADD CONSTRAINT "MailSuggestion_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailSuggestion" ADD CONSTRAINT "MailSuggestion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
