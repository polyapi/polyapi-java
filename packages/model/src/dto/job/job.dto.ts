import { JobExecutionType, JobType } from "../../job";
import { FunctionJob } from "./create-job.dto";

export type JobDto = {

    id: string;

    name: string;

    type: JobType

    value: string | number | Date;

    functions: FunctionJob[]

    executionType: JobExecutionType;
}