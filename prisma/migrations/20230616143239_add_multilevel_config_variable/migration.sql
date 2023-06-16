-- RedefineTables
PRAGMA foreign_keys = OFF;

CREATE TABLE "new_config_variable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "tenant_id" TEXT,
    "environment_id" TEXT,
    CONSTRAINT "config_variable_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "config_variable_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    config_variable SET name = 'OpenAIKeywordSimilarityThreshold' where name = 'keyword_similarity_threshold';
UPDATE
    config_variable SET name = 'OpenAIFunctionMatchLimit' where name = 'function_match_limit';
UPDATE
    config_variable SET name = 'OpenAIExtractKeywordsTemperature' where name = 'extract_keywords_temperature';
