/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { VariableService } from 'variable/variable.service';
import { Variable } from '@prisma/client';
import { Visibility } from '@poly/model';
import { PrismaService } from 'prisma/prisma.service';
import { SecretService } from 'secret/secret.service';
import {
  aiServiceMock,
  authServiceMock,
  commonServiceMock,
  configServiceMock,
  eventServiceMock,
  functionServiceMock,
  prismaServiceMock,
  secretServiceMock,
  specsServiceMock,
} from '../mocks';
import { resetMocks } from '../mocks/utils';
import { ConfigService } from 'config/config.service';
import { CommonService } from 'common/common.service';
import { SpecsService } from 'specs/specs.service';
import { AuthService } from 'auth/auth.service';
import { EventService } from 'event/event.service';
import { FunctionService } from 'function/function.service';
import { AiService } from 'ai/ai.service';

describe('VariableService', () => {
  const testVariable: Variable = {
    id: 'id12345',
    name: 'name12345',
    context: 'context12345',
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
        {
          provide: AiService,
          useValue: aiServiceMock,
        },
      ],
    }).compile();

    service = module.get<VariableService>(VariableService);

    resetMocks(commonServiceMock, prismaServiceMock, configServiceMock, secretServiceMock, authServiceMock, functionServiceMock, eventServiceMock);

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
    const updatedSecretVariable = {
      ...testVariable,
      secret: true,
    };
    const updatedNonSecretVariable = {
      ...testVariable,
      secret: false,
    };

    beforeEach(() => {
      prismaServiceMock.variable.count?.mockImplementation(() => Promise.resolve(0) as any);
      commonServiceMock.sanitizeNameIdentifier?.mockImplementationOnce((name) => name);
      commonServiceMock.sanitizeContextIdentifier?.mockImplementationOnce((context) => context);
      secretServiceMock.get?.mockResolvedValue('previousValue12345');
      functionServiceMock.getFunctionsWithVariableArgument?.mockResolvedValue([]);
    });

    it('should not call secretService.set when variable value is not passed', async () => {
      prismaServiceMock.variable.update?.mockResolvedValue(updatedNonSecretVariable);
      await service.updateVariable(
        'environmentId12345',
        'updater12345',
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

    it('should not call eventService.sendVariableChangeEvent when variable no value nor secret is passed', async () => {
      prismaServiceMock.variable.update?.mockResolvedValue(updatedSecretVariable);
      await service.updateVariable(
        'environmentId12345',
        'updater12345',
        testVariable,
        'name12345',
        'context12345',
        'description12345',
        undefined,
        Visibility.Environment,
        undefined,
      );

      expect(eventServiceMock.sendVariableChangeEvent).not.toBeCalled();
    });

    it('should call secretService.set when variable value is passed', async () => {
      prismaServiceMock.variable.update?.mockResolvedValue(updatedNonSecretVariable);
      await service.updateVariable(
        'environmentId12345',
        'updater12345',
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

    it('should not call getFunctionsWithVariableArgument when variable name nor context is not changed', async () => {
      await service.updateVariable(
        'environmentId12345',
        'updater12345',
        testVariable,
        'name12345',
        'context12345',
        'description12345',
        'value12345',
        Visibility.Environment,
        false,
      );

      expect(functionServiceMock.getFunctionsWithVariableArgument).not.toBeCalled();
    });

    it('should call getFunctionsWithVariableArgument when variable name changed', async () => {
      await service.updateVariable(
        'environmentId12345',
        'updater12345',
        testVariable,
        'updatedName12345',
        'context12345',
        'description12345',
        'value12345',
        Visibility.Environment,
        false,
      );

      expect(functionServiceMock.getFunctionsWithVariableArgument).toBeCalledWith('environmentId12345', 'context12345.name12345');
    });

    it('should call getFunctionsWithVariableArgument when variable context changed', async () => {
      await service.updateVariable(
        'environmentId12345',
        'updater12345',
        testVariable,
        'name12345',
        'updatedContext12345',
        'description12345',
        'value12345',
        Visibility.Environment,
        false,
      );

      expect(functionServiceMock.getFunctionsWithVariableArgument).toBeCalledWith('environmentId12345', 'context12345.name12345');
    });

    it('should call eventService.sendVariableChangeEvent when variable value is passed and variable is not secret', async () => {
      prismaServiceMock.variable.update?.mockResolvedValue(updatedNonSecretVariable);
      await service.updateVariable(
        'environmentId12345',
        'updater12345',
        testVariable,
        'name12345',
        'context12345',
        'description12345',
        'value12345',
        Visibility.Environment,
        false,
      );

      expect(eventServiceMock.sendVariableChangeEvent).toBeCalledWith(updatedNonSecretVariable, {
        type: 'update',
        currentValue: 'value12345',
        previousValue: expect.not.stringMatching('previousValue12345'),
        updatedBy: 'updater12345',
        updateTime: expect.any(Number),
        path: 'context12345.name12345',
        secret: false,
        updatedFields: ['value', 'secret'],
      });
    });

    it('should call eventService.sendVariableChangeEvent when variable value is passed and variable is secret with masked values', async () => {
      prismaServiceMock.variable.update?.mockResolvedValue(updatedSecretVariable);
      await service.updateVariable(
        'environmentId12345',
        'updater12345',
        testVariable,
        'name12345',
        'context12345',
        'description12345',
        'value12345',
        Visibility.Environment,
        true,
      );

      expect(eventServiceMock.sendVariableChangeEvent).toBeCalledWith(updatedSecretVariable, {
        type: 'update',
        currentValue: expect.not.stringMatching('value12345'),
        previousValue: expect.not.stringMatching('previousValue12345'),
        updatedBy: 'updater12345',
        updateTime: expect.any(Number),
        path: 'context12345.name12345',
        secret: true,
        updatedFields: ['value'],
      });
    });

    it('should call eventService.sendVariableChangeEvent when variable value is object not equal to previous value', async () => {
      const previousValue = {
        value: 'previousValue12345',
        items: ['item1', 'item3'],
      };
      secretServiceMock.get?.mockResolvedValue(previousValue);
      prismaServiceMock.variable.update?.mockResolvedValue(updatedNonSecretVariable);

      const updatedValue = {
        ...previousValue,
        value: 'value12345',
      };
      await service.updateVariable(
        'environmentId12345',
        'updater12345',
        {
          ...testVariable,
          secret: false,
        },
        'name12345',
        'context12345',
        'description12345',
        updatedValue,
        Visibility.Environment,
        undefined,
      );

      expect(eventServiceMock.sendVariableChangeEvent).toBeCalledWith(updatedNonSecretVariable, {
        type: 'update',
        currentValue: updatedValue,
        previousValue,
        updatedBy: 'updater12345',
        updateTime: expect.any(Number),
        path: 'context12345.name12345',
        secret: false,
        updatedFields: ['value'],
      });
    });

    it('should not call eventService.sendVariableChangeEvent when variable value is object equal to previous value', async () => {
      const value = {
        value: 'value12345',
        items: ['item1', 'item3'],
      };
      secretServiceMock.get?.mockResolvedValue(value);
      prismaServiceMock.variable.update?.mockResolvedValueOnce(updatedNonSecretVariable);

      await service.updateVariable(
        'environmentId12345',
        'updater12345',
        {
          ...testVariable,
          secret: false,
        },
        'name12345',
        'context12345',
        'description12345',
        {
          ...value,
        },
        Visibility.Environment,
        false,
      );

      expect(eventServiceMock.sendVariableChangeEvent).not.toBeCalled();
    });
  });

  describe('deleteVariable', () => {
    const deletedVariable = {
      ...testVariable,
      secret: true,
      environment: {
        id: 'environmentId12345',
      },
    };
    beforeEach(() => {
      prismaServiceMock.variable.delete?.mockResolvedValueOnce(deletedVariable);
      secretServiceMock.get?.mockResolvedValue('previousValue12345');
    });

    it('should call secretService.delete when variable is deleted', async () => {
      functionServiceMock.getFunctionsWithVariableArgument?.mockResolvedValue([]);

      await service.deleteVariable(testVariable, 'deleter12345');
      expect(secretServiceMock.delete).toBeCalledWith('environmentId12345', 'id12345');
    });

    it('should throw Conflict error when variable is used in some functions', async () => {
      functionServiceMock.getFunctionsWithVariableArgument?.mockResolvedValue([
        {
          id: 'functionId12345',
        },
      ] as any);

      await expect(service.deleteVariable(testVariable, 'deleter12345')).rejects.toThrow(ConflictException);
    });

    it('should call eventService.updateVariableChangeEvent with null when variable is deleted', async () => {
      functionServiceMock.getFunctionsWithVariableArgument?.mockResolvedValue([]);

      await service.deleteVariable({
        ...testVariable,
        secret: false,
      }, 'deleter12345');
      expect(eventServiceMock.sendVariableChangeEvent).toBeCalledWith(deletedVariable, {
        type: 'delete',
        currentValue: null,
        previousValue: 'previousValue12345',
        updatedBy: 'deleter12345',
        updateTime: expect.any(Number),
        path: 'context12345.name12345',
        secret: false,
        updatedFields: [],
      });
    });

    it('should call eventService.updateVariableChangeEvent when variable is deleted and secret with masked value', async () => {
      functionServiceMock.getFunctionsWithVariableArgument?.mockResolvedValue([]);

      await service.deleteVariable({
        ...testVariable,
        secret: true,
      }, 'deleter12345');
      expect(eventServiceMock.sendVariableChangeEvent).toBeCalledWith(deletedVariable, {
        type: 'delete',
        currentValue: null,
        previousValue: expect.not.stringMatching('previousValue12345'),
        updatedBy: 'deleter12345',
        updateTime: expect.any(Number),
        path: 'context12345.name12345',
        secret: true,
        updatedFields: [],
      });
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

  describe('getVariableValue', () => {
    it('gets variable value from secret service', async () => {
      const variable = {
        environmentId: 'env123',
        id: 'var123',
      } as Variable;

      secretServiceMock.get?.mockResolvedValue('secret value');

      const result = await service.getVariableValue(variable);

      expect(result).toBe('secret value');
      expect(secretServiceMock.get).toHaveBeenCalledWith(variable.environmentId, variable.id);
    });

    it('returns original value if not object', async () => {
      const variable = {
        environmentId: 'env123',
        id: 'var123',
      } as Variable;

      secretServiceMock.get?.mockResolvedValue('string value');

      const result = await service.getVariableValue(variable, 'path.to.value');

      expect(result).toBe('string value');
    });

    it('gets nested path if value is object', async () => {
      const variable = {
        environmentId: 'env123',
        id: 'var123',
      } as Variable;

      const value = {
        foo: {
          bar: 'nested value',
        },
      };

      secretServiceMock.get?.mockResolvedValue(value);
      commonServiceMock.getPathContent?.mockImplementationOnce((value, path) => {
        if (path === 'foo.bar') {
          return value.foo.bar;
        }
      });

      const result = await service.getVariableValue(variable, 'foo.bar');

      expect(result).toBe('nested value');
    });

    it('returns undefined if path not found', async () => {
      const variable = {
        environmentId: 'env123',
        id: 'var123',
      } as Variable;

      const value = { foo: 'bar' };

      secretServiceMock.get?.mockResolvedValue(value);

      const result = await service.getVariableValue(variable, 'invalid.path');

      expect(result).toBeUndefined();
    });
  });

  describe('getValueApproximation', () => {
    it('returns original value if not secret', () => {
      const value = 'test';
      // @ts-ignore
      expect(service.getValueApproximation(value, false)).toBe(value);
    });

    it('returns masked string if secret', () => {
      const value = 'test';
      // @ts-ignore
      const masked = service.getValueApproximation(value, true);
      expect(masked).not.toBe(value);
      expect(typeof masked).toBe('string');
    });

    it('returns masked number if secret', () => {
      const value = 123;
      // @ts-ignore
      const masked = service.getValueApproximation(value, true);
      expect(masked).not.toBe(value);
      expect(typeof masked).toBe('number');
    });

    it('masks array values if secret', () => {
      const value = [1, 'two', false];
      // @ts-ignore
      const masked = service.getValueApproximation(value, true);

      expect(masked).not.toEqual(value);
      expect(masked).toHaveLength(3);

      // Check types
      expect(masked).toHaveLength(3);
      expect(typeof masked?.[0]).toBe('number');
      expect(typeof masked?.[1]).toBe('string');
      expect(typeof masked?.[2]).toBe('boolean');
    });

    it('masks object values if secret', () => {
      const value = { foo: 'bar', baz: 123 };
      // @ts-ignore
      const masked = service.getValueApproximation(value, true) as {
        foo: string;
        baz: number;
      };

      expect(masked).not.toEqual(value);
      expect(masked).not.toBeNull();
      expect(masked).toHaveProperty('foo');
      expect(masked).toHaveProperty('baz');

      expect(typeof masked.foo).toBe('string');
      expect(typeof masked?.baz).toBe('number');
    });

    it('returns fallback string for unknown type', () => {
      const value = Symbol('test');
      // @ts-ignore
      expect(service.getValueApproximation(value, true)).toBe('********');
    });
  });

  describe('unwrapVariables', () => {
    let authData;

    beforeEach(() => {
      authData = {};
    });

    test('passes primitive types', async () => {
      const obj = 'test';
      const result = await service.unwrapVariables(authData, obj);
      expect(result).toBe('test');

      const obj2 = 123;
      const result2 = await service.unwrapVariables(authData, obj2);
      expect(result2).toBe(123);
    });

    test('passes PolyVariable', async () => {
      const obj = {
        type: 'PolyVariable',
        id: 'abc123',
      };

      authServiceMock.checkEnvironmentEntityAccess?.mockResolvedValueOnce();
      jest.spyOn(service, 'findById').mockImplementationOnce(id => Promise.resolve({
        id,
      } as Variable));
      jest.spyOn(service, 'getVariableValue').mockImplementationOnce(variable =>
        Promise.resolve(variable.id === 'abc123' ? 'mockValue' : null),
      );

      const result = await service.unwrapVariables(authData, obj);

      expect(result).toEqual('mockValue');
    });

    test('passes object with PolyVariable', async () => {
      const obj = {
        foo: {
          type: 'PolyVariable',
          id: 'abc123',
        },
      };

      authServiceMock.checkEnvironmentEntityAccess?.mockResolvedValueOnce();
      jest.spyOn(service, 'findById').mockImplementationOnce(id => Promise.resolve({
        id,
      } as Variable));
      jest.spyOn(service, 'getVariableValue').mockImplementationOnce(variable =>
        Promise.resolve(variable.id === 'abc123' ? 'mockValue' : null),
      );

      const result = await service.unwrapVariables(authData, obj);

      expect(result).toEqual({
        foo: 'mockValue',
      });
    });

    test('passes nested PolyVariable', async () => {
      const obj = {
        foo: {
          bar: {
            type: 'PolyVariable',
            id: 'xyz789',
          },
        },
      };

      authServiceMock.checkEnvironmentEntityAccess?.mockResolvedValueOnce();
      jest.spyOn(service, 'findById').mockImplementationOnce(id => Promise.resolve({
        id,
      } as Variable));
      jest.spyOn(service, 'getVariableValue').mockImplementationOnce(variable =>
        Promise.resolve(variable.id === 'xyz789' ? 'mockNestedValue' : null),
      );

      const result = await service.unwrapVariables(authData, obj);

      expect(result).toEqual({
        foo: {
          bar: 'mockNestedValue',
        },
      });
    });

    test('passes array with PolyVariable', async () => {
      const obj = [
        {
          type: 'PolyVariable',
          id: '123abc',
        },
        'test',
      ];

      authServiceMock.checkEnvironmentEntityAccess?.mockResolvedValueOnce();
      jest.spyOn(service, 'findById').mockImplementationOnce(id => Promise.resolve({
        id,
      } as Variable));
      jest.spyOn(service, 'getVariableValue').mockImplementationOnce(variable =>
        Promise.resolve(variable.id === '123abc' ? 'mockArrayValue' : null),
      );

      const result = await service.unwrapVariables(authData, obj);

      expect(result).toEqual([
        'mockArrayValue',
        'test',
      ]);
    });

    test('throws error when variable is not accessible', async () => {
      const obj = [
        {
          type: 'PolyVariable',
          id: '123abc',
        },
        'test',
      ];

      authServiceMock.checkEnvironmentEntityAccess?.mockImplementationOnce(() => {
        throw new Error('no access');
      });
      jest.spyOn(service, 'findById').mockImplementationOnce(id => Promise.resolve({
        id,
      } as Variable));
      jest.spyOn(service, 'getVariableValue').mockImplementationOnce(variable =>
        Promise.resolve(variable.id === '123abc' ? 'mockArrayValue' : null),
      );

      await expect(service.unwrapVariables(authData, obj)).rejects.toThrow('no access');
    });

    test('throws error when variable is not accessible via checkVariableAccess function', async () => {
      const obj = [
        {
          type: 'PolyVariable',
          id: '123abc',
        },
        'test',
      ];

      jest.spyOn(service, 'findById').mockImplementationOnce(id => Promise.resolve({
        id,
      } as Variable));
      jest.spyOn(service, 'getVariableValue').mockImplementationOnce(variable =>
        Promise.resolve(variable.id === '123abc' ? 'mockArrayValue' : null),
      );

      const checkAccess = () => {
        throw new Error('no access');
      };

      await expect(service.unwrapVariables(authData, obj, checkAccess)).rejects.toThrow('no access');
    });
  });
});
