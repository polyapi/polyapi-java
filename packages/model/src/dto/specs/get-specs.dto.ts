import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetSpecsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  @Transform(({ value }) => Array.isArray(value) ? value : value.split(','))
  contexts?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  @Transform(({ value }) => Array.isArray(value) ? value : value.split(','))
  names?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  @Transform(({ value }) => Array.isArray(value) ? value : value.split(','))
  ids?: string[];
}
