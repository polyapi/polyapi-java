import { CustomObjectsApi, KubeConfig } from '@kubernetes/client-node';
import { CloudEvent, emitterFor, EmitterFunction, httpTransport } from 'cloudevents';
import { Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import crypto from 'crypto';
import { ConfigService } from 'config/config.service';
import { TriggerProvider } from 'trigger/provider/trigger-provider';
import { TriggerDestination, TriggerDto, TriggerSource } from '@poly/model';

const TRIGGERS_GROUP = 'eventing.knative.dev';
const TRIGGERS_VERSION = 'v1';
const TRIGGERS_NAME = 'triggers';

type SubscriberConfig = {
  apiVersion: 'serving.knative.dev/v1';
  kind: 'Service';
  name: string;
}

interface KNativeTriggerDef {
  metadata: {
    name: string;
    labels: {
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
    const kc = new KubeConfig();

    if (process.env.KUBE_CONFIG_USE_DEFAULT === 'true') {
      this.logger.debug('Loading Kubernetes config from default location...');
      kc.loadFromDefault();
    } else if (process.env.KUBE_CONFIG_FILE_PATH) {
      this.logger.debug(`Loading Kubernetes config from ${process.env.KUBE_CONFIG_FILE_PATH}...`);
      kc.loadFromFile(process.env.KUBE_CONFIG_FILE_PATH);
    } else {
      this.logger.debug('Loading Kubernetes config from cluster...');
      kc.loadFromCluster();
    }

    this.k8sApi = kc.makeApiClient(CustomObjectsApi);
  }

  toDto(triggerDef: KNativeTriggerDef): TriggerDto {
    const getSource = (): TriggerSource => {
      const attributes = triggerDef.spec.filter.attributes;

      if (attributes.type.startsWith('webhookHandle:')) {
        return {
          webhookHandleId: attributes.type.replace('webhookHandle:', ''),
        };
      } else {
        throw new Error(`Unsupported trigger type ${attributes.type}`);
      }
    };

    const getDestination = (): TriggerDestination => {
      const subscriber = triggerDef.spec.subscriber.ref;
      if (subscriber.kind === 'Service' && subscriber.name.startsWith('function-')) {
        return {
          serverFunctionId: subscriber.name.replace('function-', ''),
        };
      } else {
        throw new Error(`Unsupported subscriber: ${subscriber.kind}, ${subscriber.name}`);
      }
    };

    return {
      id: triggerDef.metadata.uid,
      name: triggerDef.metadata.name,
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

  async getTriggers(environmentId: string): Promise<TriggerDto[]> {
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
        .filter(triggerDef => triggerDef.metadata.labels?.environment === environmentId)
        .map(triggerDef => this.toDto(triggerDef));
    } catch (err) {
      this.logger.error(`Failed to get triggers for environment ${environmentId}: ${err}`);
      throw err;
    }
  }

  async createTrigger(environmentId: string, source: TriggerSource, destination: TriggerDestination): Promise<TriggerDto> {
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
      this.logger.error('Error creating trigger:', e);
      throw e;
    }

    const trigger = await this.findTriggerByName(triggerName);
    if (!trigger) {
      throw new Error(`Trigger ${triggerName} could not be created`);
    }

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

  async triggerEvent(source: TriggerSource, data: any): Promise<void> {
    const sourceId = crypto.randomBytes(16).toString('hex');
    this.logger.debug(`Triggering event ${sourceId} (source: ${JSON.stringify(source)})`);
    const cloudEvent = new CloudEvent({
      type: this.getType(source),
      source: sourceId,
      data,
    });

    const event = await this.emitCloudEvent(cloudEvent);
    this.logger.debug(`Event ${sourceId} triggered`, event);
  }

  private getType(source: TriggerSource) {
    if (source.webhookHandleId) {
      return `webhookHandle:${source.webhookHandleId}`;
    } else {
      throw new Error(`Unsupported source: ${JSON.stringify(source)}`);
    }
  }

  private async findTriggerByName(name: string): Promise<TriggerDto | null> {
    try {
      const response = await this.k8sApi.getNamespacedCustomObject(
        TRIGGERS_GROUP,
        TRIGGERS_VERSION,
        this.config.knativeTriggerNamespace,
        TRIGGERS_NAME,
        name,
      );
      const trigger = response.body as KNativeTriggerDef;
      return this.toDto(trigger);
    } catch (e) {
      if (e.body?.code === 404) {
        return null;
      }
      this.logger.error('Error getting trigger:', e);
      throw e;
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
}
