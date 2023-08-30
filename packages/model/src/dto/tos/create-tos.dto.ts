import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTosDto {
    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsNotEmpty()
    version: string;
}
