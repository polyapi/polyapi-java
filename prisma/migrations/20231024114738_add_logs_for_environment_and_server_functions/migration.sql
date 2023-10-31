-- AlterTable
ALTER TABLE "custom_function" ADD COLUMN     "logs_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "environment" ADD COLUMN     "logs_default" BOOLEAN NOT NULL DEFAULT false;
