import { FunctionsExecutionType } from '../../job';

export type ExecutionDto = {
    id: string;
    createdAt: Date;
    jobId: string;
    results: { id: string, statusCode?: number, fatalError: boolean }[]
    duration: number;
    functions: { id: string; headersPayload: object; eventPayload: object; paramsPayload: object}[]
    type: FunctionsExecutionType
}
