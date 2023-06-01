/*
  Warnings:

  - Made the column `environment_id` on table `gpt_plugin` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_gpt_plugin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description_for_marketplace" TEXT NOT NULL DEFAULT '',
    "description_for_model" TEXT NOT NULL DEFAULT '',
    "icon_url" TEXT NOT NULL,
    "functionIds" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    CONSTRAINT "gpt_plugin_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_gpt_plugin" ("description_for_marketplace", "description_for_model", "environment_id", "functionIds", "icon_url", "id", "name", "slug") SELECT "description_for_marketplace", "description_for_model", "environment_id", "functionIds", "icon_url", "id", "name", "slug" FROM "gpt_plugin";
DROP TABLE "gpt_plugin";
ALTER TABLE "new_gpt_plugin" RENAME TO "gpt_plugin";
CREATE UNIQUE INDEX "gpt_plugin_slug_key" ON "gpt_plugin"("slug");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
