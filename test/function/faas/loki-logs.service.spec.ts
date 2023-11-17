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
      const result = await service.getLogs('', '');
      expect(result).toEqual(EXPECTED_DATA);
    });
    it('should make the request to Loki with the included keyword', async () => {
      await service.getLogs(functionId, testKeyword);
      expect(httpGetSpy).toHaveBeenCalledTimes(1);
      const expectedLokiQuery = encodeURIComponent(
        `{pod=~"function-${functionId}.*",container="user-container"} !~ "${service['getSystemLogsQueryRegex'](functionId)}" |~ "(?i)${testKeyword}"`,
      );
      const expectedUrl = `${lokiUrl}/loki/api/v1/query_range?query=${expectedLokiQuery}`;
      expect(httpGetSpy).toHaveBeenCalledWith(expect.stringContaining(expectedUrl));
    });
    it('should make the request to Loki without a keyword', async () => {
      await service.getLogs(functionId, '');
      expect(httpGetSpy).toHaveBeenCalledTimes(1);
      const expectedLokiQuery = encodeURIComponent(
        `{pod=~"function-${functionId}.*",container="user-container"} !~ "${service['getSystemLogsQueryRegex'](functionId)}"`,
      );
      const expectedUrl = `${lokiUrl}/loki/api/v1/query_range?query=${expectedLokiQuery}`;
      expect(httpGetSpy).toHaveBeenCalledWith(expect.stringContaining(expectedUrl));
    });
  });
});
