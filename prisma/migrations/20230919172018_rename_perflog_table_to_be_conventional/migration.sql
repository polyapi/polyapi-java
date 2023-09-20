/*
  Warnings:

  - You are about to drop the `PerfLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PerfLog" DROP CONSTRAINT "PerfLog_application_id_fkey";

-- DropForeignKey
ALTER TABLE "PerfLog" DROP CONSTRAINT "PerfLog_user_id_fkey";

-- DropTable
DROP TABLE "PerfLog";

-- CreateTable
CREATE TABLE "perf_log" (
    "id" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "snippet" TEXT NOT NULL,
    "input_length" INTEGER NOT NULL,
    "output_length" INTEGER NOT NULL,
    "type" INTEGER NOT NULL,
    "data" TEXT NOT NULL DEFAULT '',
    "load" INTEGER NOT NULL DEFAULT 0,
    "application_id" TEXT,
    "user_id" TEXT,

    CONSTRAINT "perf_log_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "perf_log" ADD CONSTRAINT "perf_log_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perf_log" ADD CONSTRAINT "perf_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
