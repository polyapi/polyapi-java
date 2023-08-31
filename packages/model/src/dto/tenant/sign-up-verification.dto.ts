import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SignUpVerificationDto {
    @IsString()
    @IsNotEmpty()
    code: string;

    @IsEmail()
    email: string;
}
