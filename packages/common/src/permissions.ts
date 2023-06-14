export enum Permission {
  Use = 'use',
  Teach = 'teach',
  CustomDev = 'customDev',
  AuthConfig = 'authConfig',
}

export type Permissions = {
  [Permission.Use]?: boolean;
  [Permission.Teach]?: boolean;
  [Permission.CustomDev]?: boolean;
  [Permission.AuthConfig]?: boolean;
}
