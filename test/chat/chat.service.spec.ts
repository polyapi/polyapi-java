import { PrismaService } from 'prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from 'chat/chat.service';
import { aiServiceMock } from '../mocks';
import { AiService } from 'ai/ai.service';

describe('ChatService', () => {
  const prisma = new PrismaService();
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        PrismaService,
        {
          provide: AiService,
          useValue: aiServiceMock,
        },
      ],
    }).compile();

    service = await module.get(ChatService);
  });

  describe('conversationsDetail', () => {
    it('should tell the user when no conversation found', async () => {
      const user = await prisma.user.findFirstOrThrow();
      const detail = await service.getConversationDetail(user.id, 'foobar');
      expect(detail).toBe('Conversation not found.');
    });
    it('should get the list of conversation ids', async () => {
      const user = await prisma.user.findFirstOrThrow();
      await prisma.conversationMessage.deleteMany({ where: { userId: user.id } });
      await prisma.conversation.deleteMany({ where: { userId: user.id } });
      const conversation = await prisma.conversation.create({ data: { userId: user.id } });
      const ids = await service.getConversationIds(user.id);
      expect(ids).toStrictEqual([conversation.id]);
    });
  });
});
