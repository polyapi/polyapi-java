import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateTosDto { 
    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsNotEmpty()
    version: string;
}