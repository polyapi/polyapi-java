import { Logger } from '@nestjs/common';
import { EmailServiceProvider } from '../email-service-provider';
import getClient from '@mailchimp/mailchimp_transactional';

export default class Mailchimp implements EmailServiceProvider {
  private readonly mailchimpTx: ReturnType<typeof getClient>;
  private readonly logger = new Logger(Mailchimp.name);

  constructor(apiKey: string) {
    this.mailchimpTx = getClient(apiKey);
  }

  async send(fromEmail: string, subject: string, text: string, to: string): Promise<any> {
    const response = await this.mailchimpTx.messages.send({
      message: {
        from_email: fromEmail,
        subject,
        text,
        to: [
          {
            email: to,
            type: 'to',
          },
        ],
      },
    });

    this.logger.debug('Email provider response', response);

    return response;
  }
}
