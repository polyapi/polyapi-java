import { IsString } from 'class-validator';

export class StoreMessageDto {
    @IsString()
    message: string;
};
