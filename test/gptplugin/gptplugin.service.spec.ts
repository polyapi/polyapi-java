import { GptPluginService, PluginFunction } from 'gptplugin/gptplugin.service';
import { PrismaService } from 'prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { Environment } from '@prisma/client';
import { Request } from 'express';
import { Visibility } from '@poly/model';
import { functionServiceMock, httpServiceMock } from '../mocks';
import { FunctionService } from 'function/function.service';
import { HttpService } from '@nestjs/axios';

const PLUGIN_CREATE_SPEC: PluginFunction = {
  id: '9d284b9d-c1a0-4d80-955d-9ef79343ddb7',
  operationId: 'createPlugin',
  executePath: 'foobar',
  type: 'apiFunction',
  context: 'polyapi.plugins',
  name: 'create',
  description:
    "This API call allows users to create a new plugin on Poly API. The request payload includes the name, slug, icon URL, and descriptions for the model and marketplace. Additionally, users can specify which functions to include in the plugin. The response payload includes the newly created plugin's ID, slug, name, descriptions, icon URL, and function IDs. The plugin URL is also returned for easy access to the newly created plugin.",
  function: {
    arguments: [
      {
        name: 'payload',
        required: true,
        type: {
          kind: 'object',
          properties: [
            {
              name: 'pluginName',
              required: true,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
            {
              name: 'pluginSlug',
              required: true,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
            {
              name: 'pluginIconUrl',
              required: true,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
            {
              name: 'pluginDescForAI',
              required: true,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
            {
              name: 'pluginDescForUser',
              required: true,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
            {
              name: 'pluginFunctions',
              required: true,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
          ],
        },
      },
    ],
    returnType: {
      kind: 'object',
      schema: {
        $schema: 'http://json-schema.org/draft-06/schema#',
        definitions: {
          Plugin: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: {
                type: 'integer',
              },
              slug: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
              descriptionForMarketplace: {
                type: 'string',
              },
              descriptionForModel: {
                type: 'string',
              },
              iconUrl: {
                type: 'string',
                format: 'uri',
                'qt-uri-protocols': ['https'],
                'qt-uri-extensions': ['.png'],
              },
              functionIds: {
                type: 'string',
              },
            },
            required: [
              'descriptionForMarketplace',
              'descriptionForModel',
              'functionIds',
              'iconUrl',
              'id',
              'name',
              'slug',
            ],
            title: 'Plugin',
          },
        },
        type: 'object',
        additionalProperties: false,
        properties: {
          plugin: {
            $ref: '#/definitions/Plugin',
          },
          plugin_url: {
            type: 'string',
            format: 'uri',
            'qt-uri-protocols': ['https'],
          },
        },
        required: ['plugin', 'plugin_url'],
        title: 'ReturnType',
      },
    },
  },
  visibilityMetadata: {
    visibility: Visibility.Environment,
  },
};

// use these known TEST_PUBLIC_IDS so we can appropriately clear between tests
const TEST_PUBLIC_IDS = ['123', '456'];

function isEnvironment(env: Environment | null): asserts env is Environment {
  if (!env) throw new Error('environment is null!');
}

async function _createTestEnvironment(prisma) {
  // HACK we should really create an environment instead of clobbering whichever is first
  const env = prisma.environment.findFirst({ orderBy: { id: 'asc' } });
  isEnvironment(env);
  return env;
}

async function _createApiFunction(prisma: PrismaService) {
  const environment = await _createTestEnvironment(prisma);

  const defaults = {
    id: '123',
    environmentId: environment.id,
    name: 'twilio.sendSms',
    context: 'comms.messaging',
    description: 'send a text message',
    method: 'GET',
    url: 'http://example.com/twilio',
    body: '{"mode":"urlencoded","urlencoded":[{"key":"To","value":"{{phone}}"},{"key":"From","value":"+17622396902"},{"key":"Body","value":"{{message}}"}]}',
    response:
      '{"body":"orale vato","num_segments":"1","direction":"outbound-api","from":"+17622396902","date_updated":"Tue, 21 Mar 2023 12:34:03 +0000","price":null,"error_message":null,"uri":"/2010-04-01/Accounts/ACe562bccbc410295451a07d40747eb10b/Messages/SM899acf9f2afdf9d8ca62a54fa4e29578.json","account_sid":"ACe562bccbc410295451a07d40747eb10b","num_media":"0","to":"+16504859634","date_created":"Tue, 21 Mar 2023 12:34:03 +0000","status":"queued","sid":"SM899acf9f2afdf9d8ca62a54fa4e29578","date_sent":null,"messaging_service_sid":null,"error_code":null,"price_unit":"USD","api_version":"2010-04-01","subresource_uris":{"media":"/2010-04-01/Accounts/ACe562bccbc410295451a07d40747eb10b/Messages/SM899acf9f2afdf9d8ca62a54fa4e29578/Media.json"}}',
  };
  return prisma.apiFunction.upsert({
    where: { id: '123' },
    update: defaults,
    create: defaults,
  });
}

async function _createServerFunction(prisma: PrismaService) {
  const environment = await _createTestEnvironment(prisma);

  const defaults = {
    id: '456',
    environmentId: environment.id,
    name: 'sendProductUrlInSms',
    context: 'products.shopify',
    description: 'take a product ID and phone number',
    arguments: '[{"name":"productId","type":"number"},{"name":"phoneNumber","type":"string"}]',
    returnType: 'Promise<void>',
    code: 'dummy',
    serverSide: true,
  };
  return prisma.customFunction.upsert({
    where: { id: '456' },
    update: defaults,
    create: defaults,
  });
}

async function _createPlugin(prisma: PrismaService) {
  const environment = await _createTestEnvironment(prisma);
  const defaults = {
    name: 'Mass Effect',
    iconUrl: 'http://example.com/image.png',
    functionIds: '["123", "456"]',
  };
  return prisma.gptPlugin.upsert({
    where: { slug_environmentId: { slug: 'mass-effect', environmentId: environment.id } },
    update: defaults,
    create: {
      slug: 'mass-effect',
      environmentId: environment.id,
      ...defaults,
    },
  });
}

describe('GptPluginService', () => {
  const prisma = new PrismaService();
  let service: GptPluginService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GptPluginService,
        PrismaService,
        {
          provide: FunctionService,
          useValue: functionServiceMock,
        },
        {
          provide: HttpService,
          useValue: httpServiceMock,
        },
      ],
    }).compile();

    service = await module.get(GptPluginService);

    // mock the template path so we are sure to test src template, not built dist template
    jest.spyOn(service, 'getTemplatePath').mockReturnValue(`${process.cwd()}/src/gptplugin/templates/openapi.json.hbs`);

    // clear all functions between tests
    await Promise.all([
      prisma.apiFunction.deleteMany({ where: { id: { in: TEST_PUBLIC_IDS } } }),
      prisma.customFunction.deleteMany({ where: { id: { in: TEST_PUBLIC_IDS } } }),
    ]);
  });

  describe('getOpenApiSpec', () => {
    it.skip('should render for an API Function', async () => {
      await _createPlugin(prisma);
      const apiFunc = await _createApiFunction(prisma);

      const environment = await _createTestEnvironment(prisma);
      const specStr = await service.getOpenApiSpec(
        `mass-effect-${environment.subdomain}.develop.polyapi.io`,
        'mass-effect',
      );

      const spec = JSON.parse(specStr);

      // write specStr to file for debugging
      // fs.writeFileSync('/tmp/spec.json', specStr, 'utf8');
      // console.log('file written to /tmp/spec.json');

      expect(spec.openapi).toBe('3.0.1');
      expect(spec.info.title).toBe('Mass Effect');
      expect(spec.servers[0].url).toBe(`https://mass-effect-${environment.subdomain}.develop.polyapi.io`);

      expect(Object.keys(spec.paths).length).toBe(1);
      const path1 = spec.paths[`/functions/api/${apiFunc.id}/execute`];
      expect(path1.post.summary).toBe('send a text message');
      expect(path1.post.operationId).toBe('commsMessagingTwilioSendSms');

      const bodySchema = spec.components.schemas.commsMessagingTwilioSendSmsBody;
      expect(bodySchema).toBeTruthy();

      // TODO run openapi spec validator in tests?
    });

    it.skip('should render for a Server Function', async () => {
      await _createPlugin(prisma);
      const serverFunc = await _createServerFunction(prisma);

      const environment = await _createTestEnvironment(prisma);
      const specStr = await service.getOpenApiSpec(
        `mass-effect-${environment.subdomain}.develop.polyapi.io`,
        'mass-effect',
      );

      const spec = JSON.parse(specStr);

      expect(Object.keys(spec.paths).length).toBe(1);
      const path1 = spec.paths[`/functions/server/${serverFunc.id}/execute`];
      expect(path1.post.summary).toBe('take a product ID and phone number');
      expect(path1.post.operationId).toBe('productsShopifySendProductUrlInSms');

      const bodySchema = spec.components.schemas.productsShopifySendProductUrlInSmsBody;
      expect(bodySchema).toBeTruthy();

      // TODO run openapi spec validator in tests?
    });

    it.skip('should fail for invalid functionId', async () => {
      const body = {
        slug: 'bad',
        name: 'Bad',
        iconUrl: 'http://example.com/image.png',
        functionIds: ['bad'],
      };

      const environment = await _createTestEnvironment(prisma);
      try {
        await service.createOrUpdatePlugin(environment, body);
        expect(0).toBe(1); // force error here if no error thrown
      } catch (e) {
        // should start with correct message
        expect(e.message.indexOf('Invalid function')).toBe(0);
      }
    });
  });

  describe('getBodySchema', () => {
    it('should return the right args', () => {
      const out = service.getBodySchema(PLUGIN_CREATE_SPEC);
      expect(out).toBeTruthy();
    });
  });

  describe('getOpenApiUrl', () => {
    it('should return the right url for the environment', async () => {
      const url = service.getOpenApiUrl('mass-effect.polyapi.io', 'mass-effect');
      expect(url).toBe('https://mass-effect.polyapi.io/plugins/mass-effect/openapi');
    });
  });

  describe('getOpenApiUrl develop', () => {
    it('should return a special case for develop', async () => {
      const url = service.getOpenApiUrl('develop.polyapi.io', 'develop');
      expect(url).toBe('https://develop.polyapi.io/openapi-develop.yaml');
    });
  });

  describe('getManifest', () => {
    it.skip('should return the manifest for the environment', async () => {
      const plugin = await _createPlugin(prisma);
      const subdomain = (await prisma.environment.findFirstOrThrow({ where: { id: plugin.environmentId } })).subdomain;
      expect(subdomain).toBeTruthy();

      const req = { hostname: `mass-effect-${subdomain}.develop.polyapi.io` } as Request;
      const manifest = await service.getManifest(req);
      expect(manifest.api.url).toBeTruthy();
    });
  });
});
