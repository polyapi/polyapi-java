export enum Permission {
  Use = 'use',
  Teach = 'teach',
  CustomDev = 'customDev',
  AuthConfig = 'authConfig',
  ManageNonSecretVariables = 'manageVariables',
  ManageSecretVariables = 'manageSecretVariables',
  ManageTriggers = 'manageTriggers',
}

export type Permissions = {
  [Permission.Use]?: boolean;
  [Permission.Teach]?: boolean;
  [Permission.CustomDev]?: boolean;
  [Permission.AuthConfig]?: boolean;
  [Permission.ManageNonSecretVariables]?: boolean;
  [Permission.ManageSecretVariables]?: boolean;
  [Permission.ManageTriggers]?: boolean;
}
