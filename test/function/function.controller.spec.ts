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
});
