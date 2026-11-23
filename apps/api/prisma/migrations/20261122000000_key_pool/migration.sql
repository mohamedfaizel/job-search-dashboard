-- CreateEnum
CREATE TYPE "KeyRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELED');

-- AlterTable
ALTER TABLE "AppSetting" ADD COLUMN     "poolAutoApprove" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "poolKeyLimit" INTEGER NOT NULL DEFAULT 500;

-- CreateTable
CREATE TABLE "PoolKey" (
    "id" SERIAL NOT NULL,
    "secret" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "credits" INTEGER,
    "userId" INTEGER,
    "assignedAt" TIMESTAMP(3),
    "used" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "KeyRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "KeyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PoolKey_fingerprint_key" ON "PoolKey"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "PoolKey_userId_key" ON "PoolKey"("userId");

-- CreateIndex
CREATE INDEX "KeyRequest_status_createdAt_idx" ON "KeyRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "KeyRequest_userId_createdAt_idx" ON "KeyRequest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PoolKey" ADD CONSTRAINT "PoolKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyRequest" ADD CONSTRAINT "KeyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
