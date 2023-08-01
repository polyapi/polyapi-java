import dotenv from 'dotenv';
import fs from 'fs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  private readonly envConfig: { [key: string]: string };

  constructor(filePath: string) {
    let dotenvConfig;
    if (fs.existsSync(filePath)) {
      dotenvConfig = dotenv.parse(fs.readFileSync(filePath));
    } else {
      console.warn(`Configuration file ${filePath} does not exists. Using default values (not recommended).`);
      dotenvConfig = {};
    }

    this.envConfig = {
      ...process.env,
      ...dotenvConfig,
    };
  }

  get(key: string, defaultValue?: any): string {
    const value = this.envConfig[key];
    if (value?.startsWith('file://')) {
      const fileName = value.substring(7);
      if (fs.existsSync(fileName)) {
        return fs.readFileSync(fileName, 'utf8').trim();
      }
    }
    return value !== undefined ? value : defaultValue;
  }

  get hostUrl(): string {
    return this.get('HOST_URL') || 'http://localhost:8000';
  }

  get env(): string {
    const host = this.get('HOST_URL');
    if (!host) {
      return 'local';
    }
    // HACK todo add production?
    if (host.includes('develop')) {
      return 'develop';
    } else if (host.includes('staging')) {
      return 'staging';
    } else {
      return 'local';
    }
  }

  get port(): number {
    return Number(this.get('PORT', 8000));
  }

  get useSwaggerUI(): boolean {
    return Boolean(this.get('USE_SWAGGER_UI'));
  }

  get logLevel(): string {
    return this.get('LOG_LEVEL', 'info');
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  get scienceServerBaseUrl(): string {
    return this.get('SCIENCE_SERVER_BASE_URL');
  }

  get polyTenantName(): string {
    return this.get('POLY_TENANT_NAME') || 'poly-system';
  }

  get polySuperAdminUserKey(): string {
    return this.get('POLY_SUPER_ADMIN_USER_KEY');
  }

  get polyAdminsTeamName(): string {
    return this.get('POLY_ADMINS_TEAM_NAME') || 'Admins';
  }

  get polyAdminUserName(): string {
    return this.get('POLY_ADMIN_USER_NAME') || 'Super Admin';
  }

  get functionArgsParameterLimit(): number {
    return Number(this.get('FUNCTION_ARGS_PARAMETER_LIMIT', 5));
  }

  get polyClientNpmVersion(): string {
    return this.get('POLY_CLIENT_NPM_VERSION', 'latest');
  }

  get faasPolyServerUrl(): string {
    return this.get('FAAS_POLY_SERVER_URL', this.hostUrl);
  }

  get faasDockerContainerRegistry(): string {
    return this.get('FAAS_DOCKER_CONTAINER_REGISTRY', 'ghcr.io/polyapi/poly-alpha');
  }

  get faasDockerUsername(): string {
    return this.get('FAAS_DOCKER_USERNAME');
  }

  get faasDockerPassword(): string {
    return this.get('FAAS_DOCKER_PASSWORD');
  }

  get faasDockerConfigFile(): string {
    return this.get('FAAS_DOCKER_CONFIG_FILE', `${process.env.HOME}/.docker/config.json`);
  }

  get vaultAddress(): string {
    return this.get('VAULT_ADDRESS');
  }

  get vaultToken(): string {
    return this.get('VAULT_TOKEN');
  }

  get redisUrl(): string {
    return this.get('REDIS_URL') || 'redis://127.0.0.1:6379';
  }

  get cacheTTL(): number {
    return Number(this.get('CACHE_TTL', 24 * 60 * 60));
  }

  get knativeFuncExecFile(): string {
    return this.get('KNATIVE_EXEC_FILE', `${process.cwd()}/bin/kn-func`);
  }

  get knativeBrokerName(): string {
    return this.get('KNATIVE_BROKER_NAME', 'default');
  }

  get knativeBrokerUrl(): string {
    return this.get('KNATIVE_BROKER_URL');
  }

  get knativeTriggerNamespace(): string {
    return this.get('KNATIVE_TRIGGER_NAMESPACE', 'default');
  }
}
