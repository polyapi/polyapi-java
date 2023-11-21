import util from 'util';
import { exec as execAsync } from 'child_process';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { pick } from 'lodash';
import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, lastValueFrom, map } from 'rxjs';
import { AxiosError } from 'axios';
import { ConfigService } from 'config/config.service';
import { ExecuteFunctionResult, FaasService } from '../faas.service';
import { CustomObjectsApi } from '@kubernetes/client-node';
import { makeCustomObjectsApiClient } from 'kubernetes/client';
import { ServerFunctionLimits } from '@poly/model';
import { ServerFunctionDoesNotExists } from './errors/ServerFunctionDoesNotExist';

// sleep function from SO
// https://stackoverflow.com/a/39914235
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const exec = util.promisify(execAsync);
const exists = util.promisify(fs.exists);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);
const rm = util.promisify(fs.rm);

const SERVING_GROUP = 'serving.knative.dev';
const SERVING_VERSION = 'v1';
const SERVICES_NAME = 'services';
const ROUTES_NAME = 'routes';
const PASS_THROUGH_HEADERS = ['openai-ephemeral-user-id', 'openai-conversation-id'];

interface NamespaceCondition {
  conditions: {
    status: string;
    type: string;
    message: string;
    reason: string;
  }[]
  phase: string;
};

interface KNativeRouteDef {
  status: {
    url: string;
  }
}

export class KNativeFaasService implements FaasService {
  private logger = new Logger(KNativeFaasService.name);
  private k8sApi: CustomObjectsApi;

  constructor(private readonly config: ConfigService, private readonly http: HttpService) {
  }

  async init(): Promise<void> {
    this.logger.debug('Initializing KNativeFaasService...');
    this.logger.debug('Initializing docker config...');
    if (!this.config.faasDockerUsername || !this.config.faasDockerPassword) {
      this.logger.debug('No docker credentials provided, skipping docker config creation');
      return;
    }

    const getConfig = () => {
      const config = {
        auths: {},
      };
      if (fs.existsSync(this.config.faasDockerConfigFile)) {
        Object.assign(config, JSON.parse(fs.readFileSync(this.config.faasDockerConfigFile, 'utf8')));
      }
      config.auths[this.config.faasDockerContainerRegistry.split('/')[0]] = {
        auth: Buffer.from(`${this.config.faasDockerUsername}:${this.config.faasDockerPassword}`).toString('base64'),
      };
      return config;
    };

    this.logger.debug(`Writing docker config to ${this.config.faasDockerConfigFile}`);
    await mkdir(path.dirname(this.config.faasDockerConfigFile), { recursive: true });
    await writeFile(this.config.faasDockerConfigFile, JSON.stringify(getConfig(), null, 2));

    this.logger.debug('Initializing Kubernetes API client...');
    this.k8sApi = makeCustomObjectsApiClient();
  }

  async createFunction(
    id: string,
    tenantId: string,
    environmentId: string,
    name: string,
    code: string,
    requirements: string[],
    apiKey: string,
    limits: ServerFunctionLimits,
    createFromScratch?: boolean,
    sleep?: boolean | null,
    sleepAfter?: number | null,
    logsEnabled = false,
  ): Promise<void> {
    this.logger.debug(`Creating function ${id} for tenant ${tenantId} in environment ${environmentId}...`);

    const functionPath = this.getFunctionPath(id, tenantId, environmentId);
    const prepareAndDeploy = async (imageName: string) => {
      if (!await exists(`${functionPath}/function`)) {
        await mkdir(`${functionPath}/function`, { recursive: true });
      }

      const template = await readFile(`${process.cwd()}/dist/function/faas/knative/templates/function/index.js.hbs`, 'utf8');
      const content = handlebars.compile(template)({
        name,
        code,
      });
      this.logger.debug(`Writing function code to ${functionPath}/function/index.js`);
      await writeFile(`${functionPath}/function/index.js`, content);

      await this.deploy(id, tenantId, environmentId, imageName, apiKey, limits, sleep, sleepAfter, logsEnabled);
    };

    const additionalRequirements = this.filterPreinstalledNpmPackages(requirements);
    if (additionalRequirements.length > 0 || createFromScratch) {
      const customImageName = `${this.config.faasDockerContainerRegistry}/${this.getFunctionName(id)}`;

      // not awaiting on purpose, so it returns immediately with the message
      this.logger.debug(`Additional requirements found for function '${id}'. Building custom image ${customImageName}...`);

      await this.buildCustomImage(id, tenantId, environmentId, customImageName, additionalRequirements, apiKey, name, code);

      await prepareAndDeploy(customImageName);
    } else {
      await prepareAndDeploy(`${this.config.faasDockerImageFunctionNode}`);
    }
  }

