import { IsOptional } from 'class-validator';

export type ExecuteCustomFunctionDto = Record<string, any>;

export class ExecuteCustomFunctionQueryParams {
  @IsOptional()
  clientId?: string;
}
