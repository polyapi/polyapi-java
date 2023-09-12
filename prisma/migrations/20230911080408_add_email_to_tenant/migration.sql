/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tenant" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenant_email_key" ON "tenant"("email");
