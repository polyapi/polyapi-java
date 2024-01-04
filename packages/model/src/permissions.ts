export enum Permission {
  Execute = 'execute',
  LibraryGenerate = 'libraryGenerate',
  CustomDev = 'customDev',
  AuthConfig = 'authConfig',
  ManageApiFunctions = 'manageApiFunctions',
  ManageWebhooks = 'manageWebhooks',
  ManageNonSecretVariables = 'manageVariables',
  ManageSecretVariables = 'manageSecretVariables',
  ManageTriggers = 'manageTriggers',
  ManageJobs = 'manageJobs',
}

export type Permissions = {
  [Permission.Execute]?: boolean;
  [Permission.LibraryGenerate]?: boolean;
  [Permission.CustomDev]?: boolean;
  [Permission.AuthConfig]?: boolean;
  [Permission.ManageApiFunctions]?: boolean;
  [Permission.ManageWebhooks]?: boolean;
  [Permission.ManageNonSecretVariables]?: boolean;
  [Permission.ManageSecretVariables]?: boolean;
  [Permission.ManageTriggers]?: boolean;
  [Permission.ManageJobs]?: boolean;
}
