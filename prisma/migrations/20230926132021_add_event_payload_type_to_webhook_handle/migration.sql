/*
  Warnings:

  - Added the required column `event_payload_type` to the `webhook_handle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "webhook_handle" ADD COLUMN     "event_payload_type" TEXT NOT NULL DEFAULT '';
ALTER TABLE "webhook_handle" ALTER COLUMN "event_payload" DROP NOT NULL;
