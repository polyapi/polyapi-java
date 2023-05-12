export enum Permission {
  Use = 'use',
  Teach = 'teach',
  CustomDev = 'customDev',
  AuthConfig = 'authConfig',
}

export type Permissions = {
  [key in Permission]?: boolean;
}
