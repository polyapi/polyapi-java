-- AlterTable
ALTER TABLE "custom_function" ADD COLUMN     "logsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "environment" ADD COLUMN     "logsDefault" BOOLEAN NOT NULL DEFAULT false;
