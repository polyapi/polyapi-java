/*
  Warnings:

  - Added the required column `subdomain` to the `environment` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_environment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "app_key" TEXT NOT NULL,
    CONSTRAINT "environment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_environment" ("app_key", "created_at", "id", "name", "tenant_id", "subdomain") SELECT "app_key", "created_at", "id", "name", "tenant_id", lower(hex(randomblob(4))) FROM "environment";
DROP TABLE "environment";
ALTER TABLE "new_environment" RENAME TO "environment";
CREATE UNIQUE INDEX "environment_subdomain_key" ON "environment"("subdomain");
CREATE UNIQUE INDEX "environment_app_key_key" ON "environment"("app_key");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
