import { CommonService } from 'common/common.service';
import { getFnMock, TypedMock } from '../utils/test-utils';

export default {
  getPathContent: getFnMock<CommonService['getPathContent']>().mockImplementation((content) => content),
  sanitizeNameIdentifier: getFnMock<CommonService['sanitizeNameIdentifier']>().mockImplementation((name: string) => name),
  sanitizeContextIdentifier: getFnMock<CommonService['sanitizeContextIdentifier']>().mockImplementation((context: string) => context),
  resolveType: getFnMock<CommonService['resolveType']>(),
  toPropertyType: getFnMock<CommonService['toPropertyType']>(),
} as TypedMock<CommonService>;
