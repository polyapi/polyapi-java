import { IsOptional } from 'class-validator';

export type ExecuteApiFunctionDto = Record<string, any>;

export class ExecuteApiFunctionQueryParams {
  @IsOptional()
  clientId?: string;
}

export interface ApiFunctionResponseDto {
  status: number;
  data: any;
  headers: Record<string, string>;
}
