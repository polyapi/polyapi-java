-- CreateTable
CREATE TABLE "log" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,

    CONSTRAINT "log_pkey" PRIMARY KEY ("id")
);
