import { ConflictException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import crypto from 'crypto';
import { ConfigService } from 'config/config.service';
import { TriggerProvider } from 'trigger/provider/trigger-provider';
import { KNativeTriggerProvider } from 'trigger/provider/knative-trigger-provider';
import { TriggerDestination, TriggerDto, TriggerSource } from '@poly/model';
import { delay } from '@poly/common/utils';

@Injectable()
export class TriggerService implements OnModuleInit {
  private readonly logger = new Logger(TriggerService.name);
  private readonly triggerProvider: TriggerProvider;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly config: ConfigService,
  ) {
    this.triggerProvider = new KNativeTriggerProvider(cacheManager, config);
  }

  async onModuleInit() {
    await this.triggerProvider.init();
  }

  async findById(environmentId: string, triggerId: string) {
    return await this.triggerProvider.findTriggerById(environmentId, triggerId);
  }

  async getTriggers(environmentId: string) {
    return await this.triggerProvider.getTriggers(environmentId);
  }

  async createTrigger(environmentId: string, source: TriggerSource, destination: TriggerDestination) {
    try {
      return await this.triggerProvider.createTrigger(environmentId, source, destination);
    } catch (e) {
      if (e.message.includes('already exists')) {
        throw new ConflictException('Trigger with given source and destination already exists');
      } else {
        throw e;
      }
    }
  }

  async deleteTrigger(environmentId: string, trigger: TriggerDto) {
    return await this.triggerProvider.deleteTrigger(environmentId, trigger);
  }

  async triggerWebhookEvent(webhookHandleId: string, eventPayload: any) {
    const executionId = this.generateExecutionId();
    const triggers = await this.getTriggersByWebhookHandleId(webhookHandleId);
    if (triggers.length === 0) {
      return;
    }

    await this.triggerProvider.triggerEvent(executionId, {
      webhookHandleId,
    }, eventPayload);

    const startTime = Date.now();
    while (startTime + this.config.knativeTriggerResponseTimeoutSeconds * 1000 > Date.now()) {
      const response = await this.cacheManager.get(`execution-response:${executionId}`);
      if (response) {
        await this.cacheManager.del(`execution-response:${executionId}`);
        return response;
      }

      await delay(100);
    }
  }

  private generateExecutionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  async processTriggerResponse(executionId: string, data: unknown) {
    await this.cacheManager.set(`execution-response:${executionId}`, data, this.config.knativeTriggerResponseTimeoutSeconds * 1000);
  }

  private async getTriggersByWebhookHandleId(webhookHandleId: string) {
    const triggers = await this.triggerProvider.getTriggers();
    return triggers.filter(t => t.source.webhookHandleId === webhookHandleId);
  }
}
