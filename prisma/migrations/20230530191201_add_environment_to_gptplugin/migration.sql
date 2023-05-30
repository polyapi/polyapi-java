/*
  Warnings:

  - Added the required column `environment_id` to the `GptPlugin` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GptPlugin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description_for_marketplace" TEXT NOT NULL DEFAULT '',
    "description_for_model" TEXT NOT NULL DEFAULT '',
    "icon_url" TEXT NOT NULL,
    "functionIds" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    CONSTRAINT "GptPlugin_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GptPlugin" ("description_for_marketplace", "description_for_model", "functionIds", "icon_url", "id", "name", "slug") SELECT "description_for_marketplace", "description_for_model", "functionIds", "icon_url", "id", "name", "slug" FROM "GptPlugin";
DROP TABLE "GptPlugin";
ALTER TABLE "new_GptPlugin" RENAME TO "GptPlugin";
CREATE UNIQUE INDEX "GptPlugin_slug_key" ON "GptPlugin"("slug");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
