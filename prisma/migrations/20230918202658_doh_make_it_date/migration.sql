/*
  Warnings:

  - Changed the type of `start` on the `PerfLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "PerfLog" DROP COLUMN "start",
ADD COLUMN     "start" TIMESTAMP(3) NOT NULL;
