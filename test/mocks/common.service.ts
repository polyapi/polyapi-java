import { CommonService } from 'common/common.service';
import { TypedMock } from '../utils/test-utils';

export default {
  sanitizeNameIdentifier: jest.fn().mockImplementation((name: string) => name),
  sanitizeContextIdentifier: jest.fn().mockImplementation((context: string) => context),
} as TypedMock<CommonService>;
