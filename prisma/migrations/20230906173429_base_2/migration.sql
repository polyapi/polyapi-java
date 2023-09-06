/*
  Warnings:

  - A unique constraint covering the columns `[createdat]` on the table `conversation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "conversation_createdat_key" ON "conversation"("createdat");
