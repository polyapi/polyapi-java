/*
  Warnings:

  - The `processed_on` column on the `job_executions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `finished_on` column on the `job_executions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "job_executions" DROP COLUMN "processed_on",
ADD COLUMN     "processed_on" TIMESTAMP(3),
DROP COLUMN "finished_on",
ADD COLUMN     "finished_on" TIMESTAMP(3);
