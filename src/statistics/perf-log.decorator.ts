import { SetMetadata } from '@nestjs/common';
import { PerfLogType } from './perf-log-type';

export const PERF_LOG_KEY = 'perfLog';

export const PerfLog = (type: PerfLogType) => SetMetadata(PERF_LOG_KEY, type);
