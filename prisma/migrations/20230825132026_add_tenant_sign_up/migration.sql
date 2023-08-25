/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user" ADD COLUMN "email" TEXT;

-- CreateTable
CREATE TABLE "tenant_sign_up" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "verification_code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sign_up_email_key" ON "tenant_sign_up"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sign_up_verification_code_key" ON "tenant_sign_up"("verification_code");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
