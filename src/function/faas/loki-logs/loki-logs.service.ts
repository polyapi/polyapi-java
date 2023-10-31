import { Logger, HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from 'config/config.service';
import { catchError, lastValueFrom, map } from 'rxjs';
import { getDateFromNanoseconds } from '@poly/common/utils';
import { FunctionLog } from '@poly/model';
import { FaasLogsService } from '../faas.service';

export class LokiLogsService implements FaasLogsService {
  private readonly logger: Logger = new Logger(LokiLogsService.name);

  constructor(private readonly config: ConfigService, private readonly httpService: HttpService) {}

  async getLogs(functionId: string, keyword: string): Promise<FunctionLog[]> {
    this.logger.debug(`Getting logs for function with id ${functionId}`);
    const logQuery = `{pod=~"function-${functionId}.*"}`;
    return await lastValueFrom(
      this.httpService
        .get(`${this.config.faasPolyServerLogsUrl}/loki/api/v1/query_range?query=${encodeURIComponent(logQuery)}`)
        .pipe(
          map((response) => response.data as {status: string; data: any}),
          map(({ status, data }) => {
            if (status !== 'success') {
              throw new InternalServerErrorException(`Fetching data from the Faas logger service returned a status of ${status}`);
            }
            return data;
          }),
          map((logsData) => this.normalizeFaasLogs(logsData)),
          map((normalizedLogs) => this.filterLogs(normalizedLogs, keyword)),
          catchError(this.processLogsRetrievalError()),
        ),
    );
  }

  private processLogsRetrievalError() {
    return (error) => {
      this.logger.error(`Error while processing data from the FaaS logger service: ${error}`);
      throw new HttpException(
        error.response?.data || error.message,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    };
  }

  private normalizeFaasLogs(logsData): FunctionLog[] {
    const logValues = logsData.result.flatMap((res) => res.values) as Array<[string, string]>;
    return logValues.map(([nanoSecondsTime, logText]) => ({
      timestamp: getDateFromNanoseconds(+nanoSecondsTime),
      value: logText,
    }));
  }

  private filterLogs(normalizedLogs: FunctionLog[], keyword: string) {
    return normalizedLogs.filter(logEntry => logEntry.value.includes(keyword));
  }
}
