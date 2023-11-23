import { HttpException, HttpStatus, InternalServerErrorException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from 'config/config.service';
import { catchError, lastValueFrom, map } from 'rxjs';
import { getDateMinusXHours, getNanosecondsFromDate } from '@poly/common/utils';
import { FunctionLog } from '@poly/model';
import { FaasLogsService } from '../faas.service';

type LokiResultValue = [timestamp: string, logText: string];

interface LokiResult {
  stream: {
    //
  },
  values: LokiResultValue[],
}

type LokiData = {
  resultType: 'streams';
  result: LokiResult[];
}

export class LokiLogsService implements FaasLogsService {
  private readonly logger: Logger = new Logger(LokiLogsService.name);

  constructor(private readonly config: ConfigService, private readonly httpService: HttpService) {}

  async getLogs(functionId: string, keyword = ''): Promise<FunctionLog[]> {
    this.logger.debug(`Getting logs for function with id ${functionId}`);
    const logQuery = this.constructQuery(functionId, keyword);
    const dateMinus24hs = getDateMinusXHours(new Date(), 24);
    const url = `${this.config.faasPolyServerLogsUrl}/loki/api/v1/query_range?query=${encodeURIComponent(logQuery)}&start=${getNanosecondsFromDate(dateMinus24hs)}`;
    this.logger.debug(`Sending request to ${url}`);
    return await lastValueFrom(
      this.httpService
        .get(url)
        .pipe(
          map((response) => response.data as {status: string; data: LokiData}),
          map(({ status, data }) => {
            if (status !== 'success') {
              throw new InternalServerErrorException(`Fetching data from the Faas logger service returned a status of ${status}`);
            }
            return data;
          }),
          map((lokiData) => this.toFunctionLogs(lokiData)),
          map((logs) => this.sortLogsByNewestFirst(logs)),
          catchError(this.processLogsRetrievalError()),
        ),
    );
  }

  private processLogsRetrievalError() {
    return (error: any) => {
      this.logger.error(`Error while processing data from the FaaS logger service: ${error}`);
      throw new HttpException(
        error.response?.data || error.message,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    };
  }

  private toFunctionLogs(lokiData: LokiData): FunctionLog[] {
    const logValues = lokiData.result.flatMap(({ values }) => values);

    return logValues
      .map(([timestamp, logText]) => {
        const [value, level] = this.getLogContentAndLevel(logText);

        return ({
          timestamp,
          value,
          level,
        });
      })
      .filter(({ level }) => level !== 'UNKNOWN');
  }

  private sortLogsByNewestFirst(logs: FunctionLog[]): FunctionLog[] {
    /*
      We do not include the sort direction in the query request to Loki because Loki
      does a sorting of values within each of the stream groups
      and we need to sort once all values have been aggregated
    */
    return logs.sort(
      (a, b) => b.timestamp.localeCompare(a.timestamp),
    );
  }

  private constructQuery(functionId: string, keyword: string): string {
    const getKeywordQuery = (keyword: string) => `|~ "(?i)${keyword}"`;
    const textContentQuery = keyword
      ? ` ${getKeywordQuery(keyword)}`
      : '';
    return `{pod=~"function-${functionId}.*",container="user-container"}${textContentQuery}`;
  }

  private getLogContentAndLevel(rawLogText: string): [logContent: string, logLevel: string] {
    const polyLogPattern = /\[(ERROR|LOG|INFO|WARN)](.*?)\[\/\1]/gs;
    const timestampStdPipePattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z (stdout|stderr) F /g;

    const [, level, logText] = polyLogPattern.exec(rawLogText) || [null, 'UNKNOWN', rawLogText];
    const lines = logText.trim().split('\n');

    return [
      lines
        .map(line => line.replace(timestampStdPipePattern, ''))
        .join('\n'),
      level,
    ];
  }
}
