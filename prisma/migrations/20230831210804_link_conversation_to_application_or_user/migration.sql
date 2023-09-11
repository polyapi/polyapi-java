/*
  Warnings:

  - You are about to drop the column `user_id` on the `conversation_message` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_conversation_message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL,
    "type" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_conversation_message" ("content", "conversation_id", "createdAt", "id", "name", "role", "type") SELECT "content", "conversation_id", "createdAt", "id", "name", "role", "type" FROM "conversation_message";
DROP TABLE "conversation_message";
ALTER TABLE "new_conversation_message" RENAME TO "conversation_message";
CREATE UNIQUE INDEX "conversation_message_createdAt_key" ON "conversation_message"("createdAt");
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "applicationId" TEXT,
    "workspaceFolder" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Conversation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "application" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("createdAt", "id", "userId", "workspaceFolder") SELECT "createdAt", "id", "userId", "workspaceFolder" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
