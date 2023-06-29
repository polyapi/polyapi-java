import { IsOptional } from 'class-validator';

export class DeleteAllFunctionsDto {
  @IsOptional()
  userId: string | undefined;

  @IsOptional()
  apiKey: string | undefined;
}
