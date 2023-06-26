import { getFnMock, TypedMock } from '../utils/test-utils';
import { SecretService } from 'secret/secret.service';

export default {
  get: getFnMock<SecretService['get']>(),
  set: getFnMock<SecretService['set']>(),
  delete: getFnMock<SecretService['delete']>(),
  deleteAllForEnvironment: getFnMock<SecretService['deleteAllForEnvironment']>(),
} as TypedMock<SecretService>;
