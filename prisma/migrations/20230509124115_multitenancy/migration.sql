/*
  Warnings:

  - You are about to drop the column `user_id` on the `auth_token` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `config_variable` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `webhook_handle` table. All the data in the column will be lost.
  - The primary key for the `custom_function` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `public_id` on the `custom_function` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `custom_function` table. All the data in the column will be lost.
  - You are about to drop the column `functionPublicId` on the `function_defined` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `auth_provider` table. All the data in the column will be lost.
  - The primary key for the `user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `api_key` on the `user` table. All the data in the column will be lost.
  - The primary key for the `api_function` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `public_id` on the `api_function` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `api_function` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `system_prompt` table. All the data in the column will be lost.
  - Added the required column `environment_id` to the `webhook_handle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `environment_id` to the `custom_function` table without a default value. This is not possible if the table is not empty.
  - Added the required column `function_id` to the `function_defined` table without a default value. This is not possible if the table is not empty.
  - Added the required column `environment_id` to the `auth_provider` table without a default value. This is not possible if the table is not empty.
  - Added the required column `environment_id` to the `api_function` table without a default value. This is not possible if the table is not empty.
  - Added the required column `environment_id` to the `system_prompt` table without a default value. This is not possible if the table is not empty.

*/

-- create temp table with id values
CREATE TABLE "temp_vars"
(
  "id"           INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "polyTenantId" TEXT    NOT NULL,
  "polyTeamId"   TEXT    NOT NULL,
  "polyEnvId"    TEXT    NOT NULL,
  "polyUserId"   TEXT    NOT NULL
);

INSERT INTO "temp_vars" ("polyTenantId", "polyTeamId", "polyEnvId", "polyUserId")
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
              substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
              substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
              substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
              substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
              hex(randomblob(6))));

-- CreateTable
CREATE TABLE "tenant"
(
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"       TEXT     NOT NULL,
  "tempUserId" INTEGER
);

-- create tenants for all current users
INSERT INTO "tenant" ("id", "created_at", "name", "tempUserId")
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
             substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       cast(strftime('%s', 'now') as int) * 1000,
       "name",
       "id"
FROM "user"
WHERE api_key <> 'ab4f62d3421bca3674hfd627'
  AND api_key <> '';

-- create poly tenant
INSERT INTO "tenant" ("id", "created_at", "name")
SELECT "polyTenantId", cast(strftime('%s', 'now') as int) * 1000, 'poly'
FROM "temp_vars";

