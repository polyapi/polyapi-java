-- CreateTable
CREATE TABLE "custom_function_webhook_handle" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "function_id" TEXT NOT NULL,
    "webhook_handle_id" TEXT NOT NULL,
    "message" TEXT,

    CONSTRAINT "custom_function_webhook_handle_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "custom_function_webhook_handle" ADD CONSTRAINT "custom_function_webhook_handle_webhook_handle_id_fkey" FOREIGN KEY ("webhook_handle_id") REFERENCES "webhook_handle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_function_webhook_handle" ADD CONSTRAINT "custom_function_webhook_handle_function_id_fkey" FOREIGN KEY ("function_id") REFERENCES "custom_function"("id") ON DELETE CASCADE ON UPDATE CASCADE;
