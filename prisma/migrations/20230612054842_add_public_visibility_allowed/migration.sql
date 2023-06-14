-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "public_visibility_allowed" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_tenant" ("created_at", "id", "name") SELECT "created_at", "id", "name" FROM "tenant";
DROP TABLE "tenant";
ALTER TABLE "new_tenant" RENAME TO "tenant";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
