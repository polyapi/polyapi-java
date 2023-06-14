-- RedefineTables
PRAGMA foreign_keys=OFF;
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
    "visibility" TEXT NOT NULL DEFAULT 'TENANT',
    CONSTRAINT "custom_function_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_custom_function" ("arguments", "code", "context", "created_at", "description", "environment_id", "id", "name", "requirements", "return_type", "server_side", "trained", "visibility") SELECT "arguments", "code", "context", "created_at", "description", "environment_id", "id", "name", "requirements", "return_type", "server_side", "trained", "visibility" FROM "custom_function";
DROP TABLE "custom_function";
ALTER TABLE "new_custom_function" RENAME TO "custom_function";
CREATE TABLE "new_webhook_defined" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "message_id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    CONSTRAINT "webhook_defined_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_webhook_defined" ("id", "message_id", "webhook_id") SELECT "id", "message_id", "webhook_id" FROM "webhook_defined";
DROP TABLE "webhook_defined";
ALTER TABLE "new_webhook_defined" RENAME TO "webhook_defined";
CREATE TABLE "new_conversation_message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    CONSTRAINT "conversation_message_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_conversation_message" ("content", "createdAt", "id", "name", "role", "user_id") SELECT "content", "createdAt", "id", "name", "role", "user_id" FROM "conversation_message";
DROP TABLE "conversation_message";
ALTER TABLE "new_conversation_message" RENAME TO "conversation_message";
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "vip" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user" ("created_at", "id", "name", "role", "tenant_id", "vip") SELECT "created_at", "id", "name", "role", "tenant_id", "vip" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
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
    "visibility" TEXT NOT NULL DEFAULT 'TENANT',
    CONSTRAINT "auth_provider_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_auth_provider" ("audience_required", "authorize_url", "context", "created_at", "environment_id", "id", "introspect_url", "name", "refresh_enabled", "revoke_url", "token_url", "trained", "visibility") SELECT "audience_required", "authorize_url", "context", "created_at", "environment_id", "id", "introspect_url", "name", "refresh_enabled", "revoke_url", "token_url", "trained", "visibility" FROM "auth_provider";
DROP TABLE "auth_provider";
ALTER TABLE "new_auth_provider" RENAME TO "auth_provider";
CREATE TABLE "new_webhook_handle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event_payload" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'TENANT',
    CONSTRAINT "webhook_handle_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_webhook_handle" ("context", "created_at", "description", "environment_id", "event_payload", "id", "name", "visibility") SELECT "context", "created_at", "description", "environment_id", "event_payload", "id", "name", "visibility" FROM "webhook_handle";
DROP TABLE "webhook_handle";
ALTER TABLE "new_webhook_handle" RENAME TO "webhook_handle";
CREATE TABLE "new_api_key" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "application_id" TEXT,
    "user_id" TEXT,
    CONSTRAINT "api_key_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "api_key_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "api_key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_api_key" ("application_id", "created_at", "environment_id", "id", "key", "name", "permissions", "user_id") SELECT "application_id", "created_at", "environment_id", "id", "key", "name", "permissions", "user_id" FROM "api_key";
DROP TABLE "api_key";
ALTER TABLE "new_api_key" RENAME TO "api_key";
CREATE UNIQUE INDEX "api_key_key_key" ON "api_key"("key");
CREATE TABLE "new_gpt_plugin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description_for_marketplace" TEXT NOT NULL DEFAULT '',
    "description_for_model" TEXT NOT NULL DEFAULT '',
    "icon_url" TEXT NOT NULL,
    "functionIds" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    CONSTRAINT "gpt_plugin_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_gpt_plugin" ("description_for_marketplace", "description_for_model", "environment_id", "functionIds", "icon_url", "id", "name", "slug") SELECT "description_for_marketplace", "description_for_model", "environment_id", "functionIds", "icon_url", "id", "name", "slug" FROM "gpt_plugin";
DROP TABLE "gpt_plugin";
ALTER TABLE "new_gpt_plugin" RENAME TO "gpt_plugin";
CREATE UNIQUE INDEX "gpt_plugin_slug_key" ON "gpt_plugin"("slug");
CREATE TABLE "new_environment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    CONSTRAINT "environment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_environment" ("created_at", "id", "name", "subdomain", "tenant_id") SELECT "created_at", "id", "name", "subdomain", "tenant_id" FROM "environment";
DROP TABLE "environment";
ALTER TABLE "new_environment" RENAME TO "environment";
CREATE UNIQUE INDEX "environment_subdomain_key" ON "environment"("subdomain");
CREATE TABLE "new_team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    CONSTRAINT "team_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_team" ("created_at", "id", "name", "tenant_id") SELECT "created_at", "id", "name", "tenant_id" FROM "team";
DROP TABLE "team";
ALTER TABLE "new_team" RENAME TO "team";
CREATE TABLE "new_function_defined" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "message_id" TEXT NOT NULL,
    "function_id" TEXT NOT NULL,
    CONSTRAINT "function_defined_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_function_defined" ("function_id", "id", "message_id") SELECT "function_id", "id", "message_id" FROM "function_defined";
DROP TABLE "function_defined";
ALTER TABLE "new_function_defined" RENAME TO "function_defined";
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
    "visibility" TEXT NOT NULL DEFAULT 'TENANT',
    CONSTRAINT "api_function_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_api_function" ("arguments_metadata", "auth", "body", "context", "created_at", "description", "environment_id", "headers", "id", "method", "name", "payload", "response", "trained", "url", "visibility") SELECT "arguments_metadata", "auth", "body", "context", "created_at", "description", "environment_id", "headers", "id", "method", "name", "payload", "response", "trained", "url", "visibility" FROM "api_function";
DROP TABLE "api_function";
ALTER TABLE "new_api_function" RENAME TO "api_function";
CREATE TABLE "new_application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "application_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_application" ("created_at", "description", "id", "name", "tenant_id") SELECT "created_at", "description", "id", "name", "tenant_id" FROM "application";
DROP TABLE "application";
ALTER TABLE "new_application" RENAME TO "application";
CREATE TABLE "new_auth_token" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auth_provider_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "callback_url" TEXT,
    "audience" TEXT,
    "scopes" TEXT NOT NULL,
    "state" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "events_client_id" TEXT,
    CONSTRAINT "auth_token_auth_provider_id_fkey" FOREIGN KEY ("auth_provider_id") REFERENCES "auth_provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_auth_token" ("access_token", "audience", "auth_provider_id", "callback_url", "client_id", "client_secret", "created_at", "events_client_id", "id", "refresh_token", "scopes", "state") SELECT "access_token", "audience", "auth_provider_id", "callback_url", "client_id", "client_secret", "created_at", "events_client_id", "id", "refresh_token", "scopes", "state" FROM "auth_token";
DROP TABLE "auth_token";
ALTER TABLE "new_auth_token" RENAME TO "auth_token";
CREATE TABLE "new_system_prompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    CONSTRAINT "system_prompt_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_system_prompt" ("content", "createdAt", "environment_id", "id") SELECT "content", "createdAt", "environment_id", "id" FROM "system_prompt";
DROP TABLE "system_prompt";
ALTER TABLE "new_system_prompt" RENAME TO "system_prompt";
CREATE TABLE "new_team_member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_team_member" ("created_at", "id", "team_id", "user_id") SELECT "created_at", "id", "team_id", "user_id" FROM "team_member";
DROP TABLE "team_member";
ALTER TABLE "new_team_member" RENAME TO "team_member";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
