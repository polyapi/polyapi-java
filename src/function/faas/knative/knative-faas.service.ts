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
import { FaasFunctionResult, FaasService } from '../faas.service';
import { CustomObjectsApi } from '@kubernetes/client-node';
import { makeCustomObjectsApiClient } from 'kubernetes/client';

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
  ): Promise<FaasFunctionResult> {
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

      await this.deploy(id, tenantId, environmentId, imageName, apiKey);
    };

    const additionalRequirements = this.filterPreinstalledNpmPackages(requirements);
    if (additionalRequirements.length > 0) {
      const customImageName = `${this.config.faasDockerContainerRegistry}/${this.getFunctionName(id)}`;

      // not awaiting on purpose, so it returns immediately with the message
      this.logger.debug(`Additional requirements found for function '${id}'. Building custom image ${customImageName}...`);
      const waitForDeploy = this.buildCustomImage(id, tenantId, environmentId, customImageName, additionalRequirements, apiKey)
        .then(() => prepareAndDeploy(customImageName));

      return {
        status: 'deploying',
        message: 'Please note that deploying your functions will take a few minutes because it makes use of libraries others than polyapi.',
        waitForDeploy,
      };
    } else {
      await prepareAndDeploy(`${this.config.faasDockerImageFunctionNode}`);
      return {
        status: 'deployed',
      };
    }
  }

  async executeFunction(
    id: string,
    tenantId: string,
    environmentId: string,
    args: any[],
    headers = {},
    maxRetryCount = 3,
  ): Promise<any> {
    const functionUrl = await this.getFunctionUrl(id);

    if (!functionUrl) {
      this.logger.error(`Function ${id} is does not exists.`);
      throw new Error(`Function ${id} is does not exists.`);
    }

    this.logger.debug(`Executing server function '${id}'...`);
    this.logger.verbose(`Calling ${functionUrl}`);
    this.logger.verbose({ args });
    return await lastValueFrom(
      this.http
        .post(`${functionUrl}`, { args }, { headers: this.filterPassThroughHeaders(headers) })
        .pipe(map((response) => response.data))
        .pipe(
          catchError(async (error: AxiosError) => {
            this.logger.error(
              `Error while performing HTTP request for server function (id: ${id}): ${
                (error.response?.data as any)?.message || error
              }`,
            );
            if (maxRetryCount > 0) {
              await sleep(2000);
              return this.executeFunction(id, tenantId, environmentId, args, headers, 0);
            }

            throw error;
          }),
        ),
    );
  }

  async updateFunction(
    id: string,
    tenantId: string,
    environmentId: string,
    name: string,
    code: string,
    requirements: string[],
    apiKey: string,
  ): Promise<FaasFunctionResult> {
    this.logger.debug(`Updating server function '${id}'...`);

    return await this.createFunction(id, tenantId, environmentId, name, code, requirements, apiKey);
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

  private getFunctionName(id: string) {
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

  private async deploy(id: string, tenantId: string, environmentId: string, imageName: string, apiKey: string) {
    this.logger.debug(`Deleting function '${id}' before deploying to avoid conflicts...`);
    await this.deleteFunction(id, tenantId, environmentId, false);

    this.logger.debug(`Creating KNative service for function '${id}'...`);

    const workingDir = `${tenantId}/${environmentId}/${this.getFunctionName(id)}`;

    const options = {
      apiVersion: 'serving.knative.dev/v1',
      kind: 'Service',
      metadata: {
        name: this.getFunctionName(id),
        namespace: this.config.faasNamespace,
      },
      spec: {
        template: {
          spec: {
            containers: [
              {
                image: `${imageName}`,
                volumeMounts: [
                  {
                    mountPath: '/workspace/function',
                    name: 'functions-volume',
                    readOnly: false,
                  },
                ],
                env: [
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
                args: [
                  '/cnb/lifecycle/launcher "pwd"',
                  '/cnb/lifecycle/launcher "ls"',
                  '/cnb/lifecycle/launcher "rm index.js"',
                  `/cnb/lifecycle/launcher "mv /${workingDir}/function/index.js ../../../../../"`,
                  '/cnb/lifecycle/launcher "npx poly generate && npm start"',
                ],
                workingDir: `/workspace/function/${workingDir}/function`,
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
      this.logger.debug(`KNative service for function '${id}' created. Function deployed.`);
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

  private async getFunctionUrl(id: string): Promise<string | null> {
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
      } else {
        this.logger.error(`Error while getting function: ${e.message}`, e);
      }
    }

    return null;
  }

  private filterPassThroughHeaders(headers: Record<string, any>): Record<string, any> {
    return pick(headers, PASS_THROUGH_HEADERS);
  }

  private async buildCustomImage(id: string, tenantId: string, environmentId: string, imageName: string, additionalRequirements: string[], apiKey: string) {
    const functionPath = this.getFunctionPath(id, tenantId, environmentId);
    const allRequirements = [...this.config.faasPreinstalledNpmPackages, ...additionalRequirements];

    await rm(functionPath, { recursive: true });
    await mkdir(functionPath, { recursive: true });
    await exec(`${this.config.knativeFuncExecFile} create ${functionPath} -l node`);

    await this.preparePolyLib(functionPath, apiKey);
    await this.prepareRequirements(functionPath, allRequirements);

    const template = await readFile(`${process.cwd()}/dist/function/faas/knative/templates/index.js.hbs`, 'utf8');
    const content = handlebars.compile(template)({});
    await writeFile(`${functionPath}/index.js`, content);

    this.logger.debug(`Building custom server function image '${imageName}'...`);
    await exec(`${this.config.knativeFuncExecFile} build --image ${imageName} --push`, {
      cwd: functionPath,
    });
  }
}
