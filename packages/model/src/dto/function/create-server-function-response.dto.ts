import { FunctionDetailsDto } from './function.dto';

export type CreateServerFunctionResponseDto = FunctionDetailsDto & {
  status: 'deployed' | 'deploying';
  message?: string;
}
