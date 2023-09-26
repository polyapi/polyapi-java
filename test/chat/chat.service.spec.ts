import { PrismaService } from 'prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from 'chat/chat.service';
import { aiServiceMock, cacheManagerMock } from '../mocks';
import { AiService } from 'ai/ai.service';
import { BadRequestException, CACHE_MANAGER } from '@nestjs/common';
import { Role } from '@poly/model';
import { AuthData } from 'common/types';

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
      const user = await prisma.user.findFirstOrThrow({ where: { role: Role.SuperAdmin } });

      // ignore the type for authData, we have all we need in the mock
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const auth: AuthData = {
        user,
      };

      const detail = await service.getConversationDetail(auth, '', 'foobar27313');
      expect(detail).toBe('Conversation not found.');
    });

    it('should allow the SuperAdmin to get conversations', async () => {
      const user = await prisma.user.findFirstOrThrow({ where: { role: Role.SuperAdmin } });
      const conversation = await prisma.conversation.create({ data: { userId: user.id } });
      await prisma.conversationMessage.create({
        data: { conversationId: conversation.id, role: 'user', content: 'I am super' },
      });

      // ignore the type for authData, we have all we need in the mock
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const auth: AuthData = {
        user,
      };

      const detail = await service.getConversationDetail(auth, '', conversation.id);
      expect(detail).toBe('USER\n\nI am super');
    });

    it('should NOT allow the Admin to get conversations cross-tenant', async () => {
      const user = await prisma.user.findFirstOrThrow({ where: { role: Role.Admin } });

      // now create a user from another tenant and create a convo for another tenant
      const otherTenant = await prisma.tenant.findFirstOrThrow({ where: { id: { not: user.tenantId } } });
      const otherUser = await prisma.user.create({ data: { name: 'TestUser', tenantId: otherTenant.id } });

      const conversation = await prisma.conversation.create({ data: { userId: otherUser.id } });

      await prisma.conversationMessage.create({
        data: { conversationId: conversation.id, role: 'user', content: 'I am super' },
      });

      // ignore the type for authData, we have all we need in the mock
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const auth: AuthData = {
        user,
      };

      const t = async () => {
        await service.getConversationDetail(auth, '', conversation.id);
      };
      await expect(t()).rejects.toThrow(BadRequestException);
    });

    it('should NOT allow the User to get conversations of another user, even if they are in the same tenant', async () => {
      const user = await prisma.user.findFirstOrThrow({ where: { role: Role.User } });
      const otherUser = await prisma.user.create({ data: { name: 'TestUser', tenantId: user.tenantId } });
      const conversation = await prisma.conversation.create({ data: { userId: otherUser.id } });

      await prisma.conversationMessage.create({
        data: { conversationId: conversation.id, role: 'user', content: 'I am super' },
      });

      // ignore the type for authData, we have all we need in the mock
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const auth: AuthData = {
        user,
      };

      const t = async () => {
        await service.getConversationDetail(auth, '', conversation.id);
      };
      await expect(t()).rejects.toThrow(BadRequestException);
    });

    it('should get the list of conversation ids', async () => {
      const user = await prisma.user.findFirstOrThrow();
      // ignore the type for authData, we have all we need in the mock
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const auth: AuthData = {
        user,
      };
      await prisma.conversationMessage.deleteMany({ where: { conversation: { userId: user.id } } });
      await prisma.conversation.deleteMany({ where: { userId: user.id } });
      const conversation = await prisma.conversation.create({ data: { userId: user.id } });
      const ids = await service.getConversationIds(auth, user.id, '');
      expect(ids).toStrictEqual([conversation.id]);
    });

    it('should get only application conversation ids as application', async () => {
      const tenant = await prisma.tenant.findFirstOrThrow();
      const application = await prisma.application.create({ data: { name: 'Test', tenantId: tenant.id } });
      const user = await prisma.user.findFirstOrThrow();
      // ignore the type for authData, we have all we need in the mock
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const auth: AuthData = {
        application,
      };
      await prisma.conversation.create({ data: { userId: user.id } });
      const appConvo = await prisma.conversation.create({ data: { applicationId: application.id } });
      const ids = await service.getConversationIds(auth, '', '');
      expect(ids).toStrictEqual([appConvo.id]);
    });

    it('should NOT allow the Admin to get conversations cross-tenant', async () => {
      const user = await prisma.user.findFirstOrThrow({ where: { role: Role.Admin } });
      // now create a user from another tenant and create a convo for another tenant
      const otherTenant = await prisma.tenant.findFirstOrThrow({ where: { id: { not: user.tenantId } } });
      const otherUser = await prisma.user.create({ data: { name: 'TestUser', tenantId: otherTenant.id } });
      const otherConvo = await prisma.conversation.create({ data: { userId: otherUser.id } });

      // ignore the type for authData, we have all we need in the mock
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const auth: AuthData = {
        user,
      };

      const convoIds = await service.getConversationIds(auth, '', '');
      await expect(convoIds.includes(otherConvo.id)).toBeFalsy();
    });

    it('should get history', async () => {
      const user = await prisma.user.findFirstOrThrow();
      await prisma.conversationMessage.deleteMany({ where: { conversation: { userId: user.id } } });
      await prisma.conversation.deleteMany({ where: { userId: user.id } });
      const conversation = await prisma.conversation.create({ data: { userId: user.id } });
      const msg1 = await prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          type: 2,
          content: 'profound question',
        },
      });
      const msg2 = await prisma.conversationMessage.create({
        data: {
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
