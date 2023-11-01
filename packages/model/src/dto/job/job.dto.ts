import { FunctionsExecutionType, ScheduleType } from "../../job";
import { FunctionJob, Interval, OnTime, Periodical } from "./create-job.dto";

export type JobDto = {

    id: string;

    name: string;

    schedule: Periodical | OnTime | Interval;

    functions: FunctionJob[]

    functionsExecutionType: FunctionsExecutionType;
}