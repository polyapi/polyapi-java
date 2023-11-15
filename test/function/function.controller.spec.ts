/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRequest } from 'common/types';
import { FunctionController } from 'function/function.controller';
import { FunctionService } from 'function/function.service';
import {
  authServiceMock,
  commonServiceMock,
  configServiceMock,
  environmentServiceMock,
  functionServiceMock,
  limitServiceMock,
  perfLogInfoProviderMock,
  prismaServiceMock,
  statisticsServiceMock,
  variableServiceMock,
} from '../mocks';
import { AuthService } from 'auth/auth.service';
import { VariableService } from 'variable/variable.service';
import { LimitService } from 'limit/limit.service';
import { StatisticsService } from 'statistics/statistics.service';
import { CommonService } from 'common/common.service';
import { EnvironmentService } from 'environment/environment.service';
import { PerfLogInfoProvider } from 'statistics/perf-log-info-provider';
import { ConfigService } from 'config/config.service';
import { PrismaService } from 'prisma-module/prisma.service';
import { CreateServerCustomFunctionDto } from '@poly/model';

describe('FunctionController', () => {
  let controller: FunctionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FunctionController],
      providers: [
        {
          provide: FunctionService,
          useValue: functionServiceMock,
        },
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: VariableService,
          useValue: variableServiceMock,
        },
        {
          provide: LimitService,
          useValue: limitServiceMock,
        },
        {
          provide: StatisticsService,
          useValue: statisticsServiceMock,
        },
        {
          provide: CommonService,
          useValue: commonServiceMock,
        },
        {
          provide: EnvironmentService,
          useValue: environmentServiceMock,
        },
        {
          provide: PerfLogInfoProvider,
          useValue: perfLogInfoProviderMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    controller = module.get<FunctionController>(FunctionController);
  });

  it('Function controller works', () => {
    expect(controller).toBeTruthy();
  });
  describe('createServerFunction', () => {
    const createServerCustomFunctionDto: CreateServerCustomFunctionDto = {
      name: 'myFunc',
      code: '',
    };
    beforeAll(() => {
      authServiceMock.checkPermissions?.mockResolvedValue(true);
      limitServiceMock.checkTenantFunctionsLimit?.mockResolvedValue(true);
      functionServiceMock.customServerFunctionResponseDto?.mockImplementation((async () => {}) as any);
    });
    it("should set the function's logs property based on the environment's default, when not explicitly set", async () => {
      const req = {
        user: {
          key: 'some_key',
          environment: {
            id: 'test_environment_id',
            logsDefault: true,
          },
        },
      } as AuthRequest;
      let expectedValueForLogsEnabled = true;
      const createOrUpdateServerFunctionSpy = jest.spyOn(functionServiceMock, 'createOrUpdateServerFunction');
      await controller.createServerFunction(req, createServerCustomFunctionDto);
      expect(createOrUpdateServerFunctionSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expectedValueForLogsEnabled,
        expect.anything(),
      );

      req.user.environment.logsDefault = false;
      expectedValueForLogsEnabled = false;
      await controller.createServerFunction(req, createServerCustomFunctionDto);
      expect(createOrUpdateServerFunctionSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expectedValueForLogsEnabled,
        expect.anything(),
      );
    });
  });
});
