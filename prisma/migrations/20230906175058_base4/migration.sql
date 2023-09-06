/*
  Warnings:

  - A unique constraint covering the columns `[createdat]` on the table `conversation_message` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "conversation_createdat_key";

-- AlterTable
ALTER TABLE "conversation_message" ALTER COLUMN "createdat" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "conversation_message_createdat_key" ON "conversation_message"("createdat");
