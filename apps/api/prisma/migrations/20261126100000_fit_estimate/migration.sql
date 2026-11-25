-- Fit % for an ad with no text: a guess from the title, shown as "~61%".
ALTER TABLE "JobFit" ADD COLUMN "estimate" BOOLEAN NOT NULL DEFAULT false;
