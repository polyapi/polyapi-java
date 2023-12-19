export class TriggerResponseDto {
  executionId: string;
  data: unknown;
  statusCode: number;
  functionId?: string;
  environmentId?: string;
}
