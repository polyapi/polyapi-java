-- CreateTable
CREATE TABLE "DocSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "vector" TEXT NOT NULL DEFAULT ''
);
