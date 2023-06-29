export enum ConfigVariableLevel {
    Instance = 'Instance',
    Tenant = 'Tenant',
    Environment = 'Environment'
  }

export type ConfigVariableValueConstraints = Array<{ level: ConfigVariableLevel }>;
