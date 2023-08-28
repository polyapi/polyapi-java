-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_limit_tier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "max_functions" INTEGER,
    "chat_questions_per_day" INTEGER,
    "function_calls_per_day" INTEGER
);
INSERT INTO "new_limit_tier" ("chat_questions_per_day", "function_calls_per_day", "id", "max_functions", "name") SELECT "chat_questions_per_day", "function_calls_per_day", "id", "max_functions", "name" FROM "limit_tier";
DROP TABLE "limit_tier";
ALTER TABLE "new_limit_tier" RENAME TO "limit_tier";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
