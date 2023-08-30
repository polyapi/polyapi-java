import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { validateObjectValue } from '../../utils';

export class PublicVisibilityValue {
  @IsOptional()
  @IsBoolean()
  defaultHidden?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleContexts?: string[];
}

export const validate = (value: unknown) => {
  const validationClass: any = plainToClass(PublicVisibilityValue, value);

  validateObjectValue(validationClass, value);
};
