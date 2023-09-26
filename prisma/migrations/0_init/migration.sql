-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "email" TEXT,
    "public_visibility_allowed" BOOLEAN NOT NULL DEFAULT false,
    "public_namespace" TEXT,
    "limit_tier_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "idx_25978_sqlite_autoindex_tenant_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,

    CONSTRAINT "idx_25843_sqlite_autoindex_user_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "idx_25858_sqlite_autoindex_team_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "idx_25883_sqlite_autoindex_team_member_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environment" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,

    CONSTRAINT "idx_25933_sqlite_autoindex_environment_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "idx_25864_sqlite_autoindex_application_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "application_id" TEXT,
    "user_id" TEXT,

    CONSTRAINT "idx_25851_sqlite_autoindex_api_key_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_function" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

    CONSTRAINT "idx_25889_sqlite_autoindex_api_function_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_function" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "arguments" TEXT NOT NULL,
    "return_type" TEXT,
    "synchronous" BOOLEAN NOT NULL DEFAULT true,
    "requirements" TEXT,
    "trained" BOOLEAN NOT NULL DEFAULT false,
    "server_side" BOOLEAN NOT NULL DEFAULT false,
    "api_key" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'ENVIRONMENT',
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "idx_26019_sqlite_autoindex_custom_function_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_provider" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

    CONSTRAINT "idx_25898_sqlite_autoindex_auth_provider_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_handle" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event_payload" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'ENVIRONMENT',
    "response_headers" TEXT,
    "response_payload" TEXT,
    "response_status" INTEGER,
    "subpath" TEXT,
    "method" TEXT,
    "security_function_ids" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "idx_25908_sqlite_autoindex_webhook_handle_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "createdat" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userid" TEXT,
    "applicationid" TEXT,
    "workspacefolder" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "idx_26012_sqlite_autoindex_conversation_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_message" (
    "id" TEXT NOT NULL,
    "createdat" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL,
    "type" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,

    CONSTRAINT "idx_26004_sqlite_autoindex_conversation_message_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_prompt" (
    "id" TEXT NOT NULL,
    "createdat" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "idx_25877_sqlite_autoindex_system_prompt_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_token" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "user_id" TEXT,

    CONSTRAINT "idx_25871_sqlite_autoindex_auth_token_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_variable" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "tenant_id" TEXT,
    "environment_id" TEXT,

    CONSTRAINT "idx_25926_config_variable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpt_plugin" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactemail" TEXT NOT NULL DEFAULT 'info@polyapi.io',
    "legalurl" TEXT NOT NULL DEFAULT 'https://polyapi.io/legal',
    "description_for_marketplace" TEXT NOT NULL DEFAULT '',
    "description_for_model" TEXT NOT NULL DEFAULT '',
    "icon_url" TEXT NOT NULL,
    "functionids" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "auth_type" TEXT NOT NULL DEFAULT 'user_http',
    "authtoken" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "idx_25946_gpt_plugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variable" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'ENVIRONMENT',
    "secret" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "idx_25916_sqlite_autoindex_variable_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_name" TEXT NOT NULL,

    CONSTRAINT "idx_25939_sqlite_autoindex_migration_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docsection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "vector" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "idx_25958_sqlite_autoindex_docsection_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limit_tier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "max_functions" INTEGER,
    "chat_questions_per_day" INTEGER,
    "function_calls_per_day" INTEGER,
    "variable_calls_per_day" INTEGER,
    "server_function_limit_cpu" INTEGER,
    "server_function_limit_memory" INTEGER,
    "server_function_limit_time" INTEGER,

    CONSTRAINT "idx_25972_sqlite_autoindex_limit_tier_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statistics" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "user_id" TEXT,
    "application_id" TEXT,
    "data" TEXT,

    CONSTRAINT "idx_25966_sqlite_autoindex_statistics_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_sign_up" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "verification_code" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idx_25985_sqlite_autoindex_tenant_sign_up_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tos" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL,

    CONSTRAINT "idx_25991_sqlite_autoindex_tos_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_agreement" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "agreed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT NOT NULL,
    "tos_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "idx_25997_sqlite_autoindex_tenant_agreement_1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perf_log" (
    "id" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "snippet" TEXT NOT NULL,
    "input_length" INTEGER NOT NULL,
    "output_length" INTEGER NOT NULL,
    "type" INTEGER NOT NULL,
    "data" TEXT NOT NULL DEFAULT '',
    "load" INTEGER NOT NULL DEFAULT 0,
    "application_id" TEXT,
    "user_id" TEXT,

    CONSTRAINT "perf_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_25978_tenant_name_key" ON "tenant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "idx_25978_tenant_email_key" ON "tenant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "idx_25843_user_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "idx_25933_environment_subdomain_key" ON "environment"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "idx_25851_api_key_key_key" ON "api_key"("key");

-- CreateIndex
CREATE UNIQUE INDEX "idx_26004_conversation_message_createdat_key" ON "conversation_message"("createdat");

-- CreateIndex
CREATE UNIQUE INDEX "idx_25946_gpt_plugin_slug_environment_id_key" ON "gpt_plugin"("slug", "environment_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_25985_tenant_sign_up_email_key" ON "tenant_sign_up"("email");

-- CreateIndex
CREATE UNIQUE INDEX "idx_25985_tenant_sign_up_verification_code_key" ON "tenant_sign_up"("verification_code");

-- CreateIndex
CREATE UNIQUE INDEX "idx_25991_tos_version_key" ON "tos"("version");

-- AddForeignKey
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_limit_tier_id_fkey" FOREIGN KEY ("limit_tier_id") REFERENCES "limit_tier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environment" ADD CONSTRAINT "environment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_function" ADD CONSTRAINT "api_function_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_function" ADD CONSTRAINT "custom_function_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_provider" ADD CONSTRAINT "auth_provider_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_handle" ADD CONSTRAINT "webhook_handle_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_applicationid_fkey" FOREIGN KEY ("applicationid") REFERENCES "application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_message" ADD CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "tenant_agreement" ADD CONSTRAINT "tenant_agreement_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_agreement" ADD CONSTRAINT "tenant_agreement_tos_id_fkey" FOREIGN KEY ("tos_id") REFERENCES "tos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perf_log" ADD CONSTRAINT "perf_log_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perf_log" ADD CONSTRAINT "perf_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

