import util from 'util';
import { exec as execAsync, spawn } from 'child_process';
import handlebars from 'handlebars';
import fs from 'fs';
import { Logger } from '@nestjs/common';
import { toCamelCase } from '@guanghechen/helper-string';
import { HttpService } from '@nestjs/axios';
import { catchError, lastValueFrom, map } from 'rxjs';
import { AxiosError } from 'axios';
import { ConfigService } from 'config/config.service';
import { FaasService } from '../faas.service';

const exec = util.promisify(execAsync);

const KNATIVE_EXEC_FILE = process.env.KNATIVE_EXEC_FILE || `${process.cwd()}/bin/kn-func`;
const BASE_FOLDER = process.env.FUNCTIONS_BASE_FOLDER || `${process.cwd()}/server-functions`;
const FAAS_HOST_BASE_URL = process.env.FAAS_HOST_BASE_URL || 'http://127.0.0.1';
const REGISTRY = 'polyapi.io/server-functions';

export class KNativeFaasService implements FaasService {
  private logger = new Logger(KNativeFaasService.name);

  constructor(private readonly config: ConfigService, private readonly http: HttpService) {
  }

  async createFunction(id: string, name: string, code: string, apiKey: string): Promise<void> {
    const functionPath = this.getFunctionPath(id);
    if (fs.existsSync(functionPath)) {
      await this.cleanUpFunction(id, functionPath);
    }
    await exec(`${KNATIVE_EXEC_FILE} create ${functionPath} -l node`);

    await this.preparePolyLib(functionPath, apiKey);

    const template = fs.readFileSync(`${process.cwd()}/dist/function/faas/knative/templates/index.js.hbs`, 'utf8');
    const indexFileContent = handlebars.compile(template)({
      name,
      code,
    });
    fs.writeFileSync(`${functionPath}/index.js`, indexFileContent);

    await this.run(id);
  }

  async executeFunction(id: string, args: any[], maxRetryCount = 3): Promise<any> {
    const functionPath = this.getFunctionPath(id);
    const functionPort = this.getRunningPort(functionPath);

    if (!functionPort && maxRetryCount > 0) {
      await this.run(id);
      return this.executeFunction(id, args, maxRetryCount - 1);
    }

    this.logger.debug(`Executing server function '${id}' (maxRetryCount=${maxRetryCount})...`);

    return await lastValueFrom(
      this.http.post(`${FAAS_HOST_BASE_URL}:${functionPort}`, { args })
        .pipe(
          map(response => response.data),
        )
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Error while performing HTTP request for server function (id: ${id}): ${(error.response?.data as any)?.message || error}`);
            throw error;
          }),
        ),
    );
  }

  private getFunctionPath(id: string): string {
    return `${BASE_FOLDER}/function-${id}`;
  }

  private async preparePolyLib(functionPath: string, apiKey: string) {
    await exec(`npm install --prefix ${functionPath} polyapi`);
    fs.mkdirSync(`${functionPath}/node_modules/.poly`);
    await exec(`POLY_API_BASE_URL=${this.config.hostUrl} POLY_API_KEY=${apiKey} npx --prefix ${functionPath} poly generate`);
  };

  private async run(id: string) {
    const functionPath = this.getFunctionPath(id);
    await exec(
      `${KNATIVE_EXEC_FILE} build --registry ${REGISTRY}`,
      { cwd: functionPath },
    );

    spawn(`${KNATIVE_EXEC_FILE}`, ['run', '--build=false'], {
      cwd: functionPath,
      stdio: ['ignore', process.stdout, process.stderr],
      detached: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));
  };

  private async cleanUpFunction(id: string, functionPath: string) {
    fs.rmSync(functionPath, { recursive: true });
    try {
      await exec(`${KNATIVE_EXEC_FILE} delete ${id}`);
    } catch (e) {
      // ignore
    }
    try {
      await exec(`docker stop $(docker ps -q --filter ancestor=${REGISTRY}/${id}:latest)`);
    } catch (e) {
      // ignore
    }
  }

  private getRunningPort(functionPath: string): number | null {
    const runningInstanceFile = fs.readdirSync(`${functionPath}/.func/instances`).pop();
    return !runningInstanceFile ? null : Number(runningInstanceFile);
  }
}
