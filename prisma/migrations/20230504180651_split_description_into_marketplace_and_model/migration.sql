/*
  Warnings:

  - You are about to drop the column `description` on the `GptPlugin` table. All the data in the column will be lost.

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
    "functionIds" TEXT NOT NULL
);
INSERT INTO "new_GptPlugin" ("functionIds", "icon_url", "id", "name", "slug") SELECT "functionIds", "icon_url", "id", "name", "slug" FROM "GptPlugin";
DROP TABLE "GptPlugin";
ALTER TABLE "new_GptPlugin" RENAME TO "GptPlugin";
CREATE UNIQUE INDEX "GptPlugin_slug_key" ON "GptPlugin"("slug");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
