-- AlterTable
ALTER TABLE "DocumentStyle" ADD COLUMN     "skillsStyle" TEXT NOT NULL DEFAULT 'index',
ADD COLUMN     "skillsBold" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "headingStyle" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "datesSide" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "bulletStyle" TEXT NOT NULL DEFAULT 'dot';
