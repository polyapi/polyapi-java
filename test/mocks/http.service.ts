import { getFnMock, TypedMock } from '../utils/test-utils';
import { HttpService } from '@nestjs/axios';

export default {
  request: getFnMock<HttpService['request']>(),
} as TypedMock<HttpService>;
