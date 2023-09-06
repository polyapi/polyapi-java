-- AlterTable
ALTER TABLE "conversation_message" ALTER COLUMN "createdat" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "statistics" ALTER COLUMN "user_id" DROP NOT NULL;
