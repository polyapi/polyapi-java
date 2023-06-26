import { Test } from '@nestjs/testing';
import { Environment } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { EnvironmentService } from 'environment/environment.service';
import { configServiceMock, prismaServiceMock, secretServiceMock } from '../mocks';
import { resetMocks } from '../mocks/utils';
import { SecretService } from 'secret/secret.service';
import { ConfigService } from 'config/config.service';

describe('EnvironmentService', () => {
  const testEnvironment: Environment = {
    id: 'id12345',
    name: 'name12345',
    tenantId: 'tenantId12345',
    subdomain: 'subdomain12345',
    createdAt: new Date(),
  };

  let service: EnvironmentService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EnvironmentService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: SecretService,
          useValue: secretServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<EnvironmentService>(EnvironmentService);

    resetMocks(prismaServiceMock, secretServiceMock, configServiceMock);

    prismaServiceMock.environment.delete?.mockResolvedValue(testEnvironment);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('toDto', () => {
    it('should return dto', async () => {
      const result = await service.toDto(testEnvironment);
      expect(result).toEqual({
        id: testEnvironment.id,
        name: testEnvironment.name,
        subdomain: testEnvironment.subdomain,
      });
    });
  });

  describe('cleanUp', () => {
    it('should call secretService.deleteAllForEnvironment on cleanUp', async () => {
      await service['cleanUp'](testEnvironment);
      expect(secretServiceMock.deleteAllForEnvironment).toBeCalledWith('id12345');
    });
  });

  describe('delete', () => {
    it('should call cleanUp on delete ', async () => {
      const cleanUpSpy = jest.spyOn(service as any, 'cleanUp');

      await service.delete('id12345');
      expect(cleanUpSpy).toBeCalledTimes(1);
    });
  });

  describe('deleteAllByTenant', () => {
    it('should call delete for each environment from tenant', async () => {
      jest.spyOn(service, 'getAllByTenant').mockImplementationOnce(() => Promise.resolve([
        {
          ...testEnvironment,
          id: 'deleted1',
        },
        {
          ...testEnvironment,
          id: 'deleted2',
        },
        {
          ...testEnvironment,
          id: 'deleted3',
        },
      ]) as any);
      const deleteSpy = jest.spyOn(service, 'delete');

      await service.deleteAllByTenant('tenantId12345');
      expect(deleteSpy).toBeCalledTimes(3);
      expect(deleteSpy).toBeCalledWith('deleted1');
      expect(deleteSpy).toBeCalledWith('deleted2');
      expect(deleteSpy).toBeCalledWith('deleted3');
    });
  });
});
