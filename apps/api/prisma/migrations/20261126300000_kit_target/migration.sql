-- Target score for kit resumes: below it, more AI rounds add terms you really have.
ALTER TABLE "Profile" ADD COLUMN "kitScoreTarget" INTEGER NOT NULL DEFAULT 90;
