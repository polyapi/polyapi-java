/*
  Warnings:

  - You are about to drop the `GptPlugin` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GptPlugin";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "gpt_plugin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description_for_marketplace" TEXT NOT NULL DEFAULT '',
    "description_for_model" TEXT NOT NULL DEFAULT '',
    "icon_url" TEXT NOT NULL,
    "functionIds" TEXT NOT NULL,
    "environment_id" TEXT,
    CONSTRAINT "gpt_plugin_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "gpt_plugin_slug_key" ON "gpt_plugin"("slug");
