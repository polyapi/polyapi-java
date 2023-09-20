/*
  Warnings:

  - Made the column `created_at` on table `api_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `environment_id` on table `api_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `api_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `context` on table `api_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description` on table `api_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `method` on table `api_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `url` on table `api_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `trained` on table `api_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `visibility` on table `api_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `api_key` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `api_key` required. This step will fail if there are existing NULL values in that column.
  - Made the column `environment_id` on table `api_key` required. This step will fail if there are existing NULL values in that column.
  - Made the column `key` on table `api_key` required. This step will fail if there are existing NULL values in that column.
  - Made the column `permissions` on table `api_key` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `application` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `application` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `application` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description` on table `application` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `auth_provider` required. This step will fail if there are existing NULL values in that column.
  - Made the column `environment_id` on table `auth_provider` required. This step will fail if there are existing NULL values in that column.
  - Made the column `context` on table `auth_provider` required. This step will fail if there are existing NULL values in that column.
  - Made the column `authorize_url` on table `auth_provider` required. This step will fail if there are existing NULL values in that column.
  - Made the column `token_url` on table `auth_provider` required. This step will fail if there are existing NULL values in that column.
  - Made the column `audience_required` on table `auth_provider` required. This step will fail if there are existing NULL values in that column.
  - Made the column `refresh_enabled` on table `auth_provider` required. This step will fail if there are existing NULL values in that column.
  - Made the column `trained` on table `auth_provider` required. This step will fail if there are existing NULL values in that column.
  - Made the column `visibility` on table `auth_provider` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `auth_token` required. This step will fail if there are existing NULL values in that column.
  - Made the column `auth_provider_id` on table `auth_token` required. This step will fail if there are existing NULL values in that column.
  - Made the column `client_id` on table `auth_token` required. This step will fail if there are existing NULL values in that column.
  - Made the column `client_secret` on table `auth_token` required. This step will fail if there are existing NULL values in that column.
  - Made the column `scopes` on table `auth_token` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `config_variable` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `config_variable` required. This step will fail if there are existing NULL values in that column.
  - Made the column `value` on table `config_variable` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdat` on table `conversation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `workspacefolder` on table `conversation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdat` on table `conversation_message` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `conversation_message` required. This step will fail if there are existing NULL values in that column.
  - Made the column `role` on table `conversation_message` required. This step will fail if there are existing NULL values in that column.
  - Made the column `type` on table `conversation_message` required. This step will fail if there are existing NULL values in that column.
  - Made the column `content` on table `conversation_message` required. This step will fail if there are existing NULL values in that column.
  - Made the column `conversation_id` on table `conversation_message` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `environment_id` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `context` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `code` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `arguments` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `synchronous` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `trained` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `server_side` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `visibility` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `enabled` on table `custom_function` required. This step will fail if there are existing NULL values in that column.
  - Made the column `title` on table `docsection` required. This step will fail if there are existing NULL values in that column.
  - Made the column `text` on table `docsection` required. This step will fail if there are existing NULL values in that column.
  - Made the column `vector` on table `docsection` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `environment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `environment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `environment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `subdomain` on table `environment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `slug` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `contactemail` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `legalurl` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description_for_marketplace` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description_for_model` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon_url` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `functionids` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `environment_id` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `auth_type` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `authtoken` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `limit_tier` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `migration` required. This step will fail if there are existing NULL values in that column.
  - Made the column `file_name` on table `migration` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `statistics` required. This step will fail if there are existing NULL values in that column.
  - Made the column `type` on table `statistics` required. This step will fail if there are existing NULL values in that column.
  - Made the column `api_key` on table `statistics` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `statistics` required. This step will fail if there are existing NULL values in that column.
  - Made the column `environment_id` on table `statistics` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdat` on table `system_prompt` required. This step will fail if there are existing NULL values in that column.
  - Made the column `environment_id` on table `system_prompt` required. This step will fail if there are existing NULL values in that column.
  - Made the column `content` on table `system_prompt` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `team` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `team` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `team` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `team_member` required. This step will fail if there are existing NULL values in that column.
  - Made the column `team_id` on table `team_member` required. This step will fail if there are existing NULL values in that column.
  - Made the column `user_id` on table `team_member` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `tenant` required. This step will fail if there are existing NULL values in that column.
  - Made the column `public_visibility_allowed` on table `tenant` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `tenant_agreement` required. This step will fail if there are existing NULL values in that column.
  - Made the column `agreed_at` on table `tenant_agreement` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `tenant_agreement` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tos_id` on table `tenant_agreement` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `tenant_agreement` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `tenant_sign_up` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `tenant_sign_up` required. This step will fail if there are existing NULL values in that column.
  - Made the column `verification_code` on table `tenant_sign_up` required. This step will fail if there are existing NULL values in that column.
  - Made the column `expires_at` on table `tenant_sign_up` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `tos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `content` on table `tos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `version` on table `tos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `role` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `vip` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `variable` required. This step will fail if there are existing NULL values in that column.
  - Made the column `environment_id` on table `variable` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `variable` required. This step will fail if there are existing NULL values in that column.
  - Made the column `context` on table `variable` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description` on table `variable` required. This step will fail if there are existing NULL values in that column.
  - Made the column `visibility` on table `variable` required. This step will fail if there are existing NULL values in that column.
  - Made the column `secret` on table `variable` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `webhook_handle` required. This step will fail if there are existing NULL values in that column.
  - Made the column `environment_id` on table `webhook_handle` required. This step will fail if there are existing NULL values in that column.
  - Made the column `context` on table `webhook_handle` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `webhook_handle` required. This step will fail if there are existing NULL values in that column.
  - Made the column `event_payload` on table `webhook_handle` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description` on table `webhook_handle` required. This step will fail if there are existing NULL values in that column.
  - Made the column `visibility` on table `webhook_handle` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "conversation_message" DROP CONSTRAINT "conversation_message_conversation_id_fkey";

-- AlterTable
ALTER TABLE "api_function" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "environment_id" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "context" SET NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "method" SET NOT NULL,
ALTER COLUMN "url" SET NOT NULL,
ALTER COLUMN "trained" SET NOT NULL,
ALTER COLUMN "visibility" SET NOT NULL;

-- AlterTable
ALTER TABLE "api_key" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "environment_id" SET NOT NULL,
ALTER COLUMN "key" SET NOT NULL,
ALTER COLUMN "permissions" SET NOT NULL;

-- AlterTable
ALTER TABLE "application" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "tenant_id" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "auth_provider" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "environment_id" SET NOT NULL,
ALTER COLUMN "context" SET NOT NULL,
ALTER COLUMN "authorize_url" SET NOT NULL,
ALTER COLUMN "token_url" SET NOT NULL,
ALTER COLUMN "audience_required" SET NOT NULL,
ALTER COLUMN "refresh_enabled" SET NOT NULL,
ALTER COLUMN "trained" SET NOT NULL,
ALTER COLUMN "visibility" SET NOT NULL;

-- AlterTable
ALTER TABLE "auth_token" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "auth_provider_id" SET NOT NULL,
ALTER COLUMN "client_id" SET NOT NULL,
ALTER COLUMN "client_secret" SET NOT NULL,
ALTER COLUMN "scopes" SET NOT NULL;

-- AlterTable
ALTER TABLE "config_variable" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "value" SET NOT NULL;

-- AlterTable
ALTER TABLE "conversation" ALTER COLUMN "createdat" SET NOT NULL,
ALTER COLUMN "workspacefolder" SET NOT NULL;

-- AlterTable
ALTER TABLE "conversation_message" ALTER COLUMN "createdat" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "role" SET NOT NULL,
ALTER COLUMN "type" SET NOT NULL,
ALTER COLUMN "content" SET NOT NULL,
ALTER COLUMN "conversation_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "custom_function" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "environment_id" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "context" SET NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "arguments" SET NOT NULL,
ALTER COLUMN "synchronous" SET NOT NULL,
ALTER COLUMN "trained" SET NOT NULL,
ALTER COLUMN "server_side" SET NOT NULL,
ALTER COLUMN "visibility" SET NOT NULL,
ALTER COLUMN "enabled" SET NOT NULL;

-- AlterTable
ALTER TABLE "docsection" ALTER COLUMN "title" SET NOT NULL,
ALTER COLUMN "text" SET NOT NULL,
ALTER COLUMN "vector" SET NOT NULL;

-- AlterTable
ALTER TABLE "environment" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "tenant_id" SET NOT NULL,
ALTER COLUMN "subdomain" SET NOT NULL;

-- AlterTable
ALTER TABLE "gpt_plugin" ALTER COLUMN "slug" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "contactemail" SET NOT NULL,
ALTER COLUMN "legalurl" SET NOT NULL,
ALTER COLUMN "description_for_marketplace" SET NOT NULL,
ALTER COLUMN "description_for_model" SET NOT NULL,
ALTER COLUMN "icon_url" SET NOT NULL,
ALTER COLUMN "functionids" SET NOT NULL,
ALTER COLUMN "environment_id" SET NOT NULL,
ALTER COLUMN "auth_type" SET NOT NULL,
ALTER COLUMN "authtoken" SET NOT NULL;

-- AlterTable
ALTER TABLE "limit_tier" ALTER COLUMN "name" SET NOT NULL;

-- AlterTable
ALTER TABLE "migration" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "file_name" SET NOT NULL;

-- AlterTable
ALTER TABLE "statistics" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "type" SET NOT NULL,
ALTER COLUMN "api_key" SET NOT NULL,
ALTER COLUMN "tenant_id" SET NOT NULL,
ALTER COLUMN "environment_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "system_prompt" ALTER COLUMN "createdat" SET NOT NULL,
ALTER COLUMN "environment_id" SET NOT NULL,
ALTER COLUMN "content" SET NOT NULL;

-- AlterTable
ALTER TABLE "team" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "tenant_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "team_member" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "team_id" SET NOT NULL,
ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "tenant" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "public_visibility_allowed" SET NOT NULL;

-- AlterTable
ALTER TABLE "tenant_agreement" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "agreed_at" SET NOT NULL,
ALTER COLUMN "tenant_id" SET NOT NULL,
ALTER COLUMN "tos_id" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "tenant_sign_up" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "verification_code" SET NOT NULL,
ALTER COLUMN "expires_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "tos" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "content" SET NOT NULL,
ALTER COLUMN "version" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "tenant_id" SET NOT NULL,
ALTER COLUMN "role" SET NOT NULL,
ALTER COLUMN "vip" SET NOT NULL;

-- AlterTable
ALTER TABLE "variable" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "environment_id" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "context" SET NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "visibility" SET NOT NULL,
ALTER COLUMN "secret" SET NOT NULL;

-- AlterTable
ALTER TABLE "webhook_handle" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "environment_id" SET NOT NULL,
ALTER COLUMN "context" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "event_payload" SET NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "visibility" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "conversation_message" ADD CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
