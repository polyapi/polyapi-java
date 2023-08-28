import { Injectable, Logger } from '@nestjs/common';
import { EmailServiceProvider } from './provider/email-service-provider';
import { ConfigService } from 'config/config.service';
import MailChimp from './provider/mailchimp';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly emailServiceProvider: EmailServiceProvider;

  constructor(private readonly config: ConfigService) {
    this.emailServiceProvider = new MailChimp(this.config.mailchimpApikey);
  }

  async send(fromEmail: string, subject: string, text: string, to: string) {
    this.logger.debug(`Sending email with values: "fromEmail": "${fromEmail}", "subject": "${subject}", "text": "${text}", "to": "${to}"`);

    return this.emailServiceProvider.send(fromEmail, subject, text, to);
  }
}
