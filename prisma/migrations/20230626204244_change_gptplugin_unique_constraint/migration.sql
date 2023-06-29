/*
  Warnings:

  - A unique constraint covering the columns `[slug,environment_id]` on the table `gpt_plugin` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "gpt_plugin_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "gpt_plugin_slug_environment_id_key" ON "gpt_plugin"("slug", "environment_id");