  async executeFunction(
    id: string,
    functionEnvironmentId: string,
    tenantId: string,
    executionEnvironmentId: string,
    args: any[],
    headers = {},
    maxRetryCount = 3,
  ): Promise<ExecuteFunctionResult> {
    let functionUrl = '';
    try {
      functionUrl = await this.getFunctionUrl(id);
    } catch (err) {
      if (err instanceof ServerFunctionDoesNotExists) {
        throw new Error(`Function ${id} does not exists. Please, redeploy it again.`);
      }
      throw err;
    }

    this.logger.debug(`Executing server function '${id}'...`);
    this.logger.verbose(`Calling ${functionUrl}`);
    this.logger.verbose({ args: JSON.stringify(args) });
    const sanitizedHeaders = {
      ...(this.filterPassThroughHeaders(headers) || {}),
      'x-poly-do-log': functionEnvironmentId === executionEnvironmentId,
    };
    return await lastValueFrom(
      this.http
        .post(`${functionUrl}`, { args }, { headers: sanitizedHeaders })
        .pipe(map((response) => (
          {
            body: response.data,
            statusCode: response.status,
          }
        )))
        .pipe(
          catchError(async (error: AxiosError) => {
            if (error.response?.status !== 500) {
              return {
                body: error.response?.data,
                statusCode: error.response?.status || 500,
              };
            }

            this.logger.error(
              `Error while performing HTTP request for server function (id: ${id}): ${
                (error.response?.data as any)?.message || error
              }`,
            );
            if (maxRetryCount > 0) {
              await sleep(2000);
              return this.executeFunction(id, functionEnvironmentId, tenantId, executionEnvironmentId, args, headers, 0);
            }

            throw error;
          }),
        ),
    );
  }

  updateFunction(
    id: string,
    tenantId: string,
    environmentId: string,
    name: string,
    code: string,
    requirements: string[],
    apiKey: string,
    limits: ServerFunctionLimits,
    sleep?: boolean | null,
    sleepAfter?: number | null,
    logsEnabled = false,
  ): Promise<void> {
    this.logger.debug(`Updating server function '${id}'...`);

    return this.createFunction(id, tenantId, environmentId, name, code, requirements, apiKey, limits, undefined, sleep, sleepAfter, logsEnabled);
  }

  async deleteFunction(id: string, tenantId: string, environmentId: string, cleanPath = true): Promise<void> {
    this.logger.debug(`Deleting server function '${id}'...`);

    try {
      await this.k8sApi.deleteNamespacedCustomObject(
        SERVING_GROUP,
        SERVING_VERSION,
        this.config.knativeTriggerNamespace,
        SERVICES_NAME,
        this.getFunctionName(id),
      );
    } catch (e) {
      if (e.body?.code === 404) {
        this.logger.debug(`Server function '${id}' doesn't exist, nothing to delete.`);
        return;
      }
      this.logger.error(`Error deleting server function '${id}':`, e);
      throw e;
    }
    this.logger.debug(`Server function '${id}' removed.`);

    if (!cleanPath) {
      return;
    }

    const functionPath = this.getFunctionPath(id, tenantId, environmentId);
    if (await exists(functionPath)) {
      await rm(functionPath, { recursive: true });
      this.logger.debug(`Removed function folder (${functionPath})`);
    } else {
      this.logger.debug(`Didn't remove function folder, functionPath (${functionPath}) doesn't exist.`);
    }
  }

  private getFunctionPath(id: string, tenantId: string, environmentId: string, relative = false): string {
    return `${relative ? '' : `${this.config.faasFunctionsBasePath}/`}${tenantId}/${environmentId}/${this.getFunctionName(id)}`;
  }

  public getFunctionName(id: string) {
    return `function-${id}`;
  }

