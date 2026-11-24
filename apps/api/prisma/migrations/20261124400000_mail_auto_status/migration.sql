-- Gmail moves a job by itself when an email is clear (Undo in the bell).
ALTER TYPE "SuggestionState" ADD VALUE 'AUTO';

ALTER TABLE "Profile" ADD COLUMN "mailAutoStatus" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MailSuggestion" ADD COLUMN "previousStatus" "ApplicationStatus";
