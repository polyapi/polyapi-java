import { IsBoolean, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { IsOnlyOneOfDefined } from '../validators';
import { TriggerDestination, TriggerSource } from './trigger.dto';

export class CreateTriggerDto {
  @Matches(/^([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9]$/, {
    message: 'Name must be an empty string or consist of alphanumeric characters, \'-\', \'_\' or \'.\', and must start and end with an alphanumeric character',
  })
  @IsOptional()
  name?: string;

  @IsNotEmpty()
  @IsOnlyOneOfDefined(['webhookHandleId'])
  source: TriggerSource;

  @IsNotEmpty()
  @IsOnlyOneOfDefined(['serverFunctionId'])
  destination: TriggerDestination;

  @IsOptional()
  @IsBoolean()
  waitForResponse?: boolean;
}
