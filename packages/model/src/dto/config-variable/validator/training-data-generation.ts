import { IsOptional, IsBoolean, validateSync } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { isPlainObjectPredicate } from './utils';

export class SetTrainingDataGenerationValue {
    @IsOptional()
    @IsBoolean()
    webhooks: boolean | null
    @IsOptional()
    @IsBoolean()
    clientFunctions: boolean | null
    @IsOptional()
    @IsBoolean()
    serverFunctions: boolean | null
    @IsOptional()
    @IsBoolean()
    apiFunctions: boolean | null
}

export function validate(value: unknown){
    if(!isPlainObjectPredicate(value)) {
        throw new BadRequestException(['value must be an object']);
    }

      const ValidationClass = plainToClass(SetTrainingDataGenerationValue, value);

      const errors = validateSync(ValidationClass, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });


      const flattenErrors = errors.map(error => {
        return Object.values(error.constraints || {})
      }).flat();

      if(flattenErrors.length) {
        throw new BadRequestException(flattenErrors);
      }
}