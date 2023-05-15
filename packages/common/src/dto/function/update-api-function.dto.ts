import { ArgumentsMetadata } from '../../function';

export interface UpdateApiFunctionDto {
  name?: string;
  context?: string;
  description?: string;
  arguments?: ArgumentsMetadata;
  response?: any;
  payload?: string;
}
