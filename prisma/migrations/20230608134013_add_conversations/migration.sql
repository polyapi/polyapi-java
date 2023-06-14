/*
  Warnings:

  - You are about to drop the `function_defined` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhook_defined` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `conversation_id` to the `conversation_message` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "function_defined";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "webhook_defined";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_conversation_message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    CONSTRAINT "conversation_message_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- INSERT INTO "new_conversation_message" ("content", "createdAt", "id", "name", "role", "user_id") SELECT "content", "createdAt", "id", "name", "role", "user_id" FROM "conversation_message";
DROP TABLE "conversation_message";
ALTER TABLE "new_conversation_message" RENAME TO "conversation_message";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
