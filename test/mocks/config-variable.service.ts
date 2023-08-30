import { getFnMock, TypedMock } from '../utils/test-utils';
import { ConfigVariableService } from 'config-variable/config-variable.service';

export default {
  getEffectiveValue: getFnMock<ConfigVariableService['getEffectiveValue']>(),
} as TypedMock<ConfigVariableService>;
