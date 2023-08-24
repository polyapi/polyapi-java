import { IsString } from "class-validator";

export class SignUpVerificationDto {
    @IsString()
    code: string;
}