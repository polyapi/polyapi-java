import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'prisma-module/prisma.service';
import { AuthData } from 'common/types';
import { ConfigService } from 'config/config.service';

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
  }

  @Cron('0 0 0 * * *')
  deleteOldFunctionCalls() {
    this.logger.debug('Clearing old function calls statistics');
    this.prisma.statistics.deleteMany({
      where: {
        createdAt: {
          lt: new Date(new Date().getTime() - this.config.statisticsFunctionCallsRetentionDays * 24 * 60 * 60 * 1000),
        },
      },
    });
  }

  async trackFunctionCall(authData: AuthData, functionId: string, functionType: 'api' | 'server' | 'auth-provider') {
    await this.prisma.statistics.create({
      data: {
        type: 'function-call',
        apiKey: authData.key,
        tenantId: authData.tenant.id,
        environmentId: authData.environment.id,
        applicationId: authData.application?.id,
        userId: authData.user?.id,
        data: JSON.stringify({
          functionId,
          functionType,
        }),
      },
    });
  }

  async getFunctionCallsForTenant(tenantId: string, from?: Date, to?: Date) {
    return this.prisma.statistics.findMany({
      where: {
        tenantId,
        type: 'function-call',
        createdAt: {
          gte: from,
          lte: to,
        },
      },
    });
  }

  async trackChatQuestion(user: AuthData) {
    await this.prisma.statistics.create({
      data: {
        type: 'chat-question',
        apiKey: user.key,
        tenantId: user.tenant.id,
        environmentId: user.environment.id,
        applicationId: user.application?.id,
        userId: user.user?.id,
      },
    });
  }

  async getChatQuestionsForTenant(tenantId: string, from?: Date, to?: Date) {
    return this.prisma.statistics.findMany({
      where: {
        tenantId,
        type: 'chat-question',
        createdAt: {
          gte: from,
          lte: to,
        },
      },
    });
  }

  async trackVariableCall(authData: AuthData, callType: 'create' | 'read' | 'read-context-values' | 'update' | 'delete', variableId?: string, context?: string) {
    await this.prisma.statistics.create({
      data: {
        type: 'variable-call',
        apiKey: authData.key,
        tenantId: authData.tenant.id,
        environmentId: authData.environment.id,
        applicationId: authData.application?.id,
        userId: authData.user?.id,
        data: JSON.stringify({
          variableId,
          context,
          type: callType,
        }),
      },
    });
  }

  async getVariableCallsForTenant(tenantId: string, from?: Date, to?: Date) {
    return this.prisma.statistics.findMany({
      where: {
        tenantId,
        type: 'variable-call',
        createdAt: {
          gte: from,
          lte: to,
        },
      },
    });
  }
}
