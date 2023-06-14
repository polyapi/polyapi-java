/*
  Warnings:

  - Added the required column `permissions` to the `user_key` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_conversation_message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    CONSTRAINT "conversation_message_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_conversation_message" ("content", "createdAt", "environment_id", "id", "name", "role") SELECT "content", "createdAt", "environment_id", "id", "name", "role" FROM "conversation_message";
DROP TABLE "conversation_message";
ALTER TABLE "new_conversation_message" RENAME TO "conversation_message";
CREATE TABLE "new_user_key" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "user_key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_key_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_user_key" ("created_at", "environment_id", "id", "key", "user_id", "permissions") SELECT "created_at", "environment_id", "id", "key", "user_id", '{}' FROM "user_key";
DROP TABLE "user_key";
ALTER TABLE "new_user_key" RENAME TO "user_key";
CREATE UNIQUE INDEX "user_key_id_key" ON "user_key"("id");
CREATE UNIQUE INDEX "user_key_key_key" ON "user_key"("key");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
