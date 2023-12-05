import { Emitter } from '@socket.io/redis-emitter';
import { getFnMock, TypedMock } from '../utils/test-utils';

export default {
  serverSideEmit: getFnMock<Emitter['serverSideEmit']>(),
} as TypedMock<Emitter>;
