/*
  Warnings:

  - A unique constraint covering the columns `[createdAt]` on the table `conversation_message` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "conversation_message_createdAt_key" ON "conversation_message"("createdAt");
