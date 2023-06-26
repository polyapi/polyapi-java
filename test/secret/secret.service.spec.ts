import { Test, TestingModule } from '@nestjs/testing';
import { SecretService } from 'secret/secret.service';
import { SecretModule } from 'secret/secret.module';
import { ConfigModule } from 'config/config.module';

describe('SecretService', () => {
  let module: TestingModule;
  let service: SecretService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [SecretModule, ConfigModule],
    }).compile();

    service = module.get<SecretService>(SecretService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call init from ServiceProvider on initForEnvironment', () => {
    const initSpy = jest.spyOn(service['secretServiceProvider'], 'init')
      .mockImplementationOnce(() => Promise.resolve());
    service.initForEnvironment({ id: 'id' } as any);
    expect(initSpy).toBeCalledTimes(1);
  });

  it('should call get from ServiceProvider on get', () => {
    const getSpy = jest.spyOn(service['secretServiceProvider'], 'get')
      .mockImplementationOnce(() => Promise.resolve());
    service.get('12345', 'key_12345');
    expect(getSpy).toBeCalledTimes(1);
    expect(getSpy).toBeCalledWith('12345', 'key_12345');
  });

  it('should call set from ServiceProvider on set', () => {
    const setSpy = jest.spyOn(service['secretServiceProvider'], 'set')
      .mockImplementationOnce(() => Promise.resolve());
    service.set('12345', 'key_12345', 'value_12345');
    expect(setSpy).toBeCalledTimes(1);
    expect(setSpy).toBeCalledWith('12345', 'key_12345', 'value_12345');
  });

  it('should call delete from ServiceProvider on delete', () => {
    const deleteSpy = jest.spyOn(service['secretServiceProvider'], 'delete')
      .mockImplementationOnce(() => Promise.resolve());
    service.delete('12345', 'key_12345');
    expect(deleteSpy).toBeCalledTimes(1);
    expect(deleteSpy).toBeCalledWith('12345', 'key_12345');
  });

  it('should call deleteAll from ServiceProvider on deleteAllForEnvironment', () => {
    const deleteAllSpy = jest.spyOn(service['secretServiceProvider'], 'deleteAll')
      .mockImplementationOnce(() => Promise.resolve());
    service.deleteAllForEnvironment('12345');
    expect(deleteAllSpy).toBeCalledTimes(1);
    expect(deleteAllSpy).toBeCalledWith('12345');
  });
});
