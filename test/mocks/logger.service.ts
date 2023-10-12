import { getFnMock, TypedMock } from '../utils/test-utils';
import { LoggerService } from 'logger/logger.service';

export default {
  createLogger: getFnMock<LoggerService['createLogger']>().mockReturnValue({
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  } as any),
} as TypedMock<LoggerService>;
