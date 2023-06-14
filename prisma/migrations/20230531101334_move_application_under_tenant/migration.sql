/*
  Warnings:

  - You are about to drop the column `environment_id` on the `application` table. All the data in the column will be lost.
  - Added the required column `tenant_id` to the `application` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys= OFF;
CREATE TABLE "new_application"
(
  "id"          TEXT     NOT NULL PRIMARY KEY,
  "created_at"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenant_id"   TEXT     NOT NULL,
  "name"        TEXT     NOT NULL,
  "description" TEXT     NOT NULL DEFAULT '',
  CONSTRAINT "application_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_application" ("created_at", "description", "id", "name", "tenant_id")
SELECT "created_at",
       "description",
       "id",
       "name",
       (SELECT "tenant_id" FROM "environment" WHERE "environment"."id" = "application"."environment_id")
FROM "application";

DROP TABLE "application";
ALTER TABLE "new_application"
  RENAME TO "application";
PRAGMA foreign_key_check;
PRAGMA foreign_keys= ON;
