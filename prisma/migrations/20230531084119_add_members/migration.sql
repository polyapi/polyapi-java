/*
  Warnings:

  - You are about to drop the column `team_id` on the `user` table. All the data in the column will be lost.
  - Added the required column `tenant_id` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "team_member"
(
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "team_id"    TEXT     NOT NULL,
  "user_id"    TEXT     NOT NULL,
  CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "team_member" ("created_at", "id", "team_id", "user_id")
SELECT "created_at",
       lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
             substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
             hex(randomblob(6))),
       "team_id",
       "id"
FROM "user";

-- RedefineTables
PRAGMA foreign_keys= OFF;
CREATE TABLE "new_user"
(
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"       TEXT     NOT NULL,
  "tenant_id"  TEXT     NOT NULL,
  "role"       TEXT     NOT NULL DEFAULT 'USER',
  "vip"        BOOLEAN  NOT NULL DEFAULT false,
  CONSTRAINT "user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_user" ("created_at", "id", "tenant_id", "name", "role", "vip")
SELECT "created_at",
       "id",
       (SELECT "team"."tenant_id" FROM "team" WHERE "team"."id" = "user"."team_id"),
       "name",
       "role",
       "vip"
FROM "user";

DROP TABLE "user";
ALTER TABLE "new_user"
  RENAME TO "user";
PRAGMA foreign_key_check;
PRAGMA foreign_keys= ON;
