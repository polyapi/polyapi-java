import { IsString, Validate } from 'class-validator';
import { ArgumentsMetadata } from '../../function';
import { NotContainDots } from '../validators';

export class UpdateApiFunctionDto {
  @IsString()
  @Validate(NotContainDots)
  name?: string;
  context?: string;
  description?: string;
  arguments?: ArgumentsMetadata;
  response?: any;
  payload?: string;
}
