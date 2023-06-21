export class ConfigVariableDto {
  name: string;
  value: unknown;
  tenantId: string | null;
  environmentId: string | null;
}
