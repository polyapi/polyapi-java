-- CreateTable
CREATE TABLE "tenant_sign_up" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "verification_code" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sign_up_email_key" ON "tenant_sign_up"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sign_up_name_key" ON "tenant_sign_up"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sign_up_verification_code_key" ON "tenant_sign_up"("verification_code");
