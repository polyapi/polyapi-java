import { PrismaService } from 'prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from 'chat/chat.service';
import { aiServiceMock, cacheManagerMock } from '../mocks';
import { AiService } from 'ai/ai.service';
import { CACHE_MANAGER } from '@nestjs/common';

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
        {
          provide: CACHE_MANAGER,
          useValue: cacheManagerMock,
        },
      ],
    }).compile();

    service = await module.get(ChatService);
  });

  describe('conversations', () => {
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
      const ids = await service.getConversationIds(user.id, '');
      expect(ids).toStrictEqual([conversation.id]);
    });

    it('should get history', async () => {
      const user = await prisma.user.findFirstOrThrow();
      await prisma.conversationMessage.deleteMany({ where: { userId: user.id } });
      await prisma.conversation.deleteMany({ where: { userId: user.id } });
      const conversation = await prisma.conversation.create({ data: { userId: user.id } });
      const msg1 = await prisma.conversationMessage.create({
        data: {
          userId: user.id,
          conversationId: conversation.id,
          role: 'user',
          type: 2,
          content: 'profound question',
        },
      });
      const msg2 = await prisma.conversationMessage.create({
        data: {
          userId: user.id,
          conversationId: conversation.id,
          role: 'assistant',
          type: 2,
          content: 'profound answer',
        },
      });
      const ids = await service.getHistory(user.id);
      expect(ids).toMatchObject([
        { role: msg2.role, content: msg2.content },
        { role: msg1.role, content: msg1.content },
      ]);
    });
  });
});
