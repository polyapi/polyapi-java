import { IsEnum, IsOptional, IsString } from "class-validator";
import { FunctionsExecutionType, JobExecutionStatus } from "../../job";

export class ExecutionFiltersDto {

    @IsOptional()
    @IsEnum(JobExecutionStatus)
    status?: JobExecutionStatus;
}