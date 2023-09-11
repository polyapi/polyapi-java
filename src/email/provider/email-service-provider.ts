export interface EmailServiceProvider {
    send(fromEmail: string, subject: string, text: string, to: string): Promise<any>;
    sendEmailTemplate<T extends Record<string, any>>(fromEmail: string, subject: string, to: string, templateName: string, variables: T): Promise<any>;
}
