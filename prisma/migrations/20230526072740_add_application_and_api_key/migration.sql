/*
  Warnings:

  - You are about to drop the `user_key` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `app_key` on the `environment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "user_key_user_id_environment_id_key";

-- DropIndex
DROP INDEX "user_key_key_key";

-- DropIndex
DROP INDEX "user_key_id_key";

-- CreateTable
CREATE TABLE "application"
(
  "id"             TEXT     NOT NULL PRIMARY KEY,
  "created_at"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "environment_id" TEXT     NOT NULL,
  "name"           TEXT     NOT NULL,
  "description"    TEXT     NOT NULL DEFAULT '',
  CONSTRAINT "application_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "application" ("id", "created_at", "environment_id", "name")
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
             substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
             hex(randomblob(6))),
       "created_at",
       "id",
       'poly-system-default-app'
FROM "environment"
WHERE tenant_id = (SELECT id FROM "tenant" WHERE name = 'poly-system');

-- CreateTable
CREATE TABLE "api_key"
(
  "id"             TEXT     NOT NULL PRIMARY KEY,
  "created_at"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"           TEXT     NOT NULL,
  "environment_id" TEXT     NOT NULL,
  "key"            TEXT     NOT NULL,
  "permissions"    TEXT     NOT NULL DEFAULT '{}',
  "application_id" TEXT,
  "user_id"        TEXT,
  CONSTRAINT "api_key_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "api_key_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "api_key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "api_key" ("id", "created_at", "environment_id", "name", "key", "application_id", "permissions")
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
             substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
             hex(randomblob(6))),
       "created_at",
       "id",
       'poly-system-app-key',
       "app_key",
       (SELECT id FROM "application" WHERE name = 'Poly'),
       '{"use": true}'
FROM "environment"
WHERE tenant_id = (SELECT id FROM "tenant" WHERE name = 'poly-system');

INSERT INTO "api_key" ("id", "created_at", "environment_id", "name", "key", "user_id", "permissions")
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
             substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
             hex(randomblob(6))),
       "created_at",
       "environment_id",
       'default',
       "user_key"."key",
       "user_id",
       "permissions"
FROM "user_key";

-- RedefineTables
PRAGMA foreign_keys= OFF;
CREATE TABLE "new_environment"
(
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"       TEXT     NOT NULL,
  "tenant_id"  TEXT     NOT NULL,
  "subdomain"  TEXT     NOT NULL,
  CONSTRAINT "environment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_environment" ("created_at", "id", "name", "subdomain", "tenant_id")
SELECT "created_at", "id", "name", "subdomain", "tenant_id"
FROM "environment";
DROP TABLE "environment";
ALTER TABLE "new_environment"
  RENAME TO "environment";
CREATE UNIQUE INDEX "environment_subdomain_key" ON "environment" ("subdomain");
PRAGMA foreign_key_check;
PRAGMA foreign_keys= ON;

-- CreateIndex
CREATE UNIQUE INDEX "api_key_key_key" ON "api_key" ("key");

-- DropTable
PRAGMA foreign_keys= off;
DROP TABLE "user_key";
PRAGMA foreign_keys= on;
