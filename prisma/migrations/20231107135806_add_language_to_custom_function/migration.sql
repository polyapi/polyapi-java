/*
  Warnings:

  - Added the required column `language` to the `custom_function` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "custom_function" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'javascript';
