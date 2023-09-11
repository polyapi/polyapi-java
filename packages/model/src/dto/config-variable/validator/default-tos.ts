import { IsString } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { validateObjectValue } from '../../utils';

export class DefaultTosValue {
  @IsString()
  id: string;
}

export const validate = (value: unknown) => {
  const validationClass: any = plainToClass(DefaultTosValue, value);

  validateObjectValue(validationClass, value);
};
