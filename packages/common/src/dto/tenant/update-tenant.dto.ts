import { IsNotEmpty } from 'class-validator';

export class UpdateTenantDto {
  @IsNotEmpty()
  name: string;
}
