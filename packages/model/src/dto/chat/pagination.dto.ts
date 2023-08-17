import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsNumberString, IsOptional, IsString } from 'class-validator';

export class Pagination {
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    firstMessageDate: Date;
    @IsOptional()
    @IsNumberString()
    perPage: string;
    @IsString()
    @IsOptional()
    workspaceFolder: string;
}
