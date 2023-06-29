import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { VariableService } from 'variable/variable.service';
import { Variable } from '@prisma/client';
import { Visibility } from '@poly/model';
import { PrismaService } from 'prisma/prisma.service';
import { SecretService } from 'secret/secret.service';
import {
  authServiceMock,
  commonServiceMock,
  configServiceMock,
  functionServiceMock,
  eventServiceMock,
  prismaServiceMock,
  secretServiceMock,
  specsServiceMock,
} from '../mocks';
import { ConfigService } from 'config/config.service';
import { CommonService } from 'common/common.service';
import { resetMocks } from '../mocks/utils';
import { SpecsService } from 'specs/specs.service';
import { AuthService } from 'auth/auth.service';
import { EventService } from 'event/event.service';
import { FunctionService } from 'function/function.service';

describe('VariableService', () => {
  const testVariable: Variable = {
    id: 'id12345',
    name: 'name12345',
    context: 'content12345',
    description: 'description12345',
    createdAt: new Date(),
    environmentId: 'environmentId12345',
    secret: true,
    visibility: Visibility.Environment,
  };

  let service: VariableService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        VariableService,
        {
          provide: CommonService,
          useValue: commonServiceMock,
        },
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: SecretService,
          useValue: secretServiceMock,
        },
        {
          provide: SpecsService,
          useValue: specsServiceMock,
        },
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: FunctionService,
          useValue: functionServiceMock,
        },
        {
          provide: EventService,
          useValue: eventServiceMock,
        },
      ],
    }).compile();

    service = module.get<VariableService>(VariableService);

    resetMocks(commonServiceMock, prismaServiceMock, configServiceMock, secretServiceMock, authServiceMock, eventServiceMock);

    secretServiceMock.get?.mockResolvedValue('value12345');
    prismaServiceMock.$transaction?.mockImplementation((cb) => cb(prismaServiceMock as any));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('toDto', () => {
    it('should return dto without value when secret is true', async () => {
      const result = await service.toDto({
        ...testVariable,
        secret: true,
      });
      expect(result).toEqual({
        id: testVariable.id,
        name: testVariable.name,
        context: testVariable.context,
        description: testVariable.description,
        secret: true,
        visibility: testVariable.visibility,
        value: undefined,
      });
    });

    it('should set value when variable is not secret', async () => {
      const result = await service.toDto({
        ...testVariable,
        secret: false,
      });
      expect(result).toEqual({
        id: testVariable.id,
        name: testVariable.name,
        context: testVariable.context,
        description: testVariable.description,
        secret: false,
        visibility: testVariable.visibility,
        value: 'value12345',
      });
    });
  });

  describe('createVariable', () => {
    beforeEach(() => {
      jest.spyOn(prismaServiceMock.variable, 'create').mockImplementationOnce((data) => Promise.resolve({
        ...data,
        id: 'id12345',
      }) as any);
    });

    it('should call secretService.set when variable is created', async () => {
      jest.spyOn(prismaServiceMock.variable, 'count').mockImplementationOnce(() => Promise.resolve(0) as any);

      await service.createVariable(
        'environmentId12345',
        'context12345',
        'name12345',
        'description12345',
        'value12345',
        Visibility.Environment,
        false,
      );
      expect(secretServiceMock.set).toBeCalledWith('environmentId12345', 'id12345', 'value12345');
    });

    it('should fail when there are existing variables with such name and context', async () => {
      jest.spyOn(prismaServiceMock.variable, 'count').mockImplementationOnce(() => Promise.resolve(1) as any);

      await expect(
        async () => {
          await service.createVariable(
            'environmentId12345',
            'context12345',
            'name12345',
            'description12345',
            'value12345',
            Visibility.Environment,
            false,
          );
        },
      ).rejects.toThrowError();
    });
  });

  describe('updateVariable', () => {
    beforeEach(() => {
      prismaServiceMock.variable.count?.mockImplementationOnce(() => Promise.resolve(0) as any);
    });

    it('should not call secretService.set when variable value is not passed', async () => {
      await service.updateVariable(
        'environmentId12345',
        testVariable,
        'name12345',
        'context12345',
        'description12345',
        undefined,
        Visibility.Environment,
        false,
      );

      expect(secretServiceMock.set).not.toBeCalled();
    });

    it('should not call eventService.sendVariableUpdateEvent when variable value is not passed', async () => {
      await service.updateVariable(
        'environmentId12345',
        testVariable,
        'name12345',
        'context12345',
        'description12345',
        undefined,
        Visibility.Environment,
        false,
      );

      expect(eventServiceMock.sendVariableUpdateEvent).not.toBeCalled();
    });

    it('should call secretService.set when variable value is passed', async () => {
      await service.updateVariable(
        'environmentId12345',
        testVariable,
        'name12345',
        'context12345',
        'description12345',
        'value12345',
        Visibility.Environment,
        false,
      );

      expect(secretServiceMock.set).toBeCalledWith('environmentId12345', 'id12345', 'value12345');
    });

    it('should call eventService.sendVariableUpdateEvent when variable value is passed and variable is not secret', async () => {
      await service.updateVariable(
        'environmentId12345',
        testVariable,
        'name12345',
        'context12345',
        'description12345',
        'value12345',
        Visibility.Environment,
        false,
      );

      expect(eventServiceMock.sendVariableUpdateEvent).toBeCalledWith(testVariable.id, 'value12345');
    });

    it('should not call eventService.sendVariableUpdateEvent when variable value is passed and variable is secret', async () => {
      await service.updateVariable(
        'environmentId12345',
        testVariable,
        'name12345',
        'context12345',
        'description12345',
        'value12345',
        Visibility.Environment,
        true,
      );

      expect(eventServiceMock.sendVariableUpdateEvent).not.toBeCalled();
    });
  });

  describe('deleteVariable', () => {
    it('should call secretService.delete when variable is deleted', async () => {
      jest.spyOn(prismaServiceMock.variable, 'delete').mockImplementationOnce(() => Promise.resolve({
        ...testVariable,
        environment: {
          id: 'environmentId12345',
        },
      }) as any);
      functionServiceMock.getFunctionsWithVariableArgument?.mockResolvedValue([]);

      await service.deleteVariable(testVariable);
      expect(secretServiceMock.delete).toBeCalledWith('environmentId12345', 'id12345');
    });

    it('should throw Conflict error when variable is used in some functions', async () => {
      functionServiceMock.getFunctionsWithVariableArgument?.mockResolvedValue([
        {
          id: 'functionId12345',
        },
      ] as any);

      await expect(service.deleteVariable(testVariable)).rejects.toThrow(ConflictException);
    });

    it('should call eventService.updateVariableUpdateEvent with null when variable is deleted and not secret', async () => {
      jest.spyOn(prismaServiceMock.variable, 'delete').mockImplementationOnce(() => Promise.resolve({
        ...testVariable,
        secret: false,
        environment: {
          id: 'environmentId12345',
        },
      }) as any);

      await service.deleteVariable({
        ...testVariable,
        secret: false,
      });
      expect(eventServiceMock.sendVariableUpdateEvent).toBeCalledWith(testVariable.id, null);
    });

    it('should not call eventService.updateVariableUpdateEvent when variable is deleted and secret', async () => {
      jest.spyOn(prismaServiceMock.variable, 'delete').mockImplementationOnce(() => Promise.resolve({
        ...testVariable,
        secret: true,
        environment: {
          id: 'environmentId12345',
        },
      }) as any);

      await service.deleteVariable({
        ...testVariable,
        secret: true,
      });
      expect(eventServiceMock.sendVariableUpdateEvent).not.toBeCalled();
    });
  });

  describe('toServerVariableSpecification', () => {
    it('should return the correct ServerVariableSpecification', async () => {
      const variable = {
        id: '123',
        createdAt: new Date(),
        environmentId: 'env123',
        name: 'variableName',
        context: 'variableContext',
        description: 'variableDescription',
        secret: false,
        visibility: Visibility.Environment,
      };

      const value = 'variableValue';
      const resolvedType = ['string'] as any;
      const propertyType = {
        kind: 'primitive',
        type: 'string',
      } as any;

      secretServiceMock.get?.mockResolvedValue(value);
      commonServiceMock.resolveType?.mockResolvedValue(resolvedType);
      commonServiceMock.toPropertyType?.mockResolvedValue(propertyType);

      const result = await service.toServerVariableSpecification(variable);

      expect(result).toEqual({
        type: 'serverVariable',
        id: variable.id,
        name: variable.name,
        context: variable.context,
        description: variable.description,
        visibilityMetadata: {
          visibility: variable.visibility,
        },
        variable: {
          environmentId: variable.environmentId,
          secret: variable.secret,
          valueType: propertyType,
          value,
        },
      });

      expect(secretServiceMock.get).toHaveBeenCalledWith(variable.environmentId, variable.id);
      expect(commonServiceMock.resolveType).toHaveBeenCalledWith('ValueType', value);
      expect(commonServiceMock.toPropertyType).toHaveBeenCalledWith(variable.name, resolvedType[0], value, resolvedType[1]);
    });

    it('should return the correct ServerVariableSpecification when secret is true', async () => {
      const variable = {
        id: '456',
        createdAt: new Date(),
        environmentId: 'env456',
        name: 'secretVariable',
        context: 'secretContext',
        description: 'secretDescription',
        secret: true,
        visibility: Visibility.Environment,
      };

      const value = 'secretValue';
      const resolvedType = ['string'] as any;
      const propertyType = {
        kind: 'primitive',
        type: 'string',
      } as any;

      secretServiceMock.get?.mockResolvedValue(value);
      commonServiceMock.resolveType?.mockResolvedValue(resolvedType);
      commonServiceMock.toPropertyType?.mockResolvedValue(propertyType);

      const result = await service.toServerVariableSpecification(variable);

      expect(result).toEqual({
        type: 'serverVariable',
        id: variable.id,
        name: variable.name,
        context: variable.context,
        description: variable.description,
        visibilityMetadata: {
          visibility: variable.visibility,
        },
        variable: {
          environmentId: variable.environmentId,
          secret: variable.secret,
          valueType: {
            kind: 'object',
          },
          value: undefined,
        },
      });

      expect(secretServiceMock.get).toHaveBeenCalledWith(variable.environmentId, variable.id);
    });

    it('should return the correct ServerVariableSpecification when value is null', async () => {
      const variable = {
        id: '789',
        createdAt: new Date(),
        environmentId: 'env789',
        name: 'nullableVariable',
        context: 'nullableContext',
        description: 'nullableDescription',
        secret: false,
        visibility: 'public',
      };

      const value = null;
      const resolvedType = ['string'] as any;
      const propertyType = {
        kind: 'primitive',
        type: 'string',
      } as any;

      secretServiceMock.get?.mockResolvedValue(value);
      commonServiceMock.resolveType?.mockResolvedValue(resolvedType);
      commonServiceMock.toPropertyType?.mockResolvedValue(propertyType);

      const result = await service.toServerVariableSpecification(variable);

      expect(result).toEqual({
        type: 'serverVariable',
        id: variable.id,
        name: variable.name,
        context: variable.context,
        description: variable.description,
        visibilityMetadata: {
          visibility: variable.visibility,
        },
        variable: {
          environmentId: variable.environmentId,
          secret: variable.secret,
          valueType: propertyType,
          value: variable.secret ? undefined : value,
        },
      });

      expect(secretServiceMock.get).toHaveBeenCalledWith(variable.environmentId, variable.id);
      expect(commonServiceMock.resolveType).toHaveBeenCalledWith('ValueType', value);
      expect(commonServiceMock.toPropertyType).toHaveBeenCalledWith(variable.name, resolvedType[0], value, resolvedType[1]);
    });

    it('should handle errors and throw an exception', async () => {
      const variable = {
        id: '789',
        createdAt: new Date(),
        environmentId: 'env789',
        name: 'errorVariable',
        context: 'errorContext',
        description: 'errorDescription',
        secret: false,
        visibility: 'public',
      };

      const errorMessage = 'An error occurred';

      secretServiceMock.get?.mockRejectedValue(new Error(errorMessage));

      await expect(service.toServerVariableSpecification(variable)).rejects.toThrow(errorMessage);

      expect(secretServiceMock.get).toHaveBeenCalledWith(variable.environmentId, variable.id);
    });
  });
});
