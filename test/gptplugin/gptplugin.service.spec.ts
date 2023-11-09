import { GptPluginService, PluginFunction } from 'gptplugin/gptplugin.service';
import { PrismaService } from 'prisma-module/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { Environment } from '@prisma/client';
import { Request } from 'express';
import { Visibility } from '@poly/model';
import { functionServiceMock, aiServiceMock, authServiceMock } from '../mocks';
import { FunctionService } from 'function/function.service';
import { AiService } from 'ai/ai.service';
import { AuthService } from 'auth/auth.service';

const PLUGIN_CREATE_SPEC: PluginFunction = {
  id: '9d284b9d-c1a0-4d80-955d-9ef79343ddb7',
  operationId: 'createPlugin',
  executePath: '/functions/api/9d284b9d-c1a0-4d80-955d-9ef79343ddb7/execute',
  type: 'apiFunction',
  context: 'polyapi.plugins',
  name: 'create',
  description: 'This API call allows users',
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
  apiType: 'rest',
};

// use these known TEST_PUBLIC_IDS so we can appropriately clear between tests
const TEST_PUBLIC_IDS = ['123', '456'];

// eslint-disable-next-line func-style
function isEnvironment(env: Environment | null): asserts env is Environment {
  if (!env) throw new Error('environment is null!');
}

const createTestEnvironment = async (prisma) => {
  // HACK we should really create an environment instead of clobbering whichever is first
  const env = prisma.environment.findFirst({ orderBy: { id: 'asc' } });
  isEnvironment(env);
  return env;
};

const createPlugin = async function (prisma: PrismaService) {
  const environment = await createTestEnvironment(prisma);
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
};

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
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: AiService,
          useValue: aiServiceMock,
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
    it('should render for an API Function', async () => {
      await createPlugin(prisma);
      // const apiFunc = await _createApiFunction(prisma);
      jest.spyOn(service, 'getAllFunctions').mockReturnValue(new Promise((resolve) => resolve([PLUGIN_CREATE_SPEC])));

      const environment = await createTestEnvironment(prisma);
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
      const path1 = spec.paths[`/functions/api/${PLUGIN_CREATE_SPEC.id}/execute`];
      expect(path1.post.summary).toBe('This API call allows users');
      expect(path1.post.operationId).toBe('createPlugin');

      const bodySchema = spec.components.schemas.createPluginBody;
      expect(bodySchema).toBeTruthy();
    });
  });

  describe('createOrUpdatePlugin', () => {
    it('should succeed with everything', async () => {
      jest.spyOn(service, 'getAllFunctions').mockReturnValue(new Promise((resolve) => resolve([])));
      await prisma.gptPlugin.deleteMany({ where: { slug: 'bad' } });
      const body = {
        slug: 'bad',
        name: 'Bad',
        iconUrl: 'http://example.com/image.png',
        functionIds: [],
        legalUrl: 'http://example.com/legal',
        contactEmail: 'dan@example.com',
      };

      const environment = await createTestEnvironment(prisma);
      const plugin = await service.createOrUpdatePlugin(environment, body);
      expect(plugin.contactEmail).toBe('dan@example.com');
    });

    it('should fail for invalid functionId', async () => {
      jest.spyOn(service, 'getAllFunctions').mockReturnValue(new Promise((resolve) => resolve([])));
      await prisma.gptPlugin.deleteMany({ where: { slug: 'bad' } });
      const body = {
        slug: 'bad',
        name: 'Bad',
        iconUrl: 'http://example.com/image.png',
        functionIds: ['bad'],
      };

      const environment = await createTestEnvironment(prisma);
      try {
        await service.createOrUpdatePlugin(environment, body);
        expect(0).toBe(1); // force error here if no error thrown
      } catch (e) {
        // should start with correct message
        expect(e.message.indexOf('Invalid function')).toBe(0);
      }
    });

    it('should fail for no legal url', async () => {
      jest.spyOn(service, 'getAllFunctions').mockReturnValue(new Promise((resolve) => resolve([])));
      await prisma.gptPlugin.deleteMany({ where: { slug: 'bad' } });
      const body = {
        slug: 'bad',
        name: 'Bad',
        iconUrl: 'http://example.com/image.png',
        functionIds: [],
      };

      const environment = await createTestEnvironment(prisma);
      try {
        await service.createOrUpdatePlugin(environment, body);
        expect(0).toBe(1); // force error here if no error thrown
      } catch (e) {
        // should start with correct message
        expect(e.message.indexOf('Required field legalUrl')).toBe(0);
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
    it('should return the manifest for the environment', async () => {
      const plugin = await createPlugin(prisma);
      const subdomain = (await prisma.environment.findFirstOrThrow({ where: { id: plugin.environmentId } })).subdomain;
      expect(subdomain).toBeTruthy();

      const req = { hostname: `mass-effect-${subdomain}.develop.polyapi.io` } as Request;
      const manifest = await service.getManifest(req);
      expect(manifest.api.url).toBeTruthy();
    });
  });

  describe('chat', () => {
    it('hit the AI servers', async () => {
      const chatMock = aiServiceMock.pluginChat;
      if (!chatMock) {
        throw new Error('should be defined');
      }
      chatMock.mockReturnValue(new Promise((resolve) => resolve('Pong')));

      const apiKey = await prisma.apiKey.findFirst();
      if (!apiKey) {
        throw new Error('need an api key');
      }

      const hashMock = authServiceMock.hashApiKey;
      if (!hashMock) {
        throw new Error('should be defined!');
      }
      hashMock.mockReturnValue(new Promise((resolve) => resolve(apiKey.key)));

      const environment = await createTestEnvironment(prisma);
      const plugin = await createPlugin(prisma);
      const authData = {
        key: apiKey.key,
        user: { id: apiKey.userId },
        applicationId: { id: apiKey.applicationId },
        environment,
      };
      const convoSlug = 'foobar123';
      // ignore the type for authData, we have all we need in the mock
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const resp = await service.chat(authData, plugin.slug, convoSlug, 'hello world');

      expect(chatMock).toHaveBeenCalledTimes(1);
      expect(hashMock).toHaveBeenCalledTimes(1);

      const newConvo = await prisma.conversation.findFirst({ where: { slug: convoSlug } });
      if (!newConvo) {
        throw new Error('no new convo, test fail');
      }
      expect(newConvo.applicationId).toBe(apiKey.applicationId);
      expect(newConvo.userId).toBe(apiKey.userId);
      expect(newConvo.slug).toBe(convoSlug);
      expect(resp).toBe('Pong');
    });
  });
});
