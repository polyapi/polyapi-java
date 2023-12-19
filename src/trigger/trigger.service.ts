import { ConflictException, forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import crypto from 'crypto';
import { ConfigService } from 'config/config.service';
import { TriggerProvider } from 'trigger/provider/trigger-provider';
import { KNativeTriggerProvider } from 'trigger/provider/knative-trigger-provider';
import { TriggerDestination, TriggerDto, TriggerSource, Visibility } from '@poly/model';
import { delay } from '@poly/common/utils';
import { CommonError, NAME_CONFLICT } from 'common/common-error';
import { EventService } from 'event/event.service';
import { FunctionService } from 'function/function.service';
import { EnvironmentService } from 'environment/environment.service';

export interface TriggerResponse {
  data: unknown;
  statusCode: number;
}

@Injectable()
export class TriggerService implements OnModuleInit {
  private readonly logger = new Logger(TriggerService.name);
  private readonly triggerProvider: TriggerProvider;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => FunctionService))
    private readonly functionService: FunctionService,
    private readonly environmentService: EnvironmentService,
    private readonly eventService: EventService,
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

  async updateTrigger(
    environmentId: string,
    trigger: TriggerDto,
    name: string | null | undefined,
    waitForResponse: boolean | undefined,
  ) {
    return await this.triggerProvider.updateTrigger(environmentId, trigger, name, waitForResponse);
  }

  async deleteTrigger(environmentId: string, trigger: TriggerDto) {
    return await this.triggerProvider.deleteTrigger(environmentId, trigger);
  }

  async triggerWebhookEvent(environmentId: string, webhookHandleId: string, eventPayload: any, eventHeaders: Record<string, any>, params: Record<string, any>) {
    const executionId = this.generateExecutionId();
    const triggers = await this.getTriggersByWebhookHandleId(webhookHandleId);
    if (triggers.length === 0) {
      return null;
    }

    this.logger.debug(`Triggering ${triggers.length} triggers for webhook handle ${webhookHandleId}`);
    await this.triggerProvider.triggerEvent(environmentId, executionId, {
      webhookHandleId,
    }, [eventPayload, eventHeaders, params]);

    if (triggers.some(trigger => trigger.waitForResponse)) {
      this.logger.debug(`Waiting for trigger response for execution ${executionId}`);
      return await this.waitForTriggerResponse(executionId);
    } else {
      return null;
    }
  }

  private async waitForTriggerResponse(executionId: string): Promise<TriggerResponse | null> {
    const startTime = Date.now();
    while (startTime + this.config.knativeTriggerResponseTimeoutSeconds * 1000 > Date.now()) {
      const response = await this.cacheManager.get(`execution-response:${executionId}`);
      if (response) {
        this.logger.debug(`Received trigger response for execution ${executionId}`);
        await this.cacheManager.del(`execution-response:${executionId}`);
        return response as TriggerResponse;
      }

      await delay(100);
    }

    return null;
  }

  private generateExecutionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  async processTriggerResponse(
    executionId: string,
    data: any,
    statusCode: number,
    functionId?: string,
    executionEnvironmentId?: string,
  ) {
    const response: TriggerResponse = {
      data,
      statusCode,
    };

    if (statusCode < 200 || statusCode >= 300) {
      const serverFunction = functionId && await this.functionService.findServerFunction(functionId);
      const executionEnvironment = executionEnvironmentId && await this.environmentService.findById(executionEnvironmentId);

      if (serverFunction && executionEnvironment) {
        const functionPath = `${serverFunction.context ? `${serverFunction.context}.` : ''}${serverFunction.name}`;
        await this.eventService.sendErrorEvent(
          serverFunction.id,
          executionEnvironment.id,
          executionEnvironment.tenantId,
          serverFunction.visibility as Visibility,
          null,
          null,
          functionPath,
          {
            message: data.message || data,
            status: statusCode,
          },
        );
      }
    }

    await this.cacheManager.set(`execution-response:${executionId}`, response, this.config.knativeTriggerResponseTimeoutSeconds * 1000);
  }

  private async getTriggersByWebhookHandleId(webhookHandleId: string) {
    const triggers = await this.triggerProvider.getTriggers();
    return triggers.filter(t => t.source.webhookHandleId === webhookHandleId);
  }
}
