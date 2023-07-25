import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsNumberString, IsOptional } from 'class-validator';

export class Pagination {
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    lastMessageDate: Date;
    @IsOptional()
    @IsNumberString()
    perPage: string;
}
