import { getFnMock, TypedMock } from '../utils/test-utils';
import { EnvironmentService } from 'environment/environment.service';

export default {
  deleteAllByTenant: getFnMock<EnvironmentService['deleteAllByTenant']>(),
} as TypedMock<EnvironmentService>;
