-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_api_function" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "payload" TEXT,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "headers" TEXT,
    "body" TEXT,
    "auth" TEXT,
    "response" TEXT,
    "arguments_metadata" TEXT,
    "trained" BOOLEAN NOT NULL DEFAULT false,
    "public_id" TEXT NOT NULL,
    CONSTRAINT "api_function_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_api_function" ("arguments_metadata", "auth", "body", "context", "created_at", "description", "headers", "id", "method", "name", "payload", "public_id", "response", "trained", "url", "user_id") SELECT "arguments_metadata", "auth", "body", "context", "created_at", "description", "headers", "id", "method", "name", "payload", "public_id", "response", "trained", "url", "user_id" FROM "api_function";
DROP TABLE "api_function";
ALTER TABLE "new_api_function" RENAME TO "api_function";
CREATE UNIQUE INDEX "api_function_public_id_key" ON "api_function"("public_id");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
