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
    this.logger.debug(`Sending email with values: "fromEmail": "${fromEmail}", "subject": "${subject}", "text": "${text}", "to": "${to}"`);
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

  async sendEmailTemplate<T extends Record<string, any>>(fromEmail: string, subject: string, to: string, templateName: string, variables: T): Promise<any> {
    this.logger.debug(`Sending template email with values "fromEmail": "${fromEmail}", "subject": "${subject}",  "to": "${to}", "templateName": "${templateName}", "variables": ${JSON.stringify(variables)}`);
    const response = await this.mailchimpTx.messages.sendTemplate({
      template_name: templateName,
      template_content: [],
      message: {
        from_email: fromEmail,
        subject,
        to: [
          {
            email: to,
            type: 'to',
          },
        ],
        global_merge_vars: Object.entries(variables).reduce((acum, [key, value]) => {
          return [...acum, { name: key, content: value }];
        }, []),
      },
    });

    this.logger.debug('Email provider response', response);

    return response;
  }
}
