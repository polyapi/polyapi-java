import { Logger, HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from 'config/config.service';
import { catchError, lastValueFrom, map } from 'rxjs';
import { getDateFromNanoseconds, getNanosecondsFromDate, getDateMinusXHours } from '@poly/common/utils';
import { FunctionLog } from '@poly/model';
import { FaasLogsService } from '../faas.service';

export class LokiLogsService implements FaasLogsService {
  private readonly logger: Logger = new Logger(LokiLogsService.name);

  constructor(private readonly config: ConfigService, private readonly httpService: HttpService) {}

  async getLogs(functionId: string, keyword: string): Promise<FunctionLog[]> {
    this.logger.debug(`Getting logs for function with id ${functionId}`);
    const logQuery = this.constructQuery(functionId, keyword);
    const dateMinus24hs = getDateMinusXHours(new Date(), 24);
    return await lastValueFrom(
      this.httpService
        .get(`${this.config.faasPolyServerLogsUrl}/loki/api/v1/query_range?query=${encodeURIComponent(logQuery)}&start=${getNanosecondsFromDate(dateMinus24hs)}`)
        .pipe(
          map((response) => response.data as {status: string; data: any}),
          map(({ status, data }) => {
            if (status !== 'success') {
              throw new InternalServerErrorException(`Fetching data from the Faas logger service returned a status of ${status}`);
            }
            return data;
          }),
          map((rawLogsData) => this.normalizeFaasLogs(rawLogsData)),
          map((normalizedLogs) => this.sortLogsByNewestFirst(normalizedLogs)),
          map((sortedLogs) => this.getUserFriendlyLogs(sortedLogs)),
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

  private normalizeFaasLogs(rawLogsData): FunctionLog[] {
    const logValues = rawLogsData.result.flatMap(({ values }) => values) as Array<[string, string]>;
    return logValues.map(([nanoSecondsTime, logText]) => ({
      timestamp: BigInt(nanoSecondsTime),
      value: this.getCleanLogContent(logText),
      level: logText.includes('stderr F') ? 'Error/Warning' : 'Info',
    }));
  }

  private sortLogsByNewestFirst(logs: FunctionLog[]): FunctionLog[] {
    /*
      We do not include the sort direction in the query request to Loki because Loki
      does a sorting of values within each of the stream groups
      and we need to sort once all values have been aggregated
    */
    return logs.sort(
      (a, b) => Number((b.timestamp as bigint) - (a.timestamp as bigint)),
    );
  }

  private getUserFriendlyLogs(logs: FunctionLog[]): FunctionLog[] {
    return logs.map(
      (logentry) => ({
        ...logentry,
        timestamp: getDateFromNanoseconds(logentry.timestamp as bigint),
      }));
  }

  private constructQuery(functionId: string, keyword: string): string {
    /*
      The lines below correspond to Grafana's LogQL query language
    */
    const excludeByRegexOperator = '!~';
    const excludeSystemLogsQuery = `${excludeByRegexOperator} "${this.getSystemLogsQueryRegex(functionId)}"`;
    const includeByRegexOperator = '|~';
    const makeCaseInsensitive = '(?i)';
    const getKeywordQuery = (keyword: string) => `${includeByRegexOperator} "${makeCaseInsensitive}${keyword}"`;
    const textContentQuery = keyword
      ? `${excludeSystemLogsQuery} ${getKeywordQuery(keyword)}`
      : `${excludeSystemLogsQuery}`;
    return `{pod=~"function-${functionId}.*",container="user-container"} ${textContentQuery}`;
  }

  private getSystemLogsQueryRegex(functionId: string): string {
    return `function-${functionId}-|Cached Poly library found|> http-handler@|> FUNC_LOG_LEVEL=info faas-js-runtime ./index.js|npm notice |Generating Poly functions|stderr F $|stdout F $|^$`;
  }

  private getCleanLogContent(logContent: string): string {
    const removeStreamInfo = (stream: 'stderr' | 'stdout') => {
      const [, cleanLogContent] = logContent.split(` ${stream} F `);
      return cleanLogContent;
    };
    if (logContent.includes('stderr F')) {
      return removeStreamInfo('stderr');
    }
    if (logContent.includes('stdout F')) {
      return removeStreamInfo('stdout');
    }
    return logContent;
  }
}
