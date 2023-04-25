import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { FunctionService } from 'function/function.service';
import { WebhookService } from 'webhook/webhook.service';
import { AuthProviderService } from 'auth-provider/auth-provider.service';
import { Environment, User } from '@prisma/client';
import { Specification, SpecificationPath } from '@poly/common';
import { toCamelCase } from '@guanghechen/helper-string';

@Injectable()
export class SpecsService {
  private logger: Logger = new Logger(SpecsService.name);

  constructor(
    @Inject(forwardRef(() => FunctionService))
    private readonly functionService: FunctionService,
    @Inject(forwardRef(() => WebhookService))
    private readonly webhookService: WebhookService,
    @Inject(forwardRef(() => AuthProviderService))
    private readonly authProviderService: AuthProviderService,
  ) {
  }

  async getSpecificationPaths(environmentId: string): Promise<SpecificationPath[]> {
    const specifications = await this.getSpecifications(environmentId);
    return specifications.map(spec => ({
      id: spec.id,
      path: `${spec.context ? `${spec.context}.` : ''}${toCamelCase(spec.name.split('.').map(toCamelCase).join('.'))}`,
    }));
  }

  async getSpecifications(environmentId: string, contexts?: string[], names?: string[], ids?: string[]): Promise<Specification[]> {
    this.logger.debug(`Getting specifications for environment ${environmentId} with contexts ${contexts}, names ${names}, and ids ${ids}`);

    const apiFunctions = await this.functionService.getApiFunctions(environmentId, contexts, names, ids);
    const customFunctions = await this.functionService.getCustomFunctions(environmentId, contexts, names, ids);
    const webhookHandles = await this.webhookService.getWebhookHandles(environmentId, contexts, names, ids);
    const authProviders = await this.authProviderService.getAuthProviders(environmentId, contexts);

    return [
      ...(await Promise.all(apiFunctions.map(apiFunction => this.functionService.toApiFunctionSpecification(apiFunction)))),
      ...(await Promise.all(customFunctions.map(customFunction => this.functionService.toCustomFunctionSpecification(customFunction)))),
      ...(await Promise.all(webhookHandles.map(webhookHandle => this.webhookService.toWebhookHandleSpecification(webhookHandle)))),
      ...(await Promise.all(authProviders.map(authProvider => this.authProviderService.toAuthFunctionSpecifications(authProvider)))).flat(),
    ];
  }
}
