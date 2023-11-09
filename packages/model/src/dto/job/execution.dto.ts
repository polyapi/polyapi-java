import { FunctionsExecutionType, JobExecutionStatus } from '../../job';

export type ExecutionDto = {
    id: string;
    createdAt: Date;
    jobId: string;
    results: { id: string, statusCode?: number, fatalError: boolean }[]
    processedOn: number | null;
    duration: number | null;
    functions: { id: string; headersPayload: object; eventPayload: object; paramsPayload: object}[]
    type: FunctionsExecutionType
    status: JobExecutionStatus
}
