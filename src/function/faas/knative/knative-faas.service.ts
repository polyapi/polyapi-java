import util from 'util';
import { exec as execAsync } from 'child_process';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, lastValueFrom, map } from 'rxjs';
import { AxiosError } from 'axios';
import { ConfigService } from 'config/config.service';
import { FaasService } from '../faas.service';

// sleep function from SO
// https://stackoverflow.com/a/39914235
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const exec = util.promisify(execAsync);

const KNATIVE_EXEC_FILE = process.env.KNATIVE_EXEC_FILE || `${process.cwd()}/bin/kn-func`;
const BASE_FOLDER = process.env.FUNCTIONS_BASE_FOLDER || `${process.cwd()}/server-functions`;

export class KNativeFaasService implements FaasService {
  private logger = new Logger(KNativeFaasService.name);

  constructor(private readonly config: ConfigService, private readonly http: HttpService) {}

  async init(): Promise<void> {
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
    fs.mkdirSync(path.dirname(this.config.faasDockerConfigFile), { recursive: true });
    fs.writeFileSync(this.config.faasDockerConfigFile, JSON.stringify(getConfig(), null, 2));
  }

  async createFunction(
    id: string,
    tenantId: string,
    environmentId: string,
    name: string,
    code: string,
    requirements: string[],
    apiKey: string,
  ): Promise<void> {
    const functionPath = this.getFunctionPath(id, tenantId, environmentId);
    if (fs.existsSync(functionPath)) {
      await this.cleanUpFunction(id, functionPath);
    }
    await exec(`${KNATIVE_EXEC_FILE} create ${functionPath} -l node`);

    await this.preparePolyLib(functionPath, apiKey);
    await this.prepareRequirements(functionPath, requirements);

    const template = fs.readFileSync(`${process.cwd()}/dist/function/faas/knative/templates/index.js.hbs`, 'utf8');
    const indexFileContent = handlebars.compile(template)({
      name,
      code,
    });
    fs.writeFileSync(`${functionPath}/index.js`, indexFileContent);

    await this.deploy(id, tenantId, environmentId);
  }

  async executeFunction(
    id: string,
    tenantId: string,
    environmentId: string,
    args: any[],
    maxRetryCount = 3,
  ): Promise<any> {
    const functionPath = this.getFunctionPath(id, tenantId, environmentId);
    const functionUrl = await this.getFunctionUrl(functionPath);

    if (!functionUrl) {
      if (maxRetryCount > 0) {
        await this.deploy(id, tenantId, environmentId);
        return this.executeFunction(id, tenantId, environmentId, args, maxRetryCount - 1);
      } else {
        this.logger.error(`Function ${id} is not running`);
        throw new Error(`Function ${id} is not running`);
      }
    }

    this.logger.debug(`Executing server function '${id}' (maxRetryCount=${maxRetryCount})...`);
    this.logger.verbose(`Calling ${functionUrl}`);
    this.logger.verbose({ args });
    return await lastValueFrom(
      this.http
        .post(`${functionUrl}`, { args })
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
              return this.executeFunction(id, tenantId, environmentId, args, 0);
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
    requirements: string[],
    apiKey: string,
  ): Promise<void> {
    this.logger.debug(`Updating server function '${id}'...`);

    const functionPath = this.getFunctionPath(id, tenantId, environmentId);
    if (!fs.existsSync(functionPath)) {
      return;
    }

    await this.preparePolyLib(functionPath, apiKey);
    await this.prepareRequirements(functionPath, requirements);
  }

  async deleteFunction(id: string, tenantId: string, environmentId: string): Promise<void> {
    this.logger.debug(`Deleting server function '${id}'...`);

    const functionPath = this.getFunctionPath(id, tenantId, environmentId);
    await this.cleanUpFunction(id, functionPath);
    await exec(`docker rmi ${this.config.faasDockerContainerRegistry}/${this.getFunctionName(id)} -f`);
    await exec(`rm -rf ${functionPath}`);

    this.logger.debug(`Server function '${id}' docker container and files removed.`);
  }

  private getFunctionPath(id: string, tenantId: string, environmentId: string): string {
    return `${BASE_FOLDER}/${tenantId}/${environmentId}/${this.getFunctionName(id)}`;
  }

  private getFunctionName(id: string) {
    return `function-${id}`;
  }

  private async preparePolyLib(functionPath: string, apiKey: string) {
    await exec(`npm install --prefix ${functionPath} polyapi@${this.config.polyClientNpmVersion}`);
    fs.mkdirSync(`${functionPath}/node_modules/.poly`, { recursive: true });
    await exec(
      `POLY_API_BASE_URL=${this.config.faasPolyServerUrl} POLY_API_KEY=${apiKey} npx --prefix ${functionPath} poly generate`,
    );
  }

  private async prepareRequirements(functionPath: string, requirements: string[]) {
    if (requirements.length === 0) {
      return;
    }

    for (const library of requirements) {
      await exec(`npm install --prefix ${functionPath} ${library}`);
    }
  }

  private async deploy(id: string, tenantId: string, environmentId: string) {
    const functionPath = this.getFunctionPath(id, tenantId, environmentId);

    this.logger.debug(`Building server function '${id}'...`);
    await exec(`${KNATIVE_EXEC_FILE} build --registry ${this.config.faasDockerContainerRegistry}`, {
      cwd: functionPath,
    });

    this.logger.debug(`Deploying server function '${id}'...`);
    await exec(`${KNATIVE_EXEC_FILE} deploy --registry ${this.config.faasDockerContainerRegistry}`, {
      cwd: functionPath,
    });

    await sleep(5000);
  }

  private async cleanUpFunction(id: string, functionPath: string) {
    try {
      await exec(`${KNATIVE_EXEC_FILE} delete ${id}`);
    } catch (e) {
      this.logger.error(`Error while deleting KNative function: ${e.message}`);
    }

    if (fs.existsSync(functionPath)) {
      fs.rmSync(functionPath, { recursive: true });
    }
  }

  private async getFunctionUrl(functionPath: string): Promise<string | null> {
    try {
      const { stdout, stderr } = await exec(`${KNATIVE_EXEC_FILE} describe -o url`, { cwd: functionPath });
      if (stdout) {
        return stdout;
      }
      if (stderr) {
        this.logger.error(`Function not running: ${stderr}`);
      }
    } catch (e) {
      this.logger.error(`Error while building function: ${e}`);
    }

    return null;
  }
}
