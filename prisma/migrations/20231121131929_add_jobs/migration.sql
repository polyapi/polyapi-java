-- CreateTable
CREATE TABLE "job" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "schedule_type" TEXT NOT NULL,
    "schedule_one_time_value" TIMESTAMP(3),
    "schedule_periodical_value" TEXT,
    "schedule_interval_value" INTEGER,
    "functions" TEXT NOT NULL,
    "functions_execution_type" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_execution" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "job_id" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "processed_on" TIMESTAMP(3),
    "finished_on" TIMESTAMP(3),
    "functions" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,

    CONSTRAINT "job_execution_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_execution" ADD CONSTRAINT "job_execution_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
