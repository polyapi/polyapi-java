import { Test } from '@nestjs/testing';
import { VariableService } from 'variable/variable.service';
import { Variable } from '@prisma/client';
import { Visibility } from '@poly/model';
import { PrismaService } from 'prisma/prisma.service';
import { SecretService } from 'secret/secret.service';
import { commonServiceMock, configServiceMock, prismaServiceMock, secretServiceMock } from '../mocks';
import { ConfigService } from 'config/config.service';
import { CommonService } from 'common/common.service';
import { resetMocks } from '../mocks/utils';

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
      ],
    }).compile();

    service = module.get<VariableService>(VariableService);

    resetMocks(commonServiceMock, prismaServiceMock, configServiceMock, secretServiceMock);

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
      jest.spyOn(prismaServiceMock.variable, 'count').mockImplementationOnce(() => Promise.resolve(0) as any);
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
  });

  describe('deleteVariable', () => {
    it('should call secretService.delete when variable is deleted', async () => {
      jest.spyOn(prismaServiceMock.variable, 'delete').mockImplementationOnce(() => Promise.resolve({
        ...testVariable,
        environment: {
          id: 'environmentId12345',
        },
      }) as any);

      await service.deleteVariable(testVariable);
      expect(secretServiceMock.delete).toBeCalledWith('environmentId12345', 'id12345');
    });
  });
});
