import { FunctionsExecutionType, JobExecutionStatus } from '../../job';
import { Schedule } from './job.dto';

export type ExecutionDto = {
    id: string;
    jobId: string;
    results: { id: string, statusCode?: number, fatalError: boolean }[]
    processedOn: Date | null;
    finishedOn: Date | null;
    duration: number | null;
    functions: { id: string; headersPayload: object; eventPayload: object; paramsPayload: object}[]
    type: FunctionsExecutionType
    status: JobExecutionStatus
    schedule: Schedule
}
