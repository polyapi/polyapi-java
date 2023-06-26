import { HttpService } from '@nestjs/axios';
import { SecretServiceProvider } from 'secret/provider/secret-service-provider';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from 'config/config.service';
import { catchError, lastValueFrom, map } from 'rxjs';
import { Environment } from '@prisma/client';

export class VaultSecretServiceProvider implements SecretServiceProvider {
  private readonly logger = new Logger(VaultSecretServiceProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {
  }

  async init(environment: Environment) {
    if (!this.config.vaultAddress) {
      this.logger.debug(`Vault address not configured, skipping secret service initialization for environment ${environment.id}`);
      return;
    }

    await lastValueFrom(
      this.httpService
        .get(
          `${this.config.vaultAddress}/v1/sys/mounts/${environment.id}`,
          {
            headers: {
              'X-Vault-Token': this.config.vaultToken,
            },
          },
        )
        .pipe(catchError(error => {
          if (error.response?.status === HttpStatus.BAD_REQUEST) {
            return this.createMount(environment);
          }

          throw error;
        })),
    );
  }

  async get(environmentId: string, key: string): Promise<any> {
    const path = `${key}`;

    this.logger.debug(`Getting secret at Vault path: ${path}`);

    return await lastValueFrom(
      this.httpService
        .get(`${this.config.vaultAddress}/v1/${environmentId}/data/${path}`, {
          headers: {
            'X-Vault-Token': this.config.vaultToken,
          },
        })
        .pipe(
          map((response) => response.data.data.data.value),
        )
        .pipe(catchError(this.processVaultRequestError())),
    );
  }

  async set(environmentId: string, key: string, value: any): Promise<void> {
    const path = `${key}`;

    this.logger.debug(`Setting secret at Vault path: ${path}`);

    await lastValueFrom(
      this.httpService
        .post(
          `${this.config.vaultAddress}/v1/${environmentId}/data/${path}`,
          { data: { value } },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Vault-Token': this.config.vaultToken,
            },
          },
        )
        .pipe(catchError(this.processVaultRequestError())),
    );
  }

  async delete(environmentId: string, key: string): Promise<void> {
    const path = `${key}`;

    this.logger.debug(`Deleting secret at Vault path: ${path}`);

    await lastValueFrom(
      this.httpService
        .delete(`${this.config.vaultAddress}/v1/${environmentId}/data/${path}`, {
          headers: {
            'X-Vault-Token': this.config.vaultToken,
          },
        })
        .pipe(catchError(this.processVaultRequestError())),
    );
  }

  async deleteAll(environmentId: string): Promise<void> {
    this.logger.debug(`Deleting all secrets for environment ${environmentId}`);

    await lastValueFrom(
      this.httpService
        .delete(
          `${this.config.vaultAddress}/v1/sys/mounts/${environmentId}`,
          {
            headers: {
              'X-Vault-Token': this.config.vaultToken,
            },
          },
        )
        .pipe(catchError(this.processVaultRequestError())),
    );
  }

  private async createMount(environment: Environment) {
    this.logger.debug(`Creating Vault mount for environment ${environment.id}`);

    return lastValueFrom(
      this.httpService
        .post(
          `${this.config.vaultAddress}/v1/sys/mounts/${environment.id}`,
          {
            type: 'kv-v2',
          },
          {
            headers: {
              'X-Vault-Token': this.config.vaultToken,
            },
          },
        )
        .pipe(catchError(this.processVaultRequestError())),
    );
  }

  private processVaultRequestError() {
    return (error) => {
      this.logger.error(`Error while communicating with Vault service: ${error.message}`);
      throw new HttpException(error.response?.data || error.message, error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    };
  }
}
