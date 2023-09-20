-- DropForeignKey
ALTER TABLE "conversation_message" DROP CONSTRAINT "conversation_message_conversation_id_fkey";

-- AddForeignKey
ALTER TABLE "conversation_message" ADD CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