  private async preparePolyLib(functionPath: string, apiKey: string) {
    this.logger.debug(`Preparing polyapi library for function '${functionPath}'...`);
    await exec(`npm install --prefix ${functionPath} polyapi@${this.config.polyClientNpmVersion}`);
    await mkdir(`${functionPath}/node_modules/.poly`, { recursive: true });
    await exec(
      `POLY_API_BASE_URL=${this.config.faasPolyServerUrl} POLY_API_KEY=${apiKey} npx --prefix ${functionPath} poly generate`,
    );
  }

  private async prepareRequirements(functionPath: string, requirements: string[]) {
    if (requirements.length === 0) {
      return;
    }

    this.logger.debug(`Preparing additional requirements for function '${functionPath}'...`);
    for (const library of requirements) {
      await exec(`npm install --prefix ${functionPath} ${library}`);
    }
  }

  private async deploy(
    id: string,
    tenantId: string,
    environmentId: string,
    imageName: string,
    apiKey: string,
    limits: ServerFunctionLimits,
    sleepFn?: boolean | null,
    sleepAfter?: number | null,
    logsEnabled = false,
  ) {
    this.logger.debug(`Deleting function '${id}' before deploying to avoid conflicts...`);
    await this.deleteFunction(id, tenantId, environmentId, false);

    this.logger.debug(`Creating KNative service for function '${id}'...`);

    const functionPath = `${tenantId}/${environmentId}/${this.getFunctionName(id)}`;
    const getAnnotations = () => {
      const annotations = {};
      if (sleepFn == null) {
        sleepFn = true;
      }
      if (sleepAfter == null || sleepAfter <= 0) {
        sleepAfter = this.config.faasDefaultSleepSeconds;
      }

      if (sleepFn) {
        annotations['autoscaling.knative.dev/class'] = 'kpa.autoscaling.knative.dev';
        annotations['autoscaling.knative.dev/window'] = `${sleepAfter}s`;
      } else {
        annotations['autoscaling.knative.dev/class'] = 'hpa.autoscaling.knative.dev';
      }

      return annotations;
    };

    const cachedPolyGenerateCommand = `if [ -d "/workspace/function/.poly/lib" ];
    then echo 'Cached Poly library found, reusing...' && cp -r /workspace/function/.poly /workspace/node_modules/;
    else npx poly generate && cp -r /workspace/node_modules/.poly /workspace/function/; fi`;

    const startUpCommand = `if [ -f "/workspace/function/function/index.js" ]; 
    then /cnb/lifecycle/launcher "cp -f /workspace/function/function/index.js /workspace/ && ${cachedPolyGenerateCommand} && npm start"; 
    else /cnb/lifecycle/launcher "npx poly generate"; fi`;

    const options = {
      apiVersion: 'serving.knative.dev/v1',
      kind: 'Service',
      metadata: {
        name: this.getFunctionName(id),
        namespace: this.config.faasNamespace,
      },
      spec: {
        template: {
          metadata: {
            annotations: getAnnotations(),
            labels: {
              logging: logsEnabled ? 'enabled' : 'disabled',
            },
          },
          spec: {
            timeoutSeconds: limits.time,
            containers: [
              {
                readinessProbe: {
                  exec: {
                    command: [
                      'pwd',
                      `cd /workspace/function/${functionPath}`,
                      'pwd',
                      `
                      node -e "require('./index.js')({ readinessProbe: true }).then(result => result === 1 ? process.exit(0) : process.exit(1)).catch(() => process.exit(1));"

                      if [ $? -eq 0 ]
                      then
                          echo "Custom function ready";
                          exit 0
                      else
                          echo "Custom function result is not equal to 1" >&2;
                          exit 1
                      fi
                      `,
                    ],
                  },
                  initialDelaySeconds: 3,
                  periodSeconds: 3,
                },
                startupProbe: {
                  exec: {
                    command: ['pwd'],
                  },
                  failureThreshold: 3,
                  periodSeconds: 23,
                },
                image: `${imageName}`,
                volumeMounts: [
                  {
                    mountPath: '/workspace/function',
                    name: 'functions-volume',
                    subPath: `${functionPath}`,
                    readOnly: false,
                  },
                ],
                env: [
                  {
                    name: 'ENVIRONMENT_SETUP_COMPLETE',
                    value: 'true',
                  },
                  {
                    name: 'POLY_API_BASE_URL',
                    value: this.config.faasPolyServerUrl,
                  },
                  {
                    name: 'POLY_API_KEY',
                    value: apiKey,
                  },
                ],
                command: ['/bin/sh', '-c'],
                args: [startUpCommand],
                workingDir: '/workspace/function',
                resources: {
                  limits: {
                    cpu: limits.cpu ? `${limits.cpu}m` : undefined,
                    memory: limits.memory ? `${limits.memory}Mi` : undefined,
                  },
                },
              },
            ],
            volumes: [
              {
                name: 'functions-volume',
                persistentVolumeClaim: {
                  claimName: this.config.faasPvcName,
                },
              },
            ],
          },
        },
      },
    };

    this.logger.debug(`createNamespacedCustomObject options - ${JSON.stringify(options)}`);

    try {
      await this.k8sApi.createNamespacedCustomObject(
        SERVING_GROUP,
        SERVING_VERSION,
        this.config.faasNamespace,
        SERVICES_NAME,
        options,
      );

      let attempts = 0;
      let namespacedCustomObjectReady = false;

      while (attempts <= 2 && !namespacedCustomObjectReady) {
        try {
          await sleep(3000);

          const response = await this.k8sApi.getNamespacedCustomObjectStatus(SERVING_GROUP, SERVING_VERSION, this.config.faasNamespace, SERVICES_NAME, this.getFunctionName(id));

          const responseBody = response.body as NamespaceCondition;

          const readinessCondition = responseBody.conditions.find(cond => cond.type === 'Ready');

          if (readinessCondition && readinessCondition.status === 'True') {
            namespacedCustomObjectReady = true;
          }
        } catch (err) {
          this.logger.error('Err checking readiness probe status.', err);
        }
        attempts++;
      }

      this.logger.debug(`KNative service for function '${id}' created. Function deployed.`);

      if (!namespacedCustomObjectReady) {
        this.logger.debug('WARNING: ReadinessProbe is not successful.');
      }
    } catch (e) {
      if (e.body?.code === 409) {
        this.logger.warn(`Server function '${id}' already exists, skipping.`);
        return;
      }
      this.logger.error(`Error while creating KNative service: ${e.message}`, JSON.stringify(e));
      throw e;
    }
  }

