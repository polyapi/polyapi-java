export class ConfigVariableDto {
  name: string;
  value: string;
  tenantId: string | null;
  environmentId: string | null;
}
