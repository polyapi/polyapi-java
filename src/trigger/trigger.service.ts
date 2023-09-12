import { ConflictException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import crypto from 'crypto';
import { ConfigService } from 'config/config.service';
import { TriggerProvider } from 'trigger/provider/trigger-provider';
import { KNativeTriggerProvider } from 'trigger/provider/knative-trigger-provider';
import { TriggerDestination, TriggerDto, TriggerSource } from '@poly/model';
import { delay } from '@poly/common/utils';
import { CommonError, NAME_CONFLICT } from 'common/common-error';

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

  async createTrigger(environmentId: string, name: string | null, source: TriggerSource, destination: TriggerDestination, waitForResponse: boolean) {
    try {
      return await this.triggerProvider.createTrigger(environmentId, name, source, destination, waitForResponse);
    } catch (e) {
      if (e instanceof CommonError && e.code === NAME_CONFLICT) {
        throw new ConflictException('Trigger with given name already exists');
      }
      if (e.message.includes('already exists')) {
        throw new ConflictException('Trigger with given source and destination already exists');
      }
      throw e;
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

    this.logger.debug(`Triggering ${triggers.length} triggers for webhook handle ${webhookHandleId}`);
    await this.triggerProvider.triggerEvent(executionId, {
      webhookHandleId,
    }, eventPayload);

    if (triggers.some(trigger => trigger.waitForResponse)) {
      this.logger.debug(`Waiting for trigger response for execution ${executionId}`);
      return await this.waitForTriggerResponse(executionId);
    }
  }

  private async waitForTriggerResponse(executionId: string) {
    const startTime = Date.now();
    while (startTime + this.config.knativeTriggerResponseTimeoutSeconds * 1000 > Date.now()) {
      const response = await this.cacheManager.get(`execution-response:${executionId}`);
      if (response) {
        this.logger.debug(`Received trigger response for execution ${executionId}`);
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
