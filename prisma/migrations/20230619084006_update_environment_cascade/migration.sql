-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_environment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    CONSTRAINT "environment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_environment" ("created_at", "id", "name", "subdomain", "tenant_id") SELECT "created_at", "id", "name", "subdomain", "tenant_id" FROM "environment";
DROP TABLE "environment";
ALTER TABLE "new_environment" RENAME TO "environment";
CREATE UNIQUE INDEX "environment_subdomain_key" ON "environment"("subdomain");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
