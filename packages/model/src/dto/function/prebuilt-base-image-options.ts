import { IsOptional, IsString } from 'class-validator';

export class PrebuiltBaseImageOptions {
  @IsString()
  @IsOptional()
  language?: string;
}
