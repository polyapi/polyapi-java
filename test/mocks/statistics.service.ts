import { getFnMock, TypedMock } from '../utils/test-utils';
import { StatisticsService } from 'statistics/statistics.service';

export default {
  trackVariableCall: getFnMock<StatisticsService['trackVariableCall']>(),
} as TypedMock<StatisticsService>;
