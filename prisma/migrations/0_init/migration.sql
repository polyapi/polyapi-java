-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "public_visibility_allowed" BOOLEAN DEFAULT false,
    "limit_tier_id" TEXT,

    CONSTRAINT "idx_20369_sqlite_autoindex_tenant_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "tenant_id" TEXT,
    "role" TEXT DEFAULT 'USER',
    "vip" BOOLEAN DEFAULT false,

    CONSTRAINT "idx_20220_sqlite_autoindex_user_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "tenant_id" TEXT,

    CONSTRAINT "idx_20235_sqlite_autoindex_team_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "team_id" TEXT,
    "user_id" TEXT,

    CONSTRAINT "idx_20260_sqlite_autoindex_team_member_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environment" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "tenant_id" TEXT,
    "subdomain" TEXT,

    CONSTRAINT "idx_20318_sqlite_autoindex_environment_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT,
    "name" TEXT,
    "description" TEXT DEFAULT '',

    CONSTRAINT "idx_20241_sqlite_autoindex_application_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "environment_id" TEXT,
    "key" TEXT,
    "permissions" TEXT DEFAULT '{}',
    "application_id" TEXT,
    "user_id" TEXT,

    CONSTRAINT "idx_20228_sqlite_autoindex_api_key_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_function" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT,
    "name" TEXT,
    "context" TEXT,
    "description" TEXT DEFAULT '',
    "payload" TEXT,
    "method" TEXT,
    "url" TEXT,
    "headers" TEXT,
    "body" TEXT,
    "auth" TEXT,
    "response_type" TEXT,
    "arguments_metadata" TEXT,
    "trained" BOOLEAN DEFAULT false,
    "visibility" TEXT DEFAULT 'ENVIRONMENT',
    "graphql_identifier" TEXT,
    "introspection_response" TEXT,

    CONSTRAINT "idx_20274_sqlite_autoindex_api_function_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_function" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT,
    "name" TEXT,
    "context" TEXT,
    "description" TEXT DEFAULT '',
    "code" TEXT,
    "arguments" TEXT,
    "return_type" TEXT,
    "synchronous" BOOLEAN DEFAULT true,
    "requirements" TEXT,
    "trained" BOOLEAN DEFAULT false,
    "server_side" BOOLEAN DEFAULT false,
    "visibility" TEXT DEFAULT 'ENVIRONMENT',
    "api_key" TEXT,

    CONSTRAINT "idx_20324_sqlite_autoindex_custom_function_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_provider" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT,
    "name" TEXT,
    "context" TEXT,
    "authorize_url" TEXT,
    "token_url" TEXT,
    "revoke_url" TEXT,
    "introspect_url" TEXT,
    "audience_required" BOOLEAN DEFAULT false,
    "refresh_enabled" BOOLEAN DEFAULT false,
    "trained" BOOLEAN DEFAULT false,
    "visibility" TEXT DEFAULT 'ENVIRONMENT',

    CONSTRAINT "idx_20283_sqlite_autoindex_auth_provider_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_handle" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT,
    "context" TEXT,
    "name" TEXT,
    "event_payload" TEXT,
    "description" TEXT DEFAULT '',
    "visibility" TEXT DEFAULT 'ENVIRONMENT',

    CONSTRAINT "idx_20293_sqlite_autoindex_webhook_handle_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_message" (
    "id" TEXT NOT NULL,
    "createdat" TEXT DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "name" TEXT DEFAULT '',
    "role" TEXT,
    "type" BIGINT DEFAULT 1,
    "content" TEXT,
    "conversation_id" TEXT,

    CONSTRAINT "idx_20266_sqlite_autoindex_conversation_message_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_prompt" (
    "id" TEXT NOT NULL,
    "createdat" TEXT DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT,
    "content" TEXT,

    CONSTRAINT "idx_20254_sqlite_autoindex_system_prompt_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_token" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "auth_provider_id" TEXT,
    "client_id" TEXT,
    "client_secret" TEXT,
    "callback_url" TEXT,
    "audience" TEXT,
    "scopes" TEXT,
    "state" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "events_client_id" TEXT,
    "user_id" TEXT,

    CONSTRAINT "idx_20248_sqlite_autoindex_auth_token_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_variable" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "value" TEXT,
    "tenant_id" TEXT,
    "environment_id" TEXT,

    CONSTRAINT "idx_20302_config_variable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpt_plugin" (
    "id" BIGSERIAL NOT NULL,
    "slug" TEXT,
    "name" TEXT,
    "contactemail" TEXT DEFAULT 'info@polyapi.io',
    "legalurl" TEXT DEFAULT 'https://polyapi.io/legal',
    "description_for_marketplace" TEXT DEFAULT '',
    "description_for_model" TEXT DEFAULT '',
    "icon_url" TEXT,
    "functionids" TEXT,
    "environment_id" TEXT,
    "auth_type" TEXT DEFAULT 'user_http',
    "authtoken" TEXT DEFAULT '',

    CONSTRAINT "idx_20342_gpt_plugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variable" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT,
    "name" TEXT,
    "context" TEXT,
    "description" TEXT DEFAULT '',
    "visibility" TEXT DEFAULT 'ENVIRONMENT',
    "secret" BOOLEAN DEFAULT false,

    CONSTRAINT "idx_20309_sqlite_autoindex_variable_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "file_name" TEXT,

    CONSTRAINT "idx_20335_sqlite_autoindex_migration_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limit_tier" (
    "id" TEXT NOT NULL,
    "name" TEXT DEFAULT '',
    "max_functions" BIGINT,
    "chat_questions_per_day" BIGINT,
    "function_calls_per_day" BIGINT,

    CONSTRAINT "idx_20382_sqlite_autoindex_limit_tier_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statistics" (
    "id" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT,
    "api_key" TEXT,
    "tenant_id" TEXT,
    "environment_id" TEXT,
    "user_id" TEXT,
    "application_id" TEXT,
    "data" TEXT,

    CONSTRAINT "idx_20376_sqlite_autoindex_statistics_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "createdat" TEXT DEFAULT CURRENT_TIMESTAMP,
    "userid" TEXT,
    "workspacefolder" TEXT DEFAULT '',

    CONSTRAINT "idx_20362_sqlite_autoindex_conversation_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docsection" (
    "id" TEXT NOT NULL,
    "title" TEXT DEFAULT '',
    "text" TEXT DEFAULT '',
    "vector" TEXT DEFAULT '',

    CONSTRAINT "idx_20354_sqlite_autoindex_docsection_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_and_found" (
    "rootpgno" BIGINT,
    "pgno" BIGINT,
    "nfield" BIGINT,
    "id" BIGINT,
    "c0" TEXT,
    "c1" TEXT,
    "c2" TEXT,
    "c3" TEXT,
    "c4" TEXT,
    "c5" TEXT,
    "c6" TEXT,
    "c7" TEXT,
    "c8" TEXT,
    "c9" TEXT,
    "c10" TEXT,
    "c11" TEXT,
    "c12" TEXT,
    "c13" TEXT,
    "c14" TEXT,
    "c15" TEXT,
    "c16" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_20318_environment_subdomain_key" ON "environment"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "idx_20228_api_key_key_key" ON "api_key"("key");

-- CreateIndex
CREATE UNIQUE INDEX "idx_20266_conversation_message_createdat_key" ON "conversation_message"("createdat");

-- CreateIndex
CREATE UNIQUE INDEX "idx_20342_gpt_plugin_slug_environment_id_key" ON "gpt_plugin"("slug", "environment_id");

-- AddForeignKey
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_limit_tier_id_fkey" FOREIGN KEY ("limit_tier_id") REFERENCES "limit_tier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environment" ADD CONSTRAINT "environment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_function" ADD CONSTRAINT "api_function_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_function" ADD CONSTRAINT "custom_function_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_provider" ADD CONSTRAINT "auth_provider_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_handle" ADD CONSTRAINT "webhook_handle_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_message" ADD CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_message" ADD CONSTRAINT "conversation_message_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_prompt" ADD CONSTRAINT "system_prompt_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_token" ADD CONSTRAINT "auth_token_auth_provider_id_fkey" FOREIGN KEY ("auth_provider_id") REFERENCES "auth_provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_variable" ADD CONSTRAINT "config_variable_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_variable" ADD CONSTRAINT "config_variable_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gpt_plugin" ADD CONSTRAINT "gpt_plugin_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variable" ADD CONSTRAINT "variable_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_userid_fkey" FOREIGN KEY ("userid") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

