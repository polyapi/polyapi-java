import { CustomObjectsApi } from '@kubernetes/client-node';
import { CloudEvent, emitterFor, EmitterFunction, httpTransport } from 'cloudevents';
import { Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import crypto from 'crypto';
import { ConfigService } from 'config/config.service';
import { TriggerProvider } from 'trigger/provider/trigger-provider';
import { TriggerDestination, TriggerDto, TriggerSource } from '@poly/model';
import { makeCustomObjectsApiClient } from 'kubernetes/client';

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
  private k8sApi: CustomObjectsApi;

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

    this.k8sApi = makeCustomObjectsApiClient();
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
        return {
        };
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
      const response = await this.k8sApi.listNamespacedCustomObject(
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

  async createTrigger(environmentId: string, name: string | null, source: TriggerSource, destination: TriggerDestination): Promise<TriggerDto> {
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
    this.logger.debug(`Creating trigger ${triggerName} (environmentId: ${environmentId})`);

    try {
      await this.k8sApi.createNamespacedCustomObject(
        TRIGGERS_GROUP,
        TRIGGERS_VERSION,
        this.config.knativeTriggerNamespace,
        TRIGGERS_NAME,
        {
          apiVersion: 'eventing.knative.dev/v1',
          kind: 'Trigger',
          metadata: {
            name: triggerName,
            labels: {
              name,
              environment: environmentId,
            },
          },
          spec: {
            broker: this.config.knativeBrokerName,
            filter: {
              attributes: {
                type: this.getType(source),
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
        },
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

  async deleteTrigger(environmentId: string, trigger: TriggerDto): Promise<void> {
    this.logger.debug(`Deleting trigger ${trigger.name} (environmentId: ${environmentId})`);

    try {
      await this.k8sApi.deleteNamespacedCustomObject(
        TRIGGERS_GROUP,
        TRIGGERS_VERSION,
        this.config.knativeTriggerNamespace,
        TRIGGERS_NAME,
        trigger.name,
      );
    } catch (e) {
      if (e.body?.code === 404) {
        return;
      }
      this.logger.error('Error deleting trigger:', e);
      throw e;
    }
  }

  async triggerEvent(executionId: string, source: TriggerSource, data: any): Promise<void> {
    this.logger.debug(`Triggering event ${executionId} (source: ${JSON.stringify(source)})`);
    const cloudEvent = new CloudEvent({
      type: this.getType(source),
      source: executionId,
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
      const response = await this.k8sApi.getNamespacedCustomObject(
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
      await this.k8sApi.createNamespacedCustomObject(
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
}
