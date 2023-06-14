/*
  Warnings:

  - A unique constraint covering the columns `[user_id,environment_id]` on the table `user_key` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_key_user_id_environment_id_key" ON "user_key"("user_id", "environment_id");
