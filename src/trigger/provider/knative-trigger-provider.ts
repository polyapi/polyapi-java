import { CustomObjectsApi } from '@kubernetes/client-node';
import { CloudEvent, emitterFor, EmitterFunction, httpTransport } from 'cloudevents';
import { Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import crypto from 'crypto';
import { makeCustomObjectsApiClient } from 'kubernetes/client';
import { ConfigService } from 'config/config.service';
import { TriggerProvider } from 'trigger/provider/trigger-provider';
import { TriggerDestination, TriggerDto, TriggerSource } from '@poly/model';
import { NAME_CONFLICT, CommonError } from 'common/common-error';

const TRIGGERS_GROUP = 'eventing.knative.dev';
const TRIGGERS_VERSION = 'v1';
const TRIGGERS_NAME = 'triggers';
const RESPONSE_TRIGGER_NAME = 'response-trigger';

type SubscriberConfig = {
  apiVersion: 'serving.knative.dev/v1';
  kind: 'Service';
  name: string;
}

interface KNativeTriggerDef {
  metadata: {
    name: string;
    labels: {
      name: string | null;
      environment: string;
      waitForResponse?: string;
    },
    uid: string;
  };
  spec: {
    broker: string;
    filter: {
      attributes: {
        type: string;
        [key: string]: string;
      };
    };
    subscriber: {
      ref: {
        kind: 'Service';
        name: string;
      };
    };
  };
}

export class KNativeTriggerProvider implements TriggerProvider {
  private readonly logger = new Logger(KNativeTriggerProvider.name);

  private readonly emitCloudEvent: EmitterFunction;
  private customObjectsApi: CustomObjectsApi;

  constructor(
    private readonly cacheManager: Cache,
    private readonly config: ConfigService,
  ) {
    if (config.knativeBrokerUrl) {
      this.emitCloudEvent = emitterFor(httpTransport(config.knativeBrokerUrl));
    } else {
      this.logger.error('KNative broker URL is not set. KNative trigger provider will not be available.');
      this.emitCloudEvent = (() => {
        this.logger.error('KNative broker URL is not set. Cloud event will not be emitted.');
      }) as unknown as EmitterFunction;
    }
  }

  async init() {
    this.logger.debug('Initializing KNative trigger provider...');
    this.logger.debug('Initializing Kubernetes API client...');

    this.customObjectsApi = makeCustomObjectsApiClient().customObjectsApi;
    await this.createResponseTrigger();
  }

  toDto(triggerDef: KNativeTriggerDef): TriggerDto {
    const getSource = (): TriggerSource => {
      const attributes = triggerDef.spec.filter.attributes;

      if (attributes.type.startsWith('webhookHandle:')) {
        return {
          webhookHandleId: attributes.type.replace('webhookHandle:', ''),
        };
      } else if (attributes.type === 'trigger.response') {
        return {};
      } else {
        throw new Error(`Unsupported trigger type ${attributes.type}`);
      }
    };

    const getDestination = (): TriggerDestination => {
      const subscriberRef = triggerDef.spec.subscriber.ref;
      if (!subscriberRef) {
        return {};
      }

      if (subscriberRef.kind === 'Service' && subscriberRef.name.startsWith('function-')) {
        return {
          serverFunctionId: subscriberRef.name.replace('function-', ''),
        };
      } else {
        throw new Error(`Unsupported subscriber: ${subscriberRef.kind}, ${subscriberRef.name}`);
      }
    };

    return {
      id: triggerDef.metadata.uid,
      name: triggerDef.metadata.labels.name || triggerDef.metadata.name,
      environmentId: triggerDef.metadata.labels.environment,
      source: getSource(),
      destination: getDestination(),
      waitForResponse: triggerDef.metadata.labels.waitForResponse === 'true',
    };
  }

  async findTriggerById(environmentId: string, id: string): Promise<TriggerDto | null> {
    const cacheKey = this.getCacheKey(environmentId, id);
    const cachedTrigger = await this.cacheManager.get(cacheKey);
    if (cachedTrigger) {
      return cachedTrigger as TriggerDto;
    }

    const trigger = (await this.getTriggers(environmentId))
      .find(trigger => trigger.id === id) || null;
    if (trigger) {
      await this.cacheManager.set(cacheKey, trigger);
    }

    return trigger;
  }

  async getTriggers(environmentId?: string): Promise<TriggerDto[]> {
    this.logger.debug(`Getting triggers for environment ${environmentId}`);

    try {
      const response = await this.customObjectsApi.listNamespacedCustomObject(
        TRIGGERS_GROUP,
        TRIGGERS_VERSION,
        this.config.knativeTriggerNamespace,
        TRIGGERS_NAME,
      );
      const triggers = (response.body as any).items as KNativeTriggerDef[];
      return triggers
        .filter(triggerDef => !environmentId || triggerDef.metadata.labels?.environment === environmentId)
        .map(triggerDef => this.toDto(triggerDef));
    } catch (err) {
      this.logger.error(`Failed to get triggers for environment ${environmentId}: ${err}`);
      throw err;
    }
  }

  async createTrigger(
    environmentId: string,
    name: string | null,
    source: TriggerSource,
    destination: TriggerDestination,
    waitForResponse: boolean,
  ): Promise<TriggerDto> {
    if (name) {
      await this.checkTriggerName(environmentId, name);
    }

    const triggerData = this.getTriggerData(environmentId, name, source, destination, waitForResponse);
    const triggerName = triggerData.metadata.name;
    this.logger.debug(`Creating trigger ${triggerName} (environmentId: ${environmentId})`);

    try {
      await this.customObjectsApi.createNamespacedCustomObject(
        TRIGGERS_GROUP,
        TRIGGERS_VERSION,
        this.config.knativeTriggerNamespace,
        TRIGGERS_NAME,
        triggerData,
      );
    } catch (e) {
      if (e.body?.code === 409) {
        throw new Error(`Trigger ${triggerName} already exists`);
      }
      this.logger.error('Error creating trigger:', e.body?.message || e);
      throw e;
    }

    const triggerDef = await this.findTriggerDefByName(triggerName);
    if (!triggerDef) {
      throw new Error(`Trigger ${triggerName} could not be created`);
    }

    const trigger = this.toDto(triggerDef);
    await this.cacheManager.set(this.getCacheKey(environmentId, trigger.id), trigger);

    return trigger;
  }

  async updateTrigger(
    environmentId: string,
    trigger: TriggerDto,
    name: string | null | undefined,
    waitForResponse: boolean | undefined,
  ): Promise<TriggerDto> {
    if (name) {
      await this.checkTriggerName(environmentId, name, [trigger.id]);
    }

    name = name === undefined ? trigger.name : name;
    waitForResponse = waitForResponse ?? trigger.waitForResponse;

    const triggerData = this.getTriggerData(environmentId, name, trigger.source, trigger.destination, waitForResponse);
    const triggerName = triggerData.metadata.name;

    this.logger.debug(`Updating trigger ${triggerName} (environmentId: ${environmentId})`);

    try {
      await this.customObjectsApi.patchNamespacedCustomObject(
        TRIGGERS_GROUP,
        TRIGGERS_VERSION,
        this.config.knativeTriggerNamespace,
        TRIGGERS_NAME,
        triggerName,
        [
          { op: 'replace', path: '/spec', value: triggerData.spec },
          { op: 'replace', path: '/metadata/labels', value: triggerData.metadata.labels },
        ],
        undefined,
        undefined,
        undefined,
        {
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        },
      );
    } catch (e) {
      if (e.body?.code === 409) {
        throw new Error(`Trigger ${triggerName} already exists`);
      }
      this.logger.error('Error updating trigger:', e.body?.message || e);
      throw e;
    }

    const triggerDef = await this.findTriggerDefByName(triggerName);
    if (!triggerDef) {
      throw new Error(`Trigger ${triggerName} could not be updated`);
    }

    trigger = this.toDto(triggerDef);
    await this.cacheManager.set(this.getCacheKey(environmentId, trigger.id), trigger);

    return trigger;
  }

  private getTriggerData(
    environmentId: string,
    name: string | null,
    source: TriggerSource,
    destination: TriggerDestination,
    waitForResponse: boolean,
  ) {
    const getSubscriberConfig = (): SubscriberConfig => {
      if (destination.serverFunctionId) {
        return {
          apiVersion: 'serving.knative.dev/v1',
          kind: 'Service',
          name: `function-${destination.serverFunctionId}`,
        };
      } else {
        throw new Error(`Unsupported destination: ${JSON.stringify(destination)}`);
      }
    };

    const triggerName = this.getTriggerName(environmentId, source, destination);
    const subscriberConfig = getSubscriberConfig();

    return {
      apiVersion: 'eventing.knative.dev/v1',
      kind: 'Trigger',
      metadata: {
        name: triggerName,
        labels: {
          name,
          environment: environmentId,
          waitForResponse: waitForResponse ? 'true' : 'false',
        },
      },
      spec: {
        broker: this.config.knativeBrokerName,
        filter: {
          attributes: {
            type: this.getType(source),
            environment: environmentId,
          },
        },
        subscriber: {
          ref: {
            apiVersion: subscriberConfig.apiVersion,
            kind: subscriberConfig.kind,
            name: subscriberConfig.name,
          },
        },
      },
    };
  }

  async deleteTrigger(environmentId: string, trigger: TriggerDto): Promise<void> {
    this.logger.debug(`Deleting trigger ${trigger.name} (environmentId: ${environmentId})`);

    try {
      await this.customObjectsApi.deleteNamespacedCustomObject(
        TRIGGERS_GROUP,
        TRIGGERS_VERSION,
        this.config.knativeTriggerNamespace,
        TRIGGERS_NAME,
        this.getTriggerName(environmentId, trigger.source, trigger.destination),
      );
      await this.cacheManager.del(this.getCacheKey(environmentId, trigger.id));
    } catch (e) {
      if (e.body?.code === 404) {
        return;
      }
      this.logger.error('Error deleting trigger:', e);
      throw e;
    }
  }

  async triggerEvent(environmentId: string, executionId: string, source: TriggerSource, data: any): Promise<void> {
    this.logger.debug(`Triggering event ${executionId} (source: ${JSON.stringify(source)})`);
    const cloudEvent = new CloudEvent({
      type: this.getType(source),
      source: executionId,
      environment: environmentId,
      executionid: executionId,
      data,
    });

    const event = await this.emitCloudEvent(cloudEvent);
    this.logger.debug(`Event ${executionId} triggered`, event);
  }

  private getType(source: TriggerSource) {
    if (source.webhookHandleId) {
      return `webhookHandle:${source.webhookHandleId}`;
    } else {
      throw new Error(`Unsupported source: ${JSON.stringify(source)}`);
    }
  }

  private async findTriggerDefByName(name: string): Promise<KNativeTriggerDef | null> {
    try {
      const response = await this.customObjectsApi.getNamespacedCustomObject(
        TRIGGERS_GROUP,
        TRIGGERS_VERSION,
        this.config.knativeTriggerNamespace,
        TRIGGERS_NAME,
        name,
      );
      return response.body as KNativeTriggerDef;
    } catch (e) {
      if (e.body?.code === 404) {
        return null;
      }
      this.logger.error('Error getting trigger:', e);
      if (process.env.SKIP_KNATIVE) {
        return null;
      } else {
        throw e;
      }
    }
  }

  private getTriggerName(environmentId: string, source: TriggerSource, destination: TriggerDestination): string {
    const getSourceName = (): string => {
      if (source.webhookHandleId) {
        return `wh-${source.webhookHandleId}`;
      } else {
        throw new Error(`Unsupported source: ${JSON.stringify(source)}`);
      }
    };
    const getDestinationName = (): string => {
      if (destination.serverFunctionId) {
        return `sf-${destination.serverFunctionId}`;
      } else {
        throw new Error(`Unsupported destination: ${JSON.stringify(destination)}`);
      }
    };

    const name = `${environmentId}:${getSourceName()}:${getDestinationName()}`;
    const hash = crypto.createHash('sha256');
    hash.update(name);
    return hash.digest('hex').substring(0, 32);
  }

  private getCacheKey(environmentId: string, id: string) {
    return `trigger:${environmentId}:${id}`;
  }

  private async createResponseTrigger() {
    const responseTrigger = await this.findTriggerDefByName(RESPONSE_TRIGGER_NAME);
    if (responseTrigger) {
      this.logger.debug('Response trigger already exists. Skipping creation.');
      return;
    }

    this.logger.debug('Creating response trigger...');
    try {
      await this.customObjectsApi.createNamespacedCustomObject(
        TRIGGERS_GROUP,
        TRIGGERS_VERSION,
        this.config.knativeTriggerNamespace,
        TRIGGERS_NAME,
        {
          apiVersion: 'eventing.knative.dev/v1',
          kind: 'Trigger',
          metadata: {
            name: RESPONSE_TRIGGER_NAME,
          },
          spec: {
            broker: this.config.knativeBrokerName,
            filter: {
              attributes: {
                type: 'trigger.response',
              },
            },
            subscriber: {
              uri: this.config.knativeTriggerResponseUrl,
            },
            delivery: {
              retry: 0,
            },
          },
        },
      );
    } catch (e) {
      this.logger.error('Error creating response trigger:', e);
    }
  }

  private async checkTriggerName(environmentId: string, name: string, excludedIds: string[] = []) {
    const existingTrigger = (await this.getTriggers(environmentId))
      .filter(trigger => !excludedIds.includes(trigger.id))
      .some(trigger => trigger.name === name);
    if (existingTrigger) {
      throw new CommonError(NAME_CONFLICT, `Trigger with name '${name}' already exists.`);
    }
  }
}
