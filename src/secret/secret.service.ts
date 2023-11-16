import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Environment } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from 'config/config.service';
import { SecretServiceProvider } from 'secret/provider/secret-service-provider';
import { VaultSecretServiceProvider } from 'secret/provider/vault/vault-secret-service-provider';

@Injectable()
export class SecretService {
  private readonly logger = new Logger(SecretService.name);
  private readonly secretServiceProvider: SecretServiceProvider;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.secretServiceProvider = new VaultSecretServiceProvider(config, httpService);
  }

  async initForEnvironment(environment: Environment) {
    await this.secretServiceProvider.init(environment);
  }

  async get<T>(environmentId: string, key: string): Promise<T | null> {
    this.logger.debug(`Getting secret ${key} for environment ${environmentId}`);
    const cacheKey = this.getCacheKey(environmentId, key);
    const cachedValue = await this.cacheManager.get<T>(cacheKey);
    if (cachedValue) {
      return cachedValue;
    }

    const value = await this.secretServiceProvider.get(environmentId, key);
    if (value != null) {
      await this.cacheManager.set(cacheKey, value);
    }
    return value ?? null;
  }

  async set(environmentId: string, key: string, value: any): Promise<void> {
    this.logger.debug(`Setting secret ${key} for environment ${environmentId}`);
    await this.secretServiceProvider.set(environmentId, key, value);
    if (value != null) {
      await this.cacheManager.set(this.getCacheKey(environmentId, key), value);
    }
  }

  async delete(environmentId: string, key: string) {
    this.logger.debug(`Deleting secret ${key} for environment ${environmentId}`);
    await this.secretServiceProvider.delete(environmentId, key);
    await this.cacheManager.del(this.getCacheKey(environmentId, key));
  }

  async deleteAllForEnvironment(environmentId: string) {
    this.logger.debug(`Deleting all secrets for environment ${environmentId}`);
    await this.secretServiceProvider.deleteAll(environmentId);
    // TODO: we might want to change in the future to delete only the keys for the environment
    // for now we just reset the whole cache for simplicity as we don't use cache for anything else
    await this.cacheManager.reset();
  }

  private getCacheKey(environmentId: string, key: string) {
    return `secret:${environmentId}:${key}`;
  }
}
