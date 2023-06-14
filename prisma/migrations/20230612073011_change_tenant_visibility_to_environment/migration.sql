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
    "response" TEXT,
    "arguments_metadata" TEXT,
    "trained" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'ENVIRONMENT',
    CONSTRAINT "api_function_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_api_function" ("arguments_metadata", "auth", "body", "context", "created_at", "description", "environment_id", "headers", "id", "method", "name", "payload", "response", "trained", "url", "visibility") SELECT "arguments_metadata", "auth", "body", "context", "created_at", "description", "environment_id", "headers", "id", "method", "name", "payload", "response", "trained", "url", "visibility" FROM "api_function";
DROP TABLE "api_function";
ALTER TABLE "new_api_function" RENAME TO "api_function";
CREATE TABLE "new_auth_provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "name" TEXT,
    "context" TEXT NOT NULL,
    "authorize_url" TEXT NOT NULL,
    "token_url" TEXT NOT NULL,
    "revoke_url" TEXT,
    "introspect_url" TEXT,
    "audience_required" BOOLEAN NOT NULL DEFAULT false,
    "refresh_enabled" BOOLEAN NOT NULL DEFAULT false,
    "trained" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'ENVIRONMENT',
    CONSTRAINT "auth_provider_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_auth_provider" ("audience_required", "authorize_url", "context", "created_at", "environment_id", "id", "introspect_url", "name", "refresh_enabled", "revoke_url", "token_url", "trained", "visibility") SELECT "audience_required", "authorize_url", "context", "created_at", "environment_id", "id", "introspect_url", "name", "refresh_enabled", "revoke_url", "token_url", "trained", "visibility" FROM "auth_provider";
DROP TABLE "auth_provider";
ALTER TABLE "new_auth_provider" RENAME TO "auth_provider";
CREATE TABLE "new_custom_function" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "arguments" TEXT NOT NULL,
    "return_type" TEXT,
    "requirements" TEXT,
    "trained" BOOLEAN NOT NULL DEFAULT false,
    "server_side" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'ENVIRONMENT',
    CONSTRAINT "custom_function_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_custom_function" ("arguments", "code", "context", "created_at", "description", "environment_id", "id", "name", "requirements", "return_type", "server_side", "trained", "visibility") SELECT "arguments", "code", "context", "created_at", "description", "environment_id", "id", "name", "requirements", "return_type", "server_side", "trained", "visibility" FROM "custom_function";
DROP TABLE "custom_function";
ALTER TABLE "new_custom_function" RENAME TO "custom_function";
CREATE TABLE "new_webhook_handle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event_payload" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'ENVIRONMENT',
    CONSTRAINT "webhook_handle_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_webhook_handle" ("context", "created_at", "description", "environment_id", "event_payload", "id", "name", "visibility") SELECT "context", "created_at", "description", "environment_id", "event_payload", "id", "name", "visibility" FROM "webhook_handle";
DROP TABLE "webhook_handle";
ALTER TABLE "new_webhook_handle" RENAME TO "webhook_handle";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

UPDATE api_function SET visibility = 'ENVIRONMENT' WHERE visibility = 'TENANT';
UPDATE auth_provider SET visibility = 'ENVIRONMENT' WHERE visibility = 'TENANT';
UPDATE custom_function SET visibility = 'ENVIRONMENT' WHERE visibility = 'TENANT';
UPDATE webhook_handle SET visibility = 'ENVIRONMENT' WHERE visibility = 'TENANT';
