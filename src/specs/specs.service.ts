import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { FunctionService } from 'function/function.service';
import { WebhookService } from 'webhook/webhook.service';
import { AuthProviderService } from 'auth-provider/auth-provider.service';
import { ConfigVariableName, PublicVisibilityValue, Specification, SpecificationPath, Visibility, VisibilityQuery } from '@poly/model';
import { toCamelCase } from '@guanghechen/helper-string';
import { ApiFunction, AuthProvider, CustomFunction, Environment, Tenant, Variable, WebhookHandle } from '@prisma/client';
import { VariableService } from 'variable/variable.service';
import { CommonService } from 'common/common.service';
import { ConfigVariableService } from 'config-variable/config-variable.service';
import { WithTenant } from 'common/types';

@Injectable()
export class SpecsService {
  private logger: Logger = new Logger(SpecsService.name);

  constructor(
    private readonly commonService: CommonService,
    @Inject(forwardRef(() => FunctionService))
    private readonly functionService: FunctionService,
    @Inject(forwardRef(() => WebhookService))
    private readonly webhookService: WebhookService,
    @Inject(forwardRef(() => AuthProviderService))
    private readonly authProviderService: AuthProviderService,
    @Inject(forwardRef(() => VariableService))
    private readonly variableService: VariableService,
    private readonly configVariableService: ConfigVariableService,
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

    const visibilityQuery: VisibilityQuery = {
      includePublic: true,
      tenantId,
    };

    const [apiFunctions, customFunctions, webhookHandles, authProviders] = await Promise.all([
      this.functionService.getApiFunctions(environmentId, contexts, names, ids, visibilityQuery, true),
      this.functionService.getCustomFunctions(environmentId, contexts, names, ids, visibilityQuery, true),
      this.webhookService.getWebhookHandles(environmentId, contexts, names, ids, visibilityQuery, true),
      this.authProviderService.getAuthProviders(environmentId, contexts, ids, visibilityQuery, true),
    ]) as [
      WithTenant<ApiFunction>[],
      WithTenant<CustomFunction>[],
      WithTenant<WebhookHandle>[],
      WithTenant<AuthProvider>[]
    ];
    const {
      defaultHidden = false,
      visibleContexts = null,
    } = await this.configVariableService.getEffectiveValue<PublicVisibilityValue>(
      ConfigVariableName.PublicVisibility,
      tenantId,
      environmentId,
    ) || {};

    const filterByPublicVisibility = <T extends {
      context: string | null,
      environment: {
        tenant: Tenant
      },
      visibility: string
    }>(entities: T[]): T[] => {
      return entities.filter(entity => {
        if (entity.visibility !== Visibility.Public) {
          return true;
        }

        if (tenantId && entity.environment.tenant.id === tenantId) {
          return true;
        }

        return this.commonService.isPublicVisibilityAllowed(entity, defaultHidden, visibleContexts);
      });
    };

    const getApiFunctionsSpecifications = async () => {
      return await Promise.all(
        filterByPublicVisibility(apiFunctions)
          .map(async apiFunction =>
            await this.updateWithAdditionalData(
              tenantId,
              apiFunction as any,
              await this.functionService.toApiFunctionSpecification(apiFunction)),
          ),
      );
    };

    const getCustomFunctionsSpecifications = async () => {
      return await Promise.all(
        filterByPublicVisibility(customFunctions)
          .map(async customFunction =>
            await this.updateWithAdditionalData(
              tenantId,
              customFunction as any,
              await this.functionService.toCustomFunctionSpecification(customFunction)),
          ),
      );
    };

    const getWebhookHandlesSpecifications = async () => {
      return await Promise.all(
        filterByPublicVisibility(webhookHandles)
          .map(async webhookHandle =>
            await this.updateWithAdditionalData(
              tenantId,
              webhookHandle as any,
              await this.webhookService.toWebhookHandleSpecification(webhookHandle)),
          ),
      );
    };

    const getAuthProvidersSpecifications = async () => {
      return (
        await Promise.all(
          filterByPublicVisibility(authProviders)
            .map(async authProvider => {
              const specifications = await this.authProviderService.toAuthFunctionSpecifications(authProvider, names);
              return await Promise.all(
                specifications.map(async specification =>
                  await this.updateWithAdditionalData(
                    tenantId,
                    authProvider as any,
                    specification,
                  ),
                ));
            }),
        )
      ).flat();
    };

    const getServerVariablesSpecifications = async () => {
      const serverVariables = await this.variableService.getAll(environmentId, contexts, names, ids, visibilityQuery, true) as WithTenant<Variable>[];
      return await Promise.all(
        filterByPublicVisibility(serverVariables)
          .map(async serverVariable =>
            await this.updateWithAdditionalData(
              tenantId,
            serverVariable as any,
            await this.variableService.toServerVariableSpecification(serverVariable)),
          ),
      );
    };

    const [apiFunctionSpecifications, customFunctionSpecifications, webhookHandleSpecifications, authProviderSpecifications, serverVariableSpecifications] = await Promise.all([
      getApiFunctionsSpecifications(),
      getCustomFunctionsSpecifications(),
      getWebhookHandlesSpecifications(),
      getAuthProvidersSpecifications(),
      getServerVariablesSpecifications(),
    ]);

    return [
      ...apiFunctionSpecifications,
      ...customFunctionSpecifications,
      ...webhookHandleSpecifications,
      ...authProviderSpecifications,
      ...serverVariableSpecifications,
    ].sort(this.sortSpecifications);
  }

  private async updateWithAdditionalData(
    tenantId: string | null,
    tenantEntity: {
      environment: Environment & {
        tenant: Tenant
      }
    },
    specification: Specification,
  ): Promise<Specification> {
    specification = this.updateWithVisibilityMetadata(tenantId, specification, tenantEntity);
    specification = this.updateWithPublicNamespace(tenantId, specification, tenantEntity);

    return specification;
  }

  private updateWithVisibilityMetadata(
    tenantId: string | null,
    specification: Specification,
    tenantEntity: {
      environment?: Environment & {
        tenant?: Tenant
      }
    }): Specification {
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

  private updateWithPublicNamespace(
    tenantId: string | null,
    specification: Specification,
    tenantEntity: {
      environment: Environment & {
        tenant: Tenant
      }
    }): Specification {
    if (!tenantId || specification.visibilityMetadata.visibility !== Visibility.Public || !tenantEntity.environment.tenant.publicNamespace) {
      return specification;
    }

    return {
      ...specification,
      context: `${tenantEntity.environment.tenant.publicNamespace}${specification.context ? `.${specification.context}` : ''}`,
    };
  }

  private sortSpecifications(a: Specification, b: Specification): number {
    if (a.visibilityMetadata.visibility === Visibility.Public && b.visibilityMetadata.visibility !== Visibility.Public) {
      return -1;
    } else if (a.visibilityMetadata.visibility !== Visibility.Public && b.visibilityMetadata.visibility === Visibility.Public) {
      return 1;
    } else if (a.visibilityMetadata.visibility === Visibility.Tenant && b.visibilityMetadata.visibility !== Visibility.Tenant) {
      return -1;
    } else if (a.visibilityMetadata.visibility !== Visibility.Tenant && b.visibilityMetadata.visibility === Visibility.Tenant) {
      return 1;
    } else {
      return 0;
    }
  }
}
