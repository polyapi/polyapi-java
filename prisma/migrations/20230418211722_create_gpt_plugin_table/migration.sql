-- CreateTable
CREATE TABLE "GptPlugin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon_url" TEXT NOT NULL,
    "functionIds" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GptPlugin_slug_key" ON "GptPlugin"("slug");
