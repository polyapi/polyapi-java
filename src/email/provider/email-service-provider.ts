export interface EmailServiceProvider {
    send(fromEmail: string, subject: string, text: string, to: string): Promise<any>;
}
