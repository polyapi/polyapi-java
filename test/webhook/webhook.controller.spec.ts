/* eslint-disable @typescript-eslint/ban-ts-comment */
import { CommonService } from 'common/common.service';
import { Test } from '@nestjs/testing';
import {
  authServiceMock,
  commonServiceMock,
  environmentServiceMock,
  perfLogInfoProviderMock, prismaServiceMock,
  webhookServiceMock,
} from '../mocks';
import { WebhookController } from 'webhook/webhook.controller';
import { WebhookService } from 'webhook/webhook.service';
import { EnvironmentService } from 'environment/environment.service';
import { NotFoundException } from '@nestjs/common';
import { PerfLogInfoProvider } from 'statistics/perf-log-info-provider';
import { AuthService } from 'auth/auth.service';
import { PrismaService } from 'prisma/prisma.service';

describe('WebhookController', () => {
  let webhookController: WebhookController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: WebhookService,
          useValue: webhookServiceMock,
        },
        {
          provide: EnvironmentService,
          useValue: environmentServiceMock,
        },
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: CommonService,
          useValue: commonServiceMock,
        },
        {
          provide: PerfLogInfoProvider,
          useValue: perfLogInfoProviderMock,
        },
      ],
      controllers: [WebhookController],
    }).compile();

    webhookController = moduleRef.get<WebhookController>(WebhookController);
  });

  describe('resolveSubpath', () => {
    it('should resolve a valid subpath', () => {
      const mockReq = {
        url: '/some/prefix/foo/123/bar?test=ok',
      };
      const mockWebhookHandle = {
        subpath: '/foo/{id}/bar?test={test}',
      };

      expect(() => webhookController['resolveSubpath'](mockReq as any, mockWebhookHandle as any)).not.toThrow();
      expect(webhookController['resolveSubpath'](mockReq as any, mockWebhookHandle as any)).toBe('foo/123/bar?test=ok');
    });

    it('should throw NotFoundException for an invalid subpath', () => {
      const mockReq = {
        url: '/some/prefix/foo/123/baz',
      };
      const mockWebhookHandle = {
        subpath: '/foo/{id}/bar?test={test}',
      };

      expect(() => webhookController['resolveSubpath'](mockReq as any, mockWebhookHandle as any)).toThrow(NotFoundException);
    });

    it('should throw NotFoundException when subpath is not provided in webhookHandle', () => {
      const mockReq = {
        url: '/some/prefix/foo/123/bar?test=ok',
      };
      const mockWebhookHandle = {};

      expect(() => webhookController['resolveSubpath'](mockReq as any, mockWebhookHandle as any)).toThrow(NotFoundException);
    });

    it('should resolve a valid subpath without query parameters', () => {
      const mockReq = {
        url: '/some/prefix/foo/123/bar',
      };
      const mockWebhookHandle = {
        subpath: '/foo/{id}/bar',
      };

      expect(() => webhookController['resolveSubpath'](mockReq as any, mockWebhookHandle as any)).not.toThrow();
      expect(webhookController['resolveSubpath'](mockReq as any, mockWebhookHandle as any)).toBe('foo/123/bar');
    });

    it('should throw NotFoundException for an invalid subpath without query parameters', () => {
      const mockReq = {
        url: '/some/prefix/foo/123/baz',
      };
      const mockWebhookHandle = {
        subpath: '/foo/{id}/bar',
      };

      expect(() => webhookController['resolveSubpath'](mockReq as any, mockWebhookHandle as any)).toThrow(NotFoundException);
    });

    it('should resolve even when there are query parameters in the request but not in the subpath', () => {
      const mockReq = {
        url: '/some/prefix/foo/123/bar?extra=value',
      };
      const mockWebhookHandle = {
        subpath: '/foo/{id}/bar',
      };

      expect(() => webhookController['resolveSubpath'](mockReq as any, mockWebhookHandle as any)).toThrow(NotFoundException);
    });
  });
});
