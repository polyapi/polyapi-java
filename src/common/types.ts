import { Request } from 'express';
import { Application, Environment, Tenant, User } from '@prisma/client';
import { Permissions } from '@poly/model';

export interface AuthData {
  key: string;
  tenant: Tenant;
  environment: Environment;
  application: Application | null;
  user: User | null;
  permissions: Permissions;
}

export interface AuthRequest extends Request {
  user: AuthData;
}

export type WithEnvironment<T> = T & { environment: Environment };

export type WithTenant<T> = T & { environment: Environment & { tenant: Tenant } };

export type WithSecurityFunctions<T> = T & { customFunctions?: {
  customFunction: {
      id: string;
      environmentId: string;
  };
  message: string | null;
}[] };
