export type ExecuteApiFunctionDto = Record<string, any>;

export interface ApiFunctionResponseDto {
  status: number;
  data: any;
  headers: Record<string, string>;
}
