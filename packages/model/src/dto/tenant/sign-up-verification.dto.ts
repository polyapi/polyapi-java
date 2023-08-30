import { IsNotEmpty, IsString } from 'class-validator';

export class SignUpVerificationDto {
    @IsString()
    @IsNotEmpty()
    code: string;
}
