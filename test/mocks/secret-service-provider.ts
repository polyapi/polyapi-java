import { getFnMock, TypedMock } from '../utils/test-utils';
import { SecretServiceProvider } from 'secret/provider/secret-service-provider';

export default {
  init: getFnMock<SecretServiceProvider['init']>(),
  get: getFnMock<SecretServiceProvider['get']>(),
  set: getFnMock<SecretServiceProvider['set']>(),
  delete: getFnMock<SecretServiceProvider['delete']>(),
  deleteAll: getFnMock<SecretServiceProvider['deleteAll']>(),
} as TypedMock<SecretServiceProvider>;
