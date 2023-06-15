-- RedefineTables
PRAGMA foreign_keys = OFF;

CREATE TABLE "new_config_variable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "tenantId" TEXT,
    "environmentId" TEXT,
    CONSTRAINT "config_variable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "config_variable_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO
    "new_config_variable" ("created_at", "id", "name", "value")
SELECT
    "created_at",
    "id",
    "name",
    "value"
FROM
    "config_variable";

DROP TABLE "config_variable";

ALTER TABLE
    "new_config_variable" RENAME TO "config_variable";

PRAGMA foreign_key_check;

PRAGMA foreign_keys = ON;

UPDATE
    config_variable
SET
    name = 'openai_' || name;