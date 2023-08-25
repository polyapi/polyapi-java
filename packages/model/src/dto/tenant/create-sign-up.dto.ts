import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateSignUpDto {
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email: string;
    @IsString()
    @IsOptional()
    @IsNotEmpty()
    tenantName?: string;
}