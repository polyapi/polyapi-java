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

  get polyTenantAppKey(): string {
    return this.get('POLY_TENANT_APP_KEY');
  }

  get polyTenantName(): string {
    return this.get('POLY_TENANT_NAME') || 'poly';
  }

  get polySuperAdminUserKey(): string {
    return this.get('POLY_SUPER_ADMIN_USER_KEY');
  }

  get polyAdminsTeamName(): string {
    return this.get('POLY_ADMINS_TEAM_NAME') || 'Admins';
  }

  get polyAdminUserName(): string {
    return this.get('POLY_ADMIN_USER_NAME') || 'poly';
  }

  get functionArgsParameterLimit(): number {
    return Number(this.get('FUNCTION_ARGS_PARAMETER_LIMIT', 5));
  }

  get polyClientNpmVersion(): string {
    return this.get('POLY_CLIENT_NPM_VERSION', 'latest');
  }
}
