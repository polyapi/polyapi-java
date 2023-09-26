import { Test, TestingModule } from '@nestjs/testing';
import { VariableController } from 'variable/variable.controller';
import { VariableService } from 'variable/variable.service';
import { AuthService } from 'auth/auth.service';
import { Permission, CreateVariableDto, UpdateVariableDto, Visibility } from '@poly/model';
import { AuthRequest } from 'common/types';
import { PrismaService } from 'prisma/prisma.service';
import {
  configServiceMock,
  limitServiceMock,
  prismaServiceMock,
  statisticsServiceMock,
  variableServiceMock,
} from '../mocks';
import { ForbiddenException } from '@nestjs/common';
import { Variable } from '@prisma/client';
import { StatisticsService } from 'statistics/statistics.service';
import { LimitService } from 'limit/limit.service';
import { ConfigService } from 'config/config.service';

jest.mock('variable/variable.service');

describe('VariableController', () => {
  let controller: VariableController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VariableController],
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: VariableService,
          useValue: variableServiceMock,
        },
        {
          provide: StatisticsService,
          useValue: statisticsServiceMock,
        },
        {
          provide: LimitService,
          useValue: limitServiceMock,
        },
      ],
    }).compile();

    controller = module.get<VariableController>(VariableController);
  });

  describe('getVariables', () => {
    beforeEach(() => {
      variableServiceMock.getAll?.mockResolvedValue([]);
    });

    it('should check permissions correctly', async () => {
      const req = {
        user: {
          environment: {
            id: 'test_environment_id',
          },
        },
      } as AuthRequest;

      req.user.permissions = {
        [Permission.Use]: true,
      };
      await controller.getVariables(req);

      req.user.permissions = {
        [Permission.ManageNonSecretVariables]: true,
      };
      await controller.getVariables(req);

      req.user.permissions = {
        [Permission.ManageSecretVariables]: true,
      };
      await controller.getVariables(req);

      req.user.permissions = {
        [Permission.Use]: false,
        [Permission.ManageNonSecretVariables]: false,
        [Permission.ManageSecretVariables]: false,
      };

      await expect(controller.getVariables(req)).rejects.toThrowError(ForbiddenException);
    });
  });

  describe('createVariable', () => {
    beforeEach(() => {
      variableServiceMock.createVariable?.mockResolvedValue({
        id: 'test_variable_id',
        createdAt: new Date(),
        description: 'test_description',
        visibility: Visibility.Environment,
        environmentId: 'test_environment_id',
        name: 'test_variable',
        context: 'test_context',
        secret: false,
      });
    });

    it('should not fail when correct permission is set for creating non-secret variable', async () => {
      const req = {
        user: {
          environment: {
            id: 'test_environment_id',
          },
          permissions: {
            [Permission.ManageNonSecretVariables]: true,
            [Permission.ManageSecretVariables]: false,
          },
        },
      } as AuthRequest;
      const createVariableDto: CreateVariableDto = {
        name: 'test_variable',
        context: 'test_context',
        value: 'test_value',
        secret: false,
      };

      await controller.createVariable(req, createVariableDto);
    });

    it('should fail when correct permission is not set for creating non-secret variable', async () => {
      const req = {
        user: {
          environment: {
            id: 'test_environment_id',
          },
          permissions: {
            [Permission.ManageNonSecretVariables]: false,
            [Permission.ManageSecretVariables]: true,
          },
        },
      } as AuthRequest;
      const createVariableDto: CreateVariableDto = {
        name: 'test_variable',
        context: 'test_context',
        value: 'test_value',
        secret: false,
      };

      await expect(controller.createVariable(req, createVariableDto)).rejects.toThrowError(ForbiddenException);
    });
  });

  describe('getVariable', () => {
    beforeEach(() => {
      variableServiceMock.findById?.mockResolvedValue({
        id: 'test_variable_id',
        environmentId: 'test_environment_id',
      } as Variable);
    });

    it('should check permissions correctly for getVariable', async () => {
      const req = {
        user: {
          environment: {
            id: 'test_environment_id',
          },
          permissions: {},
        },
      } as AuthRequest;

      req.user.permissions = {
        [Permission.Use]: true,
      };
      await controller.getVariable(req, 'test_variable_id');

      req.user.permissions = {
        [Permission.Use]: false,
      };
      await expect(controller.getVariable(req, 'test_variable_id')).rejects.toThrowError(ForbiddenException);
    });
  });

  describe('updateVariable', () => {
    let req: AuthRequest;
    let updateVariableDto: UpdateVariableDto;

    beforeEach(() => {
      req = {
        user: {
          environment: {
            id: 'test_environment_id',
          },
          permissions: {},
        },
      } as AuthRequest;

      updateVariableDto = {
        name: 'test_variable_updated',
        context: 'test_context_updated',
        value: 'test_value_updated',
        secret: false,
      };

      variableServiceMock.findById?.mockResolvedValue({
        id: 'test_variable_id',
        environmentId: 'test_environment_id',
        secret: false,
      } as Variable);
    });

    describe('updating non-secret variables', () => {
      beforeEach(() => {
        updateVariableDto.secret = false;
      });

      it('should not fail when user has permission', async () => {
        req.user.permissions = {
          [Permission.ManageNonSecretVariables]: true,
        };
        await controller.updateVariable(req, 'test_variable_id', updateVariableDto);
      });

      it('should fail when user does not have permission', async () => {
        req.user.permissions = {
          [Permission.ManageNonSecretVariables]: false,
        };
        await expect(controller.updateVariable(req, 'test_variable_id', updateVariableDto)).rejects.toThrowError(ForbiddenException);
      });
    });

    describe('updating secret variables', () => {
      beforeEach(() => {
        updateVariableDto.secret = true;
      });

      it('should not fail when user has permission', async () => {
        req.user.permissions = {
          [Permission.ManageSecretVariables]: true,
        };
        await controller.updateVariable(req, 'test_variable_id', updateVariableDto);
      });

      it('should fail when user does not have permission', async () => {
        req.user.permissions = {
          [Permission.ManageSecretVariables]: false,
        };
        await expect(controller.updateVariable(req, 'test_variable_id', updateVariableDto)).rejects.toThrowError(ForbiddenException);
      });
    });

    describe('not updating secret value of variable', () => {
      beforeEach(() => {
        updateVariableDto.secret = undefined;
      });

      it('should use the secret: false value from variable', async () => {
        variableServiceMock.findById?.mockResolvedValue({
          id: 'test_variable_id',
          environmentId: 'test_environment_id',
          secret: false,
        } as Variable);

        req.user.permissions = {
          [Permission.ManageNonSecretVariables]: true,
        };
        await controller.updateVariable(req, 'test_variable_id', updateVariableDto);
      });

      it('should use the secret: true value from variable', async () => {
        variableServiceMock.findById?.mockResolvedValue({
          id: 'test_variable_id',
          environmentId: 'test_environment_id',
          secret: true,
        } as Variable);

        req.user.permissions = {
          [Permission.ManageSecretVariables]: true,
        };
        await controller.updateVariable(req, 'test_variable_id', updateVariableDto);
      });
    });
  });

  describe('deleteVariable', () => {
    let req: AuthRequest;

    beforeEach(() => {
      req = {
        user: {
          environment: {
            id: 'test_environment_id',
          },
          permissions: {},
        },
      } as AuthRequest;
    });

    describe('deleting non-secret variables', () => {
      beforeEach(() => {
        variableServiceMock.findById?.mockResolvedValue({
          id: 'test_variable_id',
          environmentId: 'test_environment_id',
          secret: false,
        } as Variable);
      });

      it('should not fail when user has permission', async () => {
        req.user.permissions = {
          [Permission.ManageNonSecretVariables]: true,
        };
        await controller.deleteVariable(req, 'test_variable_id');
      });

      it('should fail when user does not have permission', async () => {
        req.user.permissions = {
          [Permission.ManageNonSecretVariables]: false,
        };
        await expect(controller.deleteVariable(req, 'test_variable_id')).rejects.toThrowError(ForbiddenException);
      });
    });

    describe('deleting secret variables', () => {
      beforeEach(() => {
        variableServiceMock.findById?.mockResolvedValue({
          id: 'test_variable_id',
          environmentId: 'test_environment_id',
          secret: true,
        } as Variable);
      });

      it('should not fail when user has permission', async () => {
        req.user.permissions = {
          [Permission.ManageSecretVariables]: true,
        };
        await controller.deleteVariable(req, 'test_variable_id');
      });

      it('should fail when user does not have permission', async () => {
        req.user.permissions = {
          [Permission.ManageSecretVariables]: false,
        };
        await expect(controller.deleteVariable(req, 'test_variable_id')).rejects.toThrowError(ForbiddenException);
      });
    });
  });
});