-- CreateTable
CREATE TABLE "team"
(
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"       TEXT     NOT NULL,
  "tenant_id"  TEXT     NOT NULL,
  "tempUserId" INTEGER,
  CONSTRAINT "team_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- create default team for non-poly users
INSERT INTO "team" ("id", "created_at", "name", "tenant_id", "tempUserId")
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
             substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       cast(strftime('%s', 'now') as int) * 1000,
       'default',
       "id",
       "tempUserId"
FROM "tenant"
WHERE "name" <> 'poly';

-- create poly team
INSERT INTO "team" ("id", "created_at", "name", "tenant_id")
SELECT "polyTeamId",
       cast(strftime('%s', 'now') as int) * 1000,
       'Admins',
       "polyTenantId"
FROM "temp_vars";

-- CreateTable
CREATE TABLE "environment"
(
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"       TEXT     NOT NULL,
  "tenant_id"  TEXT     NOT NULL,
  "app_key"    TEXT     NOT NULL,
  "tempUserId" INTEGER,
  CONSTRAINT "environment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- create environments for non-poly tenants
INSERT INTO "environment" ("id", "created_at", "name", "tenant_id", "app_key", "tempUserId")
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
             substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       cast(strftime('%s', 'now') as int) * 1000,
       'default',
       "id",
       lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
             substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       "tempUserId"
FROM "tenant"
WHERE "name" <> 'poly';

-- create poly environment
INSERT INTO "environment" ("id", "created_at", "name", "tenant_id", "app_key", "tempUserId")
SELECT "polyEnvId",
       cast(strftime('%s', 'now') as int) * 1000,
       'default',
       "polyTenantId",
       'ab4f62d3421bca3674hfd627',
       (SELECT "id" FROM "user" WHERE "api_key" = 'ab4f62d3421bca3674hfd627')
FROM "temp_vars";

CREATE TABLE "new_user"
(
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"       TEXT     NOT NULL,
  "team_id"    TEXT,
  "role"       TEXT     NOT NULL DEFAULT 'USER',
  "vip"        BOOLEAN  NOT NULL DEFAULT false,
  "tempUserId" INTEGER,
  CONSTRAINT "user_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- create admin users for non-poly tenants
INSERT INTO "new_user" ("id", "created_at", "name", "team_id", "role", "vip", "tempUserId")
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
             substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       cast(strftime('%s', 'now') as int) * 1000,
       COALESCE("name", ''),
       (SELECT "id" FROM "team" WHERE "tempUserId" = "user"."id"),
       'ADMIN',
       false,
       "user"."id"
FROM "user"
WHERE api_key <> 'ab4f62d3421bca3674hfd627'
  AND api_key <> '';


-- create poly super admin user
INSERT INTO "new_user" ("id", "created_at", "name", "team_id", "role", "vip")
SELECT "polyUserId",
       cast(strftime('%s', 'now') as int) * 1000,
       'Super Admin',
       "polyTeamId",
       'SUPER_ADMIN',
       false
FROM "temp_vars";

PRAGMA foreign_keys= OFF;
ALTER TABLE "user"
  RENAME TO "old_user";
ALTER TABLE "new_user"
  RENAME TO "user";

-- CreateTable
CREATE TABLE "user_key"
(
  "id"             TEXT     NOT NULL PRIMARY KEY,
  "created_at"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "user_id"        TEXT     NOT NULL,
  "environment_id" TEXT     NOT NULL,
  "key"            TEXT     NOT NULL,
  CONSTRAINT "user_key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "user_key_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- create user keys for non-poly tenants
INSERT INTO "user_key" ("id", "created_at", "user_id", "environment_id", "key")
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
             substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       cast(strftime('%s', 'now') as int) * 1000,
       "id",
       (SELECT "id" FROM "environment" WHERE "tempUserId" = "user"."tempUserId"),
       (SELECT "api_key" FROM "old_user" WHERE "old_user"."id" = "user"."tempUserId")
FROM "user"
WHERE "role" <> 'SUPER_ADMIN';


-- create poly super admin user key
INSERT INTO "user_key" ("id", "created_at", "user_id", "environment_id", "key")
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
             substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       cast(strftime('%s', 'now') as int) * 1000,
       "polyUserId",
       "polyEnvId",
       'suab4f62d3421bca3674hfd627'
FROM "temp_vars";

-- RedefineTables
CREATE TABLE "new_auth_token"
(
  "id"               TEXT     NOT NULL PRIMARY KEY,
  "created_at"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "auth_provider_id" TEXT     NOT NULL,
  "client_id"        TEXT     NOT NULL,
  "client_secret"    TEXT     NOT NULL,
  "callback_url"     TEXT,
  "audience"         TEXT,
  "scopes"           TEXT     NOT NULL,
  "state"            TEXT,
  "access_token"     TEXT,
  "refresh_token"    TEXT,
  "events_client_id" TEXT,
  CONSTRAINT "auth_token_auth_provider_id_fkey" FOREIGN KEY ("auth_provider_id") REFERENCES "auth_provider" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
DROP TABLE "auth_token";
ALTER TABLE "new_auth_token"
  RENAME TO "auth_token";

CREATE TABLE "new_config_variable"
(
  "id"         INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"       TEXT     NOT NULL,
  "value"      TEXT     NOT NULL
);
INSERT INTO "new_config_variable" ("id", "name", "created_at", "value")
SELECT "id", "name", "createdAt", "value"
FROM "config_variable";

DROP TABLE "config_variable";
ALTER TABLE "new_config_variable"
  RENAME TO "config_variable";
CREATE UNIQUE INDEX "config_variable_name_key" ON "config_variable" ("name");


CREATE TABLE "new_webhook_handle"
(
  "id"             TEXT     NOT NULL PRIMARY KEY,
  "created_at"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "environment_id" TEXT     NOT NULL,
  "context"        TEXT     NOT NULL,
  "name"           TEXT     NOT NULL,
  "event_payload"  TEXT     NOT NULL,
  "description"    TEXT     NOT NULL DEFAULT '',
  "visibility"     TEXT     NOT NULL DEFAULT 'TENANT',
  CONSTRAINT "webhook_handle_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_webhook_handle" ("context", "created_at", "description", "event_payload", "id", "name",
                                  "environment_id")
SELECT "context",
       "created_at",
       "description",
       "event_payload",
       "id",
       "name",
       (SELECT "id" FROM "environment" WHERE "tempUserId" = "user_id")
FROM "webhook_handle";
DROP TABLE "webhook_handle";
ALTER TABLE "new_webhook_handle"
  RENAME TO "webhook_handle";


CREATE TABLE "new_custom_function"
(
  "id"             TEXT     NOT NULL PRIMARY KEY,
  "created_at"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "environment_id" TEXT     NOT NULL,
  "name"           TEXT     NOT NULL,
  "context"        TEXT     NOT NULL,
  "description"    TEXT     NOT NULL DEFAULT '',
  "code"           TEXT     NOT NULL,
  "arguments"      TEXT     NOT NULL,
  "return_type"    TEXT,
  "trained"        BOOLEAN  NOT NULL DEFAULT false,
  "server_side"    BOOLEAN  NOT NULL DEFAULT false,
  "visibility"     TEXT     NOT NULL DEFAULT 'TENANT',
  CONSTRAINT "custom_function_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_custom_function" ("arguments", "code", "context", "created_at", "description", "id", "name",
                                   "return_type", "server_side", "trained", "environment_id")
SELECT "arguments",
       "code",
       "context",
       "created_at",
       "description",
       "public_id",
       "name",
       "return_type",
       "server_side",
       "trained",
       (SELECT "id" FROM "environment" WHERE "tempUserId" = "user_id")
FROM "custom_function";
DROP TABLE "custom_function";
ALTER TABLE "new_custom_function"
  RENAME TO "custom_function";


CREATE TABLE "new_function_defined"
(
  "id"          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "message_id"  TEXT    NOT NULL,
  "function_id" TEXT    NOT NULL,
  CONSTRAINT "function_defined_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_function_defined" ("id", "message_id", "function_id")
SELECT "id", "message_id", "functionPublicId"
FROM "function_defined";
DROP TABLE "function_defined";
ALTER TABLE "new_function_defined"
  RENAME TO "function_defined";


CREATE TABLE "new_webhook_defined"
(
  "id"         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "message_id" TEXT    NOT NULL,
  "webhook_id" TEXT    NOT NULL,
  CONSTRAINT "webhook_defined_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_webhook_defined" ("id", "message_id", "webhook_id")
SELECT "id", "message_id", "webhookPublicId"
FROM "webhook_defined";
DROP TABLE "webhook_defined";
ALTER TABLE "new_webhook_defined"
  RENAME TO "webhook_defined";


CREATE TABLE "new_auth_provider"
(
  "id"                TEXT     NOT NULL PRIMARY KEY,
  "created_at"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "environment_id"    TEXT     NOT NULL,
  "name"              TEXT,
  "context"           TEXT     NOT NULL,
  "authorize_url"     TEXT     NOT NULL,
  "token_url"         TEXT     NOT NULL,
  "revoke_url"        TEXT,
  "introspect_url"    TEXT,
  "audience_required" BOOLEAN  NOT NULL DEFAULT false,
  "refresh_enabled"   BOOLEAN  NOT NULL DEFAULT false,
  "trained"           BOOLEAN  NOT NULL DEFAULT false,
  "visibility"        TEXT     NOT NULL DEFAULT 'TENANT',
  CONSTRAINT "auth_provider_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_auth_provider" ("audience_required", "authorize_url", "name", "context", "created_at", "id",
                                 "introspect_url",
                                 "refresh_enabled", "revoke_url", "token_url", "trained", "environment_id")
SELECT "audience_required",
       "authorize_url",
       "name",
       "context",
       "created_at",
       "id",
       "introspect_url",
       "refresh_enabled",
       "revoke_url",
       "token_url",
       "trained",
       (SELECT "id" FROM "environment" WHERE "tempUserId" = "user_id")
FROM "auth_provider";
DROP TABLE "auth_provider";
ALTER TABLE "new_auth_provider"
  RENAME TO "auth_provider";


CREATE TABLE "new_conversation_message"
(
  "id"             TEXT     NOT NULL PRIMARY KEY,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "environment_id" TEXT     NOT NULL,
  "name"           TEXT     NOT NULL DEFAULT '',
  "role"           TEXT     NOT NULL,
  "content"        TEXT     NOT NULL,
  CONSTRAINT "conversation_message_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_conversation_message" ("content", "createdAt", "id", "name", "role", "environment_id")
SELECT "content", "createdAt", "id", "name", "role", (SELECT "id" FROM "environment" WHERE "tempUserId" = "user_id")
FROM "conversation_message";
DROP TABLE "conversation_message";
ALTER TABLE "new_conversation_message"
  RENAME TO "conversation_message";


CREATE TABLE "new_api_function"
(
  "id"                 TEXT     NOT NULL PRIMARY KEY,
  "created_at"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "environment_id"     TEXT     NOT NULL,
  "name"               TEXT     NOT NULL,
  "context"            TEXT     NOT NULL,
  "description"        TEXT     NOT NULL DEFAULT '',
  "payload"            TEXT,
  "method"             TEXT     NOT NULL,
  "url"                TEXT     NOT NULL,
  "headers"            TEXT,
  "body"               TEXT,
  "auth"               TEXT,
  "response"           TEXT,
  "arguments_metadata" TEXT,
  "trained"            BOOLEAN  NOT NULL DEFAULT false,
  "visibility"         TEXT     NOT NULL DEFAULT 'TENANT',
  CONSTRAINT "api_function_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_api_function" ("arguments_metadata", "auth", "body", "context", "created_at", "description", "headers",
                                "id", "method", "name", "payload", "response", "trained", "url", "environment_id")
SELECT "arguments_metadata",
       "auth",
       "body",
       "context",
       "created_at",
       "description",
       "headers",
       "public_id",
       "method",
       "name",
       "payload",
       "response",
       "trained",
       "url",
       (SELECT "id" FROM "environment" WHERE "tempUserId" = "user_id")
FROM "api_function";
DROP TABLE "api_function";
ALTER TABLE "new_api_function"
  RENAME TO "api_function";


CREATE TABLE "new_system_prompt"
(
  "id"             TEXT     NOT NULL PRIMARY KEY,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "environment_id" TEXT     NOT NULL,
  "content"        TEXT     NOT NULL,
  CONSTRAINT "system_prompt_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_system_prompt" ("content", "createdAt", "id", "environment_id")
SELECT "content", "createdAt", "id", (SELECT "id" FROM "environment" WHERE "tempUserId" = "user_id")
FROM "system_prompt";
DROP TABLE "system_prompt";
ALTER TABLE "new_system_prompt"
  RENAME TO "system_prompt";

-- CreateIndex
CREATE UNIQUE INDEX "user_key_id_key" ON "user_key" ("id");

-- CreateIndex
CREATE UNIQUE INDEX "user_key_key_key" ON "user_key" ("key");

-- CreateIndex
CREATE UNIQUE INDEX "environment_app_key_key" ON "environment" ("app_key");

-- drop temporary tables and columns
ALTER TABLE "tenant"
  DROP COLUMN "tempUserId";
ALTER TABLE "environment"
  DROP COLUMN "tempUserId";
ALTER TABLE "team"
  DROP COLUMN "tempUserId";
ALTER TABLE "user"
  DROP COLUMN "tempUserId";
DROP TABLE "temp_vars";
DROP TABLE "old_user";

PRAGMA foreign_key_check;
PRAGMA foreign_keys= ON;

-- COMMIT;
