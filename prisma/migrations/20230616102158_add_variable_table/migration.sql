-- CreateTable
CREATE TABLE "variable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'ENVIRONMENT',
    "secret" BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT "variable_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
