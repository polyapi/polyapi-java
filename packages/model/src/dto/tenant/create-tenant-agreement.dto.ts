import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import { Transform, Type } from "class-transformer";
import { IsDate, IsDateString, IsEmail, IsOptional, IsString } from "class-validator";

export class CreateTenantAgreement {

    @IsString()
    tosId: string;

    @ApiModelProperty({
        required: false
    })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiModelProperty({
        required: false,
        description: "If not provided, is generated automatically."
    })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    agreedAt?: Date;
}