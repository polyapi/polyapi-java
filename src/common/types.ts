import { Request } from 'express';
import { Environment, Tenant, User, UserKey } from '@prisma/client';

export interface AuthData {
  tenant: Tenant;
  environment: Environment;
  userKey?: UserKey | null;
  user?: User | null;
}

export interface AuthRequest extends Request {
  user: AuthData;
}
