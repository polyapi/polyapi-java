/* eslint-disable */
import { TestingModule, Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { configServiceMock, httpServiceMock } from '../../mocks';
import { ConfigService } from 'config/config.service';
import { LokiLogsService } from 'function/faas/loki-logs/loki-logs.service';
import { LOKI_MOCK_RESPONSE } from './loki-mock-data';
import { EXPECTED_DATA } from './expected-data';

describe('LokiLogsService', () => {
  let service: LokiLogsService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        {
          // Beware, LokiLogsService is not an injectable
          provide: LokiLogsService,
          useValue: new LokiLogsService(
            configServiceMock as unknown as ConfigService,
            httpServiceMock as unknown as HttpService,
          ),
        },
      ],
    }).compile();
    service = moduleRef.get<LokiLogsService>(LokiLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLogs', () => {
    let httpGetSpy: jest.SpyInstance;
    const lokiUrl = 'https://loki-service.com';
    const functionId = 'foo-bar-baz';
    const testKeyword = 'unicorns';
    beforeEach(() => {
      jest.resetAllMocks();
      configServiceMock['faasPolyServerLogsUrl'] = lokiUrl;
      httpServiceMock.get?.mockImplementation(() =>
        of({
          data: LOKI_MOCK_RESPONSE,
          status: 200,
          statusText: 'OK',
          headers: {},
        } as AxiosResponse),
      );
      httpGetSpy = jest.spyOn(httpServiceMock, 'get');
    });
    it('should return the logs data in the expected format', async () => {
      const result = await service.getLogs('id', '');
      expect(result).toEqual(EXPECTED_DATA);
    });
    it('should make the request to Loki with the included keyword', async () => {
      await service.getLogs(functionId, testKeyword);
      expect(httpGetSpy).toHaveBeenCalledTimes(1);
      const expectedLokiQuery = encodeURIComponent(
        `{pod=~"function-${functionId}.*",container="user-container"} |~ "(?i)${testKeyword}"`,
      );
      const expectedUrl = `${lokiUrl}/loki/api/v1/query_range?query=${expectedLokiQuery}`;
      expect(httpGetSpy).toHaveBeenCalledWith(expect.stringContaining(expectedUrl));
    });
    it('should make the request to Loki without a keyword', async () => {
      await service.getLogs(functionId, '');
      expect(httpGetSpy).toHaveBeenCalledTimes(1);
      const expectedLokiQuery = encodeURIComponent(
        `{pod=~"function-${functionId}.*",container="user-container"}`,
      );
      const expectedUrl = `${lokiUrl}/loki/api/v1/query_range?query=${expectedLokiQuery}`;
      expect(httpGetSpy).toHaveBeenCalledWith(expect.stringContaining(expectedUrl));
    });
  });

  describe('getLogContentAndLevel', () => {
    it('should return the log content and level from single line log item', () => {
      const logText = '2023-11-23T08:50:21.715779515Z stderr F [ERROR] error line [/ERROR]';
      // @ts-ignore
      const [value, level] = service.getLogContentAndLevel(logText);
      expect(value).toEqual('error line');
      expect(level).toEqual('ERROR');
    });

    it('should return the log content and level from multi line log item', () => {
      const logText = '2023-11-23T08:50:21.715783455Z stderr F [ERROR] error multiline\n2023-11-23T08:50:21.715786785Z stderr F line2\n2023-11-23T08:50:21.715790195Z stderr F line3 [/ERROR]';
      // @ts-ignore
      const [value, level] = service.getLogContentAndLevel(logText);
      expect(value).toEqual('error multiline\nline2\nline3');
      expect(level).toEqual('ERROR');
    });

    it('should return the log content and level from multi line log item keeping the empty spaces at beginning', () => {
      const logText = '2023-11-23T08:50:21.715783455Z stderr F [ERROR] error multiline\n2023-11-23T08:50:21.715786785Z stderr F     line2\n2023-11-23T08:50:21.715790195Z stderr F     line3 [/ERROR]';
      // @ts-ignore
      const [value, level] = service.getLogContentAndLevel(logText);
      expect(value).toEqual('error multiline\n    line2\n    line3');
      expect(level).toEqual('ERROR');
    });
  });
});
