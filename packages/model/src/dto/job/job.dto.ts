import { FunctionsExecutionType, JobStatus, ScheduleType } from "../../job";
import { FunctionJob } from "./create-job.dto";


export type Periodical = {
    type: ScheduleType.PERIODICAL;
    value: string;
}

export type OnTime = {
    type: ScheduleType.ON_TIME;
    value: Date;
}

export type Interval = {
    type: ScheduleType.INTERVAL;
    value: number;
}

export type Schedule = Periodical | OnTime | Interval;

export type JobDto = {

    id: string;

    name: string;

    schedule: Schedule;

    functions: FunctionJob[]

    functionsExecutionType: FunctionsExecutionType;

    nextExecutionAt: Date;

    environmentId: string;

    status: JobStatus;
}