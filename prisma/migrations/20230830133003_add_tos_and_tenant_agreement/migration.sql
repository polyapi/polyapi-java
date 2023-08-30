-- CreateTable
CREATE TABLE "tos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "tenant_agreement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "agreed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT NOT NULL,
    "tos_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    CONSTRAINT "tenant_agreement_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tenant_agreement_tos_id_fkey" FOREIGN KEY ("tos_id") REFERENCES "tos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tos_version_key" ON "tos"("version");
