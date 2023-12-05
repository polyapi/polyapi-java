import { Cache } from 'cache-manager';
import { getFnMock, TypedMock } from '../utils/test-utils';
import { RedisStore } from 'cache-manager-redis-store';

export default {
  get: getFnMock<Cache['get']>(),
  set: getFnMock<Cache['set']>(),
  del: getFnMock<Cache['del']>(),
  reset: getFnMock<Cache['reset']>(),
  store: {
    getClient: getFnMock<RedisStore['getClient']>(),
  },
} as TypedMock<Cache> & {
  store: TypedMock<RedisStore>
};
