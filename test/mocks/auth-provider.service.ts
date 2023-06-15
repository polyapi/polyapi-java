import { getFnMock, TypedMock } from '../utils/test-utils';
import { AuthProviderService } from 'auth-provider/auth-provider.service';

export default {
  getAuthProviders: getFnMock<AuthProviderService['getAuthProviders']>(),
  toAuthFunctionSpecifications: getFnMock<AuthProviderService['toAuthFunctionSpecifications']>(),
} as TypedMock<AuthProviderService>;
