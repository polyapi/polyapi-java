import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

export const NAME_CONFLICT = 'NAME_CONFLICT';

export class CommonError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const checkPolyTrainingAssistantScriptVersion = (clientVersion: string | undefined, serverVersion: string): void => {
  if (!clientVersion) {
    return;
  }
  const simpleSemverRegex = /^\d.{1}\d.{1}\d{1}$/;
  if (!simpleSemverRegex.test(clientVersion)) {
    throw new BadRequestException(`Improper formatting of the script version, as sent by the client: ${clientVersion}. Should follow semantic versioning.`);
  }
  if (!simpleSemverRegex.test(serverVersion)) {
    throw new InternalServerErrorException('Improper formatting of the script version on the server');
  }
  const [clientMajor] = clientVersion.split('.');
  const [serverMajor] = serverVersion.split('.');
  if (serverMajor !== clientMajor) {
    const scriptDownloadUrl = `${process.env.HOST_URL}/postman/scripts.zip`;
    throw new BadRequestException(`The Poly training code has been updated. Your training script needs to be upgraded to the latest version. Please download the latest script from ${scriptDownloadUrl} or contact support@polyapi.io if you need any assistance!`);
  }
};
