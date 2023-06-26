import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from 'config/config.service';
import { SecretServiceProvider } from 'secret/provider/secret-service-provider';
import { VaultSecretServiceProvider } from 'secret/provider/vault/vault-secret-service-provider';
import { Environment } from '@prisma/client';

@Injectable()
export class SecretService {
  private readonly logger = new Logger(SecretService.name);
  private readonly secretServiceProvider: SecretServiceProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.secretServiceProvider = new VaultSecretServiceProvider(config, httpService);
  }

  async initForEnvironment(environment: Environment) {
    await this.secretServiceProvider.init(environment);
  }

  async get(environmentId: string, key: string): Promise<any> {
    this.logger.debug(`Getting secret ${key} for environment ${environmentId}`);
    return await this.secretServiceProvider.get(environmentId, key);
  }

  async set(environmentId: string, key: string, value: any): Promise<void> {
    this.logger.debug(`Setting secret ${key} for environment ${environmentId}`);
    await this.secretServiceProvider.set(environmentId, key, value);
  }

  async delete(environmentId: string, key: string) {
    this.logger.debug(`Deleting secret ${key} for environment ${environmentId}`);
    await this.secretServiceProvider.delete(environmentId, key);
  }

  async deleteAllForEnvironment(environmentId: string) {
    await this.secretServiceProvider.deleteAll(environmentId);
  }
}
