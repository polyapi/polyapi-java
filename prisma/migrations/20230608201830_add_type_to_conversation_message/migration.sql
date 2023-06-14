-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_conversation_message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL,
    "type" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    CONSTRAINT "conversation_message_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_conversation_message" ("content", "conversation_id", "createdAt", "id", "name", "role", "user_id") SELECT "content", "conversation_id", "createdAt", "id", "name", "role", "user_id" FROM "conversation_message";
DROP TABLE "conversation_message";
ALTER TABLE "new_conversation_message" RENAME TO "conversation_message";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
