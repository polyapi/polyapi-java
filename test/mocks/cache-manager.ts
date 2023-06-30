import { Cache } from 'cache-manager';
import { getFnMock, TypedMock } from '../utils/test-utils';

export default {
  get: getFnMock<Cache['get']>(),
  set: getFnMock<Cache['set']>(),
  del: getFnMock<Cache['del']>(),
  reset: getFnMock<Cache['reset']>(),
} as TypedMock<Cache>;
