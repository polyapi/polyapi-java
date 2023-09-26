import { Injectable, Logger } from '@nestjs/common';
import { EmailServiceProvider } from './provider/email-service-provider';
import { ConfigService } from 'config/config.service';
import MailChimp from './provider/mailchimp';
import { Tenant, TenantSignUp } from '@prisma/client';

type WelcomeToPolyEmailVariables = {
  API_URL: string,
  API_KEY: string,
  TENANT_ID: string,
}

type VerificationCodeVariables = {
  VERIFICATION_CODE: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly emailServiceProvider: EmailServiceProvider;

  constructor(private readonly config: ConfigService) {
    this.emailServiceProvider = new MailChimp(this.config.mailchimpApikey);
  }

  async send(fromEmail: string, subject: string, text: string, to: string) {
    return this.emailServiceProvider.send(fromEmail, subject, text, to);
  }

  async sendEmailTemplate<T extends Record<string, any>>(fromEmail: string, subject: string, to: string, templateName: string, variables: T): Promise<any> {
    return this.emailServiceProvider.sendEmailTemplate<T>(fromEmail, subject, to, templateName, variables);
  }

  sendWelcomeToPolyEmail(tenantSignUp: TenantSignUp, apiKey: string, tenant: Tenant) {
    return this.sendEmailTemplate<WelcomeToPolyEmailVariables>(this.config.signUpEmail, 'Poly API Tenant Information', tenantSignUp.email, this.config.signUpTenantInformationTemplateName, {
      API_KEY: apiKey,
      TENANT_ID: tenant.id,
      API_URL: this.config.hostUrl,
    });
  }

  sendSignUpVerificationCode(tenantSignUp: TenantSignUp) {
    return this.sendEmailTemplate<VerificationCodeVariables>(this.config.signUpEmail, 'Poly API Verification Code', tenantSignUp.email, this.config.sendSignUpVerificationCodeTemplateName, {
      VERIFICATION_CODE: tenantSignUp.verificationCode.toUpperCase(),
    });
  }
}
