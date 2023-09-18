-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_api_function" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "payload" TEXT,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "headers" TEXT,
    "body" TEXT,
    "auth" TEXT,
    "response_type" TEXT,
    "arguments_metadata" TEXT,
    "trained" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'ENVIRONMENT',
    "graphql_identifier" TEXT,
    "introspection_response" TEXT,
    "enableRedirect" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "api_function_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_api_function" ("arguments_metadata", "auth", "body", "context", "created_at", "description", "environment_id", "graphql_identifier", "headers", "id", "introspection_response", "method", "name", "payload", "response_type", "trained", "url", "visibility") SELECT "arguments_metadata", "auth", "body", "context", "created_at", "description", "environment_id", "graphql_identifier", "headers", "id", "introspection_response", "method", "name", "payload", "response_type", "trained", "url", "visibility" FROM "api_function";
DROP TABLE "api_function";
ALTER TABLE "new_api_function" RENAME TO "api_function";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
