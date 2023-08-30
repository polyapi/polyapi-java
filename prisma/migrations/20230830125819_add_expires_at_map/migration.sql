/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `tenant_sign_up` table. All the data in the column will be lost.
  - Added the required column `expires_at` to the `tenant_sign_up` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tenant_sign_up" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "verification_code" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL
);
INSERT INTO "new_tenant_sign_up" ("created_at", "email", "id", "name", "verification_code") SELECT "created_at", "email", "id", "name", "verification_code" FROM "tenant_sign_up";
DROP TABLE "tenant_sign_up";
ALTER TABLE "new_tenant_sign_up" RENAME TO "tenant_sign_up";
CREATE UNIQUE INDEX "tenant_sign_up_email_key" ON "tenant_sign_up"("email");
CREATE UNIQUE INDEX "tenant_sign_up_name_key" ON "tenant_sign_up"("name");
CREATE UNIQUE INDEX "tenant_sign_up_verification_code_key" ON "tenant_sign_up"("verification_code");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
