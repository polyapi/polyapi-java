-- CreateTable
CREATE TABLE "PerfLog" (
    "id" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "snippet" TEXT NOT NULL,
    "input_length" INTEGER NOT NULL,
    "output_length" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "stages" TEXT NOT NULL DEFAULT '',
    "load" INTEGER NOT NULL DEFAULT 0,
    "application_id" TEXT,
    "user_id" TEXT,

    CONSTRAINT "PerfLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PerfLog" ADD CONSTRAINT "PerfLog_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfLog" ADD CONSTRAINT "PerfLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
