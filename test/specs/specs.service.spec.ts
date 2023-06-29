import { Test } from '@nestjs/testing';
import { SpecsService } from 'specs/specs.service';
import { FunctionService } from 'function/function.service';
import { mockedAuthData } from '../utils/test-utils';
import { WebhookService } from 'webhook/webhook.service';
import { AuthProviderService } from 'auth-provider/auth-provider.service';
import { ApiFunction, AuthProvider, CustomFunction, Variable, WebhookHandle } from '@prisma/client';
import { createMock } from '@golevelup/ts-jest';
import {
  ApiFunctionSpecification,
  AuthFunctionSpecification,
  CustomFunctionSpecification, ServerVariableSpecification,
  Specification,
  Visibility,
  WebhookHandleSpecification,
} from '@poly/model';

import { functionServiceMock, webhookServiceMock, authProviderServiceMock, variableServiceMock } from '../mocks';
import { resetMocks } from '../mocks/utils';
import { VariableService } from 'variable/variable.service';

describe('SpecsService', () => {
  let specsService: SpecsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SpecsService,
        {
          provide: FunctionService,
          useValue: functionServiceMock,
        },
        {
          provide: WebhookService,
          useValue: webhookServiceMock,
        },
        {
          provide: AuthProviderService,
          useValue: authProviderServiceMock,
        },
        {
          provide: VariableService,
          useValue: variableServiceMock,
        },
      ],
    }).compile();

    specsService = moduleRef.get(SpecsService);

    resetMocks(functionServiceMock, webhookServiceMock, authProviderServiceMock);
  });

  describe('getSpecifications()', () => {
    it('Should fetch all functions, webhook handles and auth providers and return specifications from them.', async () => {
      // Setup

      const names = [];
      const contexts = [];
      const ids = [];

      const apiFunctions = createMock<ApiFunction[]>([
        {
          context: 'apiFunctions',
        },
      ]);

      const customFunctions = createMock<CustomFunction[]>([
        {
          context: 'myCustomFunctions',
        },
      ]);

      const webhookHandles = createMock<WebhookHandle[]>([
        {
          context: 'shopify.notifications',
        },
      ]);

      const authProviders = createMock<AuthProvider[]>([
        {
          context: 'auth.login',
        },
      ]);

      const variables = createMock<Variable[]>([
        {
          context: 'variable.var1',
        },
      ]);

      functionServiceMock.getApiFunctions?.mockResolvedValue(apiFunctions);
      functionServiceMock.getCustomFunctions?.mockResolvedValue(customFunctions);
      webhookServiceMock.getWebhookHandles?.mockResolvedValue(webhookHandles);
      authProviderServiceMock.getAuthProviders?.mockResolvedValue(authProviders);
      variableServiceMock.getAll?.mockResolvedValue(variables);

      const apiFunctionSpecification = createMock<ApiFunctionSpecification>({
        context: apiFunctions[0].context,
        visibilityMetadata: {
          visibility: Visibility.Environment,
        },
      });

      const customFunctionSpecification = createMock<CustomFunctionSpecification>({
        context: customFunctions[0].context,
        visibilityMetadata: {
          visibility: Visibility.Environment,
        },
      });

      const webhookHandleSpecification = createMock<WebhookHandleSpecification>({
        context: webhookHandles[0].context,
        visibilityMetadata: {
          visibility: Visibility.Environment,
        },
      });

      const authFunctionSpecifications = createMock<AuthFunctionSpecification[]>([
        {
          context: authProviders[0].context,
          visibilityMetadata: {
            visibility: Visibility.Environment,
          },
        },
      ]);

      const serverVariableSpecification = createMock<ServerVariableSpecification>({
        context: variables[0].context,
        visibilityMetadata: {
          visibility: Visibility.Environment,
        },
      });

      functionServiceMock.toApiFunctionSpecification?.mockResolvedValue(apiFunctionSpecification);

      functionServiceMock.toCustomFunctionSpecification?.mockResolvedValue(customFunctionSpecification);

      webhookServiceMock.toWebhookHandleSpecification?.mockResolvedValue(webhookHandleSpecification);

      authProviderServiceMock.toAuthFunctionSpecifications?.mockResolvedValue(authFunctionSpecifications);

      variableServiceMock.toServerVariableSpecification?.mockResolvedValue(serverVariableSpecification);

      // Action
      const result = await specsService.getSpecifications(mockedAuthData.environment.id, mockedAuthData.tenant.id, contexts, names, ids);

      // Expect
      expect(result).toStrictEqual([
        apiFunctionSpecification,
        customFunctionSpecification,
        webhookHandleSpecification,
        authFunctionSpecifications,
        serverVariableSpecification,
      ]);
    });
  });

  describe('getSpecificationPaths()', () => {
    it('Should get specification paths.', async () => {
      // Setup
      const environmentId = 'foo';
      const firstId = 'b605ea4f-6e3a-4994-9307-25927024954a';
      const secondId = 'b605ea4f-6e3a-4994-9307-25927024954b';
      const getSpecificationsMock = jest.spyOn(specsService, 'getSpecifications');

      getSpecificationsMock.mockResolvedValue(createMock<Specification[]>([
        {
          name: 'foo.bar',
          id: firstId,
        }, {
          name: 'foo.bar',
          context: 'store',
          id: secondId,
        },
      ]));

      // Action
      const result = await specsService.getSpecificationPaths(environmentId);

      // Expect
      expect(getSpecificationsMock).toHaveBeenCalledWith(environmentId);
      expect(result).toStrictEqual([
        {
          id: firstId,
          path: 'fooBar',
        },
        {
          id: secondId,
          path: 'store.fooBar',
        },
      ]);

      // Restore
      getSpecificationsMock.mockRestore();
    });
  });

  describe('sortSpecifications', () => {
    it('should place public specifications at the start', async () => {
      const specifications: Specification[] = [
        createMock<Specification>({
          id: '1',
          visibilityMetadata: {
            visibility: Visibility.Environment,
          },
        }),
        createMock<Specification>({
          id: '2',
          visibilityMetadata: {
            visibility: Visibility.Environment,
          },
        }),
        createMock<Specification>({
          id: '3',
          visibilityMetadata: {
            visibility: Visibility.Public,
          },
        }),
        createMock<Specification>({
          id: '4',
          visibilityMetadata: {
            visibility: Visibility.Environment,
          },
        }),
        createMock<Specification>({
          id: '5',
          visibilityMetadata: {
            visibility: Visibility.Public,
          },
        }),
        createMock<Specification>({
          id: '6',
          visibilityMetadata: {
            visibility: Visibility.Environment,
          },
        }),
      ];

      const sorted = specifications.sort(specsService['sortSpecifications']);

      expect(sorted.map(spec => spec.id)).toEqual(['3', '5', '1', '2', '4', '6']);
    });
  });
});
