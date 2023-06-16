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
