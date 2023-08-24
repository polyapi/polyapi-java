import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { LimitTier, Tenant } from '@prisma/client';
import { StatisticsService } from 'statistics/statistics.service';
import { TierDto } from '@poly/model';
import { getEndOfDay, getStartOfDay } from '@poly/common/utils';

@Injectable()
export class LimitService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly statisticsService: StatisticsService,
  ) {
  }

  toTierDto(limitTier: LimitTier): TierDto {
    return {
      id: limitTier.id,
      name: limitTier.name,
      maxFunctions: limitTier.maxFunctions,
      chatQuestionsPerDay: limitTier.chatQuestionsPerDay,
      functionCallsPerDay: limitTier.functionCallsPerDay,
    };
  }

  async getLimitTiers() {
    return this.prismaService.limitTier.findMany();
  }

  async findById(id: string): Promise<LimitTier | null> {
    return this.prismaService.limitTier.findFirst({
      where: {
        id,
      },
    });
  }

  async createLimitTier(name: string, maxFunctions: number, chatQuestionsPerDay: number, functionCallsPerDay: number) {
    return this.prismaService.limitTier.create({
      data: {
        name,
        maxFunctions,
        chatQuestionsPerDay,
        functionCallsPerDay,
      },
    });
  }

  async updateLimitTier(tier: LimitTier, name?: string, maxFunctions?: number, chatQuestionsPerDay?: number, functionCallsPerDay?: number) {
    return this.prismaService.limitTier.update({
      where: {
        id: tier.id,
      },
      data: {
        name,
        maxFunctions,
        chatQuestionsPerDay,
        functionCallsPerDay,
      },
    });
  }

  async deleteLimitTier(tier: LimitTier) {
    return this.prismaService.limitTier.delete({
      where: {
        id: tier.id,
      },
    });
  }

  async checkTenantFunctionsLimit(tenant: Tenant, addedCount = 1): Promise<boolean> {
    const limitTier = tenant.limitTierId
      ? await this.findById(tenant.limitTierId)
      : null;
    if (!limitTier) {
      return true;
    }
    const functionsUsage = await this.getTenantFunctionsUsage(tenant.id);
    const { maxFunctions } = limitTier;

    return (functionsUsage + addedCount) <= maxFunctions;
  }

  private async getTenantFunctionsUsage(tenantId: string): Promise<number> {
    const result = await this.prismaService.$queryRaw<{ total: number }>`
        SELECT (SELECT COUNT(*)
                FROM api_function
                         JOIN environment e ON environment_id = e.id
                WHERE e.tenant_id = ${tenantId}) +
               (SELECT COUNT(*)
                FROM custom_function
                         JOIN environment e ON environment_id = e.id
                WHERE e.tenant_id = ${tenantId}) +
               (SELECT COUNT(*)
                FROM webhook_handle
                         JOIN environment e ON environment_id = e.id
                WHERE e.tenant_id = ${tenantId}) +
                   -- AuthProvider getToken
               (SELECT COUNT(*)
                FROM auth_provider
                         JOIN environment e ON environment_id = e.id
                WHERE e.tenant_id = ${tenantId}) +
                   -- AuthProvider introspect
               (SELECT COUNT(*)
                FROM auth_provider
                         JOIN environment e ON environment_id = e.id
                WHERE e.tenant_id = ${tenantId}
                  AND introspect_url IS NOT NULL) +
                   -- AuthProvider revoke
               (SELECT COUNT(*)
                FROM auth_provider
                         JOIN environment e ON environment_id = e.id
                WHERE e.tenant_id = ${tenantId}
                  AND revoke_url IS NOT NULL) +
                   -- AuthProvider refresh
               (SELECT COUNT(*)
                FROM auth_provider
                         JOIN environment e ON environment_id = e.id
                WHERE e.tenant_id = ${tenantId}
                  AND refresh_enabled = true)
                   AS total
    `;

    return Number(result[0].total);
  }

  async checkTenantFunctionCallsLimit(tenant: Tenant): Promise<boolean> {
    const limitTier = tenant.limitTierId
      ? await this.findById(tenant.limitTierId)
      : null;
    if (!limitTier) {
      return true;
    }
    const functionCallsUsage = await this.getTenantFunctionCallsCurrentDayUsage(tenant.id);
    const { functionCallsPerDay } = limitTier;

    return functionCallsUsage < functionCallsPerDay;
  }

  private async getTenantFunctionCallsCurrentDayUsage(tenantId: string): Promise<number> {
    const functionCalls = await this.statisticsService.getFunctionCallForTenant(
      tenantId,
      getStartOfDay(),
      getEndOfDay(),
    );
    return functionCalls.length;
  }

  async checkTenantChatQuestionsLimit(tenant: Tenant): Promise<boolean> {
    const limitTier = tenant.limitTierId
      ? await this.findById(tenant.limitTierId)
      : null;
    if (!limitTier) {
      return true;
    }
    const chatQuestionsUsage = await this.getTenantChatQuestionsPerDayCurrentDayUsage(tenant.id);
    const { chatQuestionsPerDay } = limitTier;

    return chatQuestionsUsage < chatQuestionsPerDay;
  }

  private async getTenantChatQuestionsPerDayCurrentDayUsage(tenantId: string): Promise<number> {
    const chatQuestions = await this.statisticsService.getChatQuestionsForTenant(
      tenantId,
      getStartOfDay(),
      getEndOfDay(),
    );
    return chatQuestions.length;
  }
}
