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
    "name" TEXT,
    "verification_code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "public_visibility_allowed" BOOLEAN NOT NULL DEFAULT false,
    "limit_tier_id" TEXT,
    CONSTRAINT "tenant_limit_tier_id_fkey" FOREIGN KEY ("limit_tier_id") REFERENCES "limit_tier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tenant" ("created_at", "id", "limit_tier_id", "name", "public_visibility_allowed") SELECT "created_at", "id", "limit_tier_id", "name", "public_visibility_allowed" FROM "tenant";
DROP TABLE "tenant";
ALTER TABLE "new_tenant" RENAME TO "tenant";
CREATE UNIQUE INDEX "tenant_name_key" ON "tenant"("name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sign_up_email_key" ON "tenant_sign_up"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sign_up_name_key" ON "tenant_sign_up"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sign_up_verification_code_key" ON "tenant_sign_up"("verification_code");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
