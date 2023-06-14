import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { FunctionService } from 'function/function.service';
import { WebhookService } from 'webhook/webhook.service';
import { AuthProviderService } from 'auth-provider/auth-provider.service';
import { Specification, SpecificationPath, Visibility } from '@poly/common';
import { toCamelCase } from '@guanghechen/helper-string';
import { Environment, Tenant } from '@prisma/client';

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

  async getSpecifications(environmentId: string, tenantId: string | null = null, contexts?: string[], names?: string[], ids?: string[]): Promise<Specification[]> {
    this.logger.debug(`Getting specifications for environment ${environmentId} with contexts ${contexts}, names ${names}, and ids ${ids}`);

    const getApiFunctionsSpecifications = async () => {
      const apiFunctions = await this.functionService.getApiFunctions(environmentId, contexts, names, ids, true, true);
      return await Promise.all(
        apiFunctions.map(async apiFunction =>
          await this.fillMetadata(
            tenantId,
            apiFunction as any,
            await this.functionService.toApiFunctionSpecification(apiFunction)),
        ),
      );
    };

    const getCustomFunctionsSpecifications = async () => {
      const customFunctions = await this.functionService.getCustomFunctions(environmentId, contexts, names, ids, true, true);
      return await Promise.all(
        customFunctions.map(async customFunction =>
          await this.fillMetadata(
            tenantId,
            customFunction as any,
            await this.functionService.toCustomFunctionSpecification(customFunction)),
        ),
      );
    };

    const getWebhookHandlesSpecifications = async () => {
      const webhookHandles = await this.webhookService.getWebhookHandles(environmentId, contexts, names, ids, true, true);
      return await Promise.all(
        webhookHandles.map(async webhookHandle =>
          await this.fillMetadata(
            tenantId,
            webhookHandle as any,
            await this.webhookService.toWebhookHandleSpecification(webhookHandle)),
        ),
      );
    };

    const getAuthProvidersSpecifications = async () => {
      const authProviders = await this.authProviderService.getAuthProviders(environmentId, contexts, ids, true, true);
      return (
        await Promise.all(
          authProviders.map(async authProvider => {
            const specifications = await this.authProviderService.toAuthFunctionSpecifications(authProvider, names);
            return await Promise.all(
              specifications.map(async specification =>
                await this.fillMetadata(
                  tenantId,
                  authProvider as any,
                  specification,
                ),
              ));
          }),
        )
      ).flat();
    };

    return [
      ...(await getApiFunctionsSpecifications()),
      ...(await getCustomFunctionsSpecifications()),
      ...(await getWebhookHandlesSpecifications()),
      ...(await getAuthProvidersSpecifications()),
    ].sort(this.sortSpecifications);
  }

  private async fillMetadata(
    tenantId: string | null,
    tenantEntity: { environment: Environment & { tenant: Tenant } },
    specification: Specification,
  ): Promise<Specification> {
    specification = this.fillVisibilityMetadata(tenantId, specification, tenantEntity);

    return specification;
  }

  private fillVisibilityMetadata(
    tenantId: string | null,
    specification: Specification,
    tenantEntity: { environment?: Environment & { tenant?: Tenant } }): Specification {
    if (!tenantId || specification.visibilityMetadata.visibility !== Visibility.Public || !tenantEntity.environment?.tenant) {
      return specification;
    }

    return {
      ...specification,
      visibilityMetadata: {
        ...specification.visibilityMetadata,
        foreignTenantName: tenantEntity.environment.tenantId !== tenantId
          ? tenantEntity.environment.tenant.name
          : undefined,
      },
    };
  }

  private sortSpecifications(a: Specification, b: Specification): number {
    if (a.visibilityMetadata.visibility === Visibility.Public && b.visibilityMetadata.visibility !== Visibility.Public) {
      return -1;
    } else if (a.visibilityMetadata.visibility !== Visibility.Public && b.visibilityMetadata.visibility === Visibility.Public) {
      return 1;
    } else {
      return 0;
    }
  }
}
