import { getFnMock, TypedMock } from '../utils/test-utils';
import { HttpService } from '@nestjs/axios';

export default {
  get: getFnMock<HttpService['get']>(),
  request: getFnMock<HttpService['request']>(),
} as TypedMock<HttpService>;