  private filterPreinstalledNpmPackages(requirements: string[]): string[] {
    return requirements.filter((requirement) => !this.config.faasPreinstalledNpmPackages.includes(requirement));
  }

  /**
   * @throws {ServerFunctionDoesNotExists}
   */
  private async getFunctionUrl(id: string): Promise<string> {
    const name = this.getFunctionName(id);

    try {
      const response = await this.k8sApi.getNamespacedCustomObject(
        SERVING_GROUP,
        SERVING_VERSION,
        this.config.faasNamespace,
        ROUTES_NAME,
        name,
      );

      const route = response.body as KNativeRouteDef;
      return route.status.url;
    } catch (e) {
      if (e.body?.code === 404) {
        this.logger.debug(`Server function '${id}' doesn't exist.`);
        throw new ServerFunctionDoesNotExists(e.message);
      }
      this.logger.error(`Error while getting function: ${e.message}`, e);
      throw e;
    }
  }

  private filterPassThroughHeaders(headers: Record<string, any>): Record<string, any> {
    return pick(headers, PASS_THROUGH_HEADERS);
  }

  private async buildCustomImage(id: string, tenantId: string, environmentId: string, imageName: string, additionalRequirements: string[], apiKey: string, name: string, code: string) {
    const functionPath = this.getFunctionPath(id, tenantId, environmentId);
    const allRequirements = [...this.config.faasPreinstalledNpmPackages, ...additionalRequirements];

    try {
      await rm(functionPath, { recursive: true });
    } catch (err) {
      this.logger.debug(`Err removing previous function path ${functionPath}, creating new folder...`, err);
    }
    await mkdir(functionPath, { recursive: true });
    await exec(`${this.config.knativeFuncExecFile} create ${functionPath} -l node`);

    await this.preparePolyLib(functionPath, apiKey);
    await this.prepareRequirements(functionPath, allRequirements);

    const template = await readFile(`${process.cwd()}/dist/function/faas/knative/templates/function/index.js.hbs`, 'utf8');
    const content = handlebars.compile(template)({
      name,
      code,
    });
    await writeFile(`${functionPath}/index.js`, content);

    this.logger.debug(`Building custom server function image '${imageName}'...`);
    await exec(`${this.config.knativeFuncExecFile} build --image ${imageName} --push`, {
      cwd: functionPath,
    });
  }
}
