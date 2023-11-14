export enum ScheduleType {
    PERIODICAL = 'periodical',
    INTERVAL = 'interval',
    ON_TIME = 'on_time'
}

export enum FunctionsExecutionType {
    SEQUENTIAL = 'sequential',
    PARALLEL = 'parallel'
}

export enum JobStatus {
    ENABLED = 'enabled',
    DISABLED = 'disabled'
};

export enum JobExecutionStatus {
    FINISHED = 'finished',
    JOB_ERROR = 'job_error',
    WITH_CALL_ERROR = 'with_call_error'
};
