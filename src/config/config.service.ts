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

  get postmanScriptVersion(): string {
    return '0.1.0';
  }

  get postmanTrainingAssistantScriptVersion(): string {
    return '0.1.0';
  }

  get faasPolyServerUrl(): string {
    return this.get('FAAS_POLY_SERVER_URL', this.hostUrl);
  }

  get faasPolyServerLogsUrl(): string {
    return this.get('FAAS_POLY_SERVER_LOGS_URL');
  }

  get faasDockerContainerRegistry(): string {
    return this.get('FAAS_DOCKER_CONTAINER_REGISTRY', 'ghcr.io/polyapi/poly-alpha');
  }

  get faasDockerImageFunctionNode(): string {
    return this.get('FAAS_DOCKER_IMAGE_FUNCTION_NODE');
  }

  get faasDockerImageFunctionJava(): string {
    return this.get('FAAS_DOCKER_IMAGE_FUNCTION_JAVA');
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

  get faasFunctionsBasePath(): string {
    return this.get(
      'FAAS_FUNCTIONS_BASE_PATH',
      process.env.FUNCTIONS_BASE_FOLDER || `${process.cwd()}/server-functions`,
    );
  }

  get faasNamespace(): string {
    return this.get('FAAS_NAMESPACE', 'default');
  }

  get faasPvcName(): string {
    return this.get('FAAS_PVC_NAME', 'poly-functions');
  }

  get faasPreinstalledNpmPackages(): string[] {
    return this.get('FAAS_PREINSTALLED_NPM_PACKAGES', '').split(',');
  }

  get faasDefaultSleepSeconds(): number {
    return Number(this.get('FAAS_DEFAULT_SLEEP_SECONDS', 30));
  }

  get vaultAddress(): string {
    return this.get('VAULT_ADDRESS');
  }

  get vaultToken(): string {
    return this.get('VAULT_TOKEN');
  }

  get redisUrl(): string {
    const url = this.get('REDIS_URL');
    if (url) {
      return `redis://${url}:6379`;
    } else {
      return 'redis://127.0.0.1:6379';
    }
  }

  get redisPassword(): string {
    return this.get('REDIS_PASSWORD', '');
  }

  get redisUsername(): string {
    return this.get('REDIS_USER');
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

  get knativeTriggerResponseUrl(): string {
    return this.get('KNATIVE_TRIGGER_RESPONSE_URL', `${this.hostUrl}/triggers/response`);
  }

  get knativeTriggerResponseTimeoutSeconds(): number {
    return Number(this.get('KNATIVE_TRIGGER_RESPONSE_TIMEOUT_SECONDS', 30));
  }

  get statisticsFunctionCallsRetentionDays(): number {
    return Number(this.get('STATISTICS_FUNCTION_CALLS_RETENTION_DAYS', 7));
  }

  get mailchimpApikey(): string {
    return this.get('MAILCHIMP_API_KEY', '');
  }

  get signUpEmail(): string {
    return this.get('SIGN_UP_EMAIL', 'signup@polyapi.io');
  }

  get signUpTenantInformationTemplateName(): string {
    return this.get('SIGN_UP_TENANT_INFORMATION_TEMPLATE_NAME', 'sign-up-new-tenant-info');
  }

  get sendSignUpVerificationCodeTemplateName(): string {
    return this.get('SIGN_UP_VERIFICATION_CODE_TEMPLATE_NAME', 'sign-up-verification-code');
  }

  get prebuiltBaseNodeImageName(): string {
    return this.get('PREBUILT_BASE_NODE_IMAGE_NAME', 'prebuiltBaseImage');
  }

  get prebuiltBaseJavaImageName(): string {
    return this.get('PREBUILT_BASE_JAVA_IMAGE_NAME', 'java');
  }

  get swaggerStatsUsername(): string {
    return this.get('SWAGGER_STATS_USERNAME', 'poly');
  }

  get swaggerStatsPassword(): string {
    return this.get('SWAGGER_STATS_PASSWORD', 'PolyIsAwesome');
  }

  get apiKeyHashPepper(): string {
    return this.get('API_KEY_HASH_PEPPER', '');
  }
}
