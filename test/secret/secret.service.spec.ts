import { Test, TestingModule } from '@nestjs/testing';
import { SecretService } from 'secret/secret.service';
import { cacheManagerMock, configServiceMock, httpServiceMock, secretServiceProviderMock } from '../mocks';
import { ConfigService } from 'config/config.service';
import { HttpService } from '@nestjs/axios';
import { resetMocks } from '../mocks/utils';

jest.mock('secret/provider/vault/vault-secret-service-provider', () => ({
  VaultSecretServiceProvider: jest.fn().mockImplementation(() => secretServiceProviderMock),
}));

describe('SecretService', () => {
  let module: TestingModule;
  let service: SecretService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        SecretService,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: HttpService,
          useValue: httpServiceMock,
        },
        {
          provide: 'CACHE_MANAGER',
          useValue: cacheManagerMock,
        },
      ],
    }).compile();

    service = module.get<SecretService>(SecretService);
    resetMocks(configServiceMock, httpServiceMock, cacheManagerMock, secretServiceProviderMock);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call init from ServiceProvider on initForEnvironment', async () => {
    await service.initForEnvironment({ id: 'id' } as any);
    expect(secretServiceProviderMock.init).toBeCalledTimes(1);
  });

  it('should call get from ServiceProvider on get when cache value is not defined', async () => {
    cacheManagerMock.get?.mockResolvedValue(undefined);

    await service.get('12345', 'key_12345');
    expect(secretServiceProviderMock.get).toBeCalledTimes(1);
    expect(secretServiceProviderMock.get).toBeCalledWith('12345', 'key_12345');
  });

  it('should not call get from ServiceProvider on get when cache value is defined', async () => {
    cacheManagerMock.get?.mockResolvedValue('cached_value_12345');

    const result = await service.get('12345', 'key_12345');
    expect(result).toEqual('cached_value_12345');
    expect(cacheManagerMock.get).toBeCalledTimes(1);
    expect(cacheManagerMock.get).toBeCalledWith('12345:key_12345');
    expect(secretServiceProviderMock.get).not.toBeCalled();
  });

  it('should call set from ServiceProvider on set', async () => {
    await service.set('12345', 'key_12345', 'value_12345');
    expect(secretServiceProviderMock.set).toBeCalledTimes(1);
    expect(secretServiceProviderMock.set).toBeCalledWith('12345', 'key_12345', 'value_12345');
  });

  it('should call set from CacheManager on set', async () => {
    await service.set('12345', 'key_12345', 'value_12345');
    expect(cacheManagerMock.set).toBeCalledTimes(1);
    expect(cacheManagerMock.set).toBeCalledWith('12345:key_12345', 'value_12345');
  });

  it('should call delete from ServiceProvider on delete', async () => {
    await service.delete('12345', 'key_12345');
    expect(secretServiceProviderMock.delete).toBeCalledTimes(1);
    expect(secretServiceProviderMock.delete).toBeCalledWith('12345', 'key_12345');
  });

  it('should call del from CacheManager on delete', async () => {
    await service.delete('12345', 'key_12345');
    expect(cacheManagerMock.del).toBeCalledTimes(1);
    expect(cacheManagerMock.del).toBeCalledWith('12345:key_12345');
  });

  it('should call deleteAll from ServiceProvider on deleteAllForEnvironment', async () => {
    await service.deleteAllForEnvironment('12345');
    expect(secretServiceProviderMock.deleteAll).toBeCalledTimes(1);
    expect(secretServiceProviderMock.deleteAll).toBeCalledWith('12345');
  });
});
