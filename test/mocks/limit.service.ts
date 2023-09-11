import { getFnMock, TypedMock } from '../utils/test-utils';
import { LimitService } from 'limit/limit.service';

export default {
  getLimitTiers: getFnMock<LimitService['getLimitTiers']>(),
} as TypedMock<LimitService>;
