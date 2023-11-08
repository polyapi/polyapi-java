import { IsNumber } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { validateObjectValue } from '../../utils';

export class Jobs {
  @IsNumber()
  minimumIntervalTimeBetweenExecutions: number;
}

export const validate = (value: unknown) => {
  const validationClass: any = plainToClass(Jobs, value);

  validateObjectValue(validationClass, value);
};
