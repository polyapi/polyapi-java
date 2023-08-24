-- CreateTable
CREATE TABLE "limit_tier"
(
    "id"                     TEXT    NOT NULL PRIMARY KEY,
    "name"                   TEXT    NOT NULL DEFAULT '',
    "max_functions"          INTEGER NOT NULL DEFAULT 0,
    "chat_questions_per_day" INTEGER NOT NULL DEFAULT 0,
    "function_calls_per_day" INTEGER NOT NULL DEFAULT 0
);

-- RedefineTables
PRAGMA foreign_keys= OFF;
CREATE TABLE "new_tenant"
(
    "id"                        TEXT     NOT NULL PRIMARY KEY,
    "created_at"                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name"                      TEXT     NOT NULL,
    "public_visibility_allowed" BOOLEAN  NOT NULL DEFAULT false,
    "limit_tier_id"             TEXT,
    CONSTRAINT "tenant_limit_tier_id_fkey" FOREIGN KEY ("limit_tier_id") REFERENCES "limit_tier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tenant" ("created_at", "id", "name", "public_visibility_allowed")
SELECT "created_at", "id", "name", "public_visibility_allowed"
FROM "tenant";
DROP TABLE "tenant";
ALTER TABLE "new_tenant"
    RENAME TO "tenant";
PRAGMA foreign_key_check;
PRAGMA foreign_keys= ON;

-- Create Free Limit Tier
INSERT INTO "limit_tier" ("id", "name", "max_functions", "chat_questions_per_day", "function_calls_per_day")
VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' ||
              substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
        'free',
        20,
        100,
        1000);
