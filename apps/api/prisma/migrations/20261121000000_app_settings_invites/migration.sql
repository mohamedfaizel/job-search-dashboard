-- CreateEnum
CREATE TYPE "SignupMode" AS ENUM ('OPEN', 'INVITE', 'CLOSED');

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "signupMode" "SignupMode" NOT NULL DEFAULT 'OPEN',
    "dailyCreditCap" INTEGER NOT NULL DEFAULT 100,
    "maxSavedSearches" INTEGER NOT NULL DEFAULT 10,
    "schedulerOn" BOOLEAN NOT NULL DEFAULT true,
    "stillOpenOn" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");
