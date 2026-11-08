-- The Resume builder's Look tab: text size, margins, line spacing and compact mode.
ALTER TABLE "DocumentStyle" ADD COLUMN "fontSize" DOUBLE PRECISION,
ADD COLUMN "margin" INTEGER,
ADD COLUMN "lineSpacing" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "compact" BOOLEAN NOT NULL DEFAULT false;
