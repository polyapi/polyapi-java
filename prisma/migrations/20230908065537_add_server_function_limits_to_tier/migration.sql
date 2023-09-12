-- AlterTable
ALTER TABLE "limit_tier" ADD COLUMN "server_function_limit_cpu" INTEGER;
ALTER TABLE "limit_tier" ADD COLUMN "server_function_limit_memory" INTEGER;
ALTER TABLE "limit_tier" ADD COLUMN "server_function_limit_time" INTEGER;
