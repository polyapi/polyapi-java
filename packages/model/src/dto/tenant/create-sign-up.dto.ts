import { ApiModelProperty } from '@nestjs/swagger/dist/decorators/api-model-property.decorator';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateSignUpDto {
    @IsEmail()
    email: string;

    @ApiModelProperty({
      required: false,
    })
    @IsString()
    @IsOptional()
    tenantName?: string;
}
