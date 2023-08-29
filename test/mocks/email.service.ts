import { EmailService } from 'email/email.service';
import { getFnMock, TypedMock } from '../utils/test-utils';

export default {
  send: getFnMock<EmailService['send']>(),
} as TypedMock<EmailService>;
