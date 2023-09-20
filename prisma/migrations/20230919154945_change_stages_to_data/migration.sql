/*
  Warnings:

  - You are about to drop the column `stages` on the `PerfLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PerfLog" DROP COLUMN "stages",
ADD COLUMN     "data" TEXT NOT NULL DEFAULT '';
