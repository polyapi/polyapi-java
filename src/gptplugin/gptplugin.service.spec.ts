import fs from 'fs';
import { GptPluginService } from './gptplugin.service';
import { PrismaService } from 'prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { GptPluginModule } from './gptplugin.module';

// use these known TEST_PUBLIC_IDS so we can appropriately clear between tests
const TEST_PUBLIC_IDS = ['123', '456'];

async function _createApiFunction(prisma: PrismaService) {
  const user = await prisma.user.findFirst();

  const defaults = {
    name: 'twilio.sendSms',
    context: 'comms.messaging',
    userId: user ? user.id : 1,
    description: 'send a text message',
    method: 'GET',
    url: 'http://example.com/twilio',
    publicId: '123',
    body: '{"mode":"urlencoded","urlencoded":[{"key":"To","value":"{{phone}}"},{"key":"From","value":"+17622396902"},{"key":"Body","value":"{{message}}"}]}',
    response:
      '{"body":"orale vato","num_segments":"1","direction":"outbound-api","from":"+17622396902","date_updated":"Tue, 21 Mar 2023 12:34:03 +0000","price":null,"error_message":null,"uri":"/2010-04-01/Accounts/ACe562bccbc410295451a07d40747eb10b/Messages/SM899acf9f2afdf9d8ca62a54fa4e29578.json","account_sid":"ACe562bccbc410295451a07d40747eb10b","num_media":"0","to":"+16504859634","date_created":"Tue, 21 Mar 2023 12:34:03 +0000","status":"queued","sid":"SM899acf9f2afdf9d8ca62a54fa4e29578","date_sent":null,"messaging_service_sid":null,"error_code":null,"price_unit":"USD","api_version":"2010-04-01","subresource_uris":{"media":"/2010-04-01/Accounts/ACe562bccbc410295451a07d40747eb10b/Messages/SM899acf9f2afdf9d8ca62a54fa4e29578/Media.json"}}',
  };
  return prisma.apiFunction.upsert({
    where: { publicId: '123' },
    update: defaults,
    create: defaults,
  });
}

async function _createCustomFunction(prisma: PrismaService) {
  const user = await prisma.user.findFirst();

  const defaults = {
    name: 'sendProductUrlInSms',
    context: 'products.shopify',
    userId: user ? user.id : 1,
    description: 'take a product ID and phone number',
    publicId: '123',
    arguments: '[{"name":"productId","type":"number"},{"name":"phoneNumber","type":"string"}]',
    returnType: 'Promise<void>',
    code: 'dummy',
  };
  return prisma.customFunction.upsert({
    where: { publicId: '123' },
    update: defaults,
    create: defaults,
  });
}

async function _createPlugin(prisma: PrismaService) {
  const defaults = {
    name: 'Mass Effect',
    iconUrl: 'http://example.com/image.png',
    functionIds: '["123", "456"]',
  };
  return prisma.gptPlugin.upsert({
    where: { slug: 'mass-effect' },
    update: defaults,
    create: {
      slug: 'mass-effect',
      ...defaults,
    },
  });
}

describe('GptPluginService', () => {
  const prisma = new PrismaService();
  let service: GptPluginService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [GptPluginModule],
    }).compile();

    service = await module.get(GptPluginService);

    // mock the template path so we are sure to test src template, not built dist template
    jest.spyOn(service, 'getTemplatePath').mockReturnValue(`${process.cwd()}/src/gptplugin/templates/openapi.json.hbs`);

    // clear all functions between tests
    await Promise.all([
      prisma.apiFunction.deleteMany({ where: { publicId: { in: TEST_PUBLIC_IDS } } }),
      prisma.customFunction.deleteMany({ where: { publicId: { in: TEST_PUBLIC_IDS } } }),
    ]);
  });

  describe('getOpenApiSpec', () => {
    it('should render for an API Function', async () => {
      await _createPlugin(prisma);
      const apiFunc = await _createApiFunction(prisma);

      const specStr = await service.getOpenApiSpec('mass-effect.develop.polyapi.io', 'mass-effect');

      const spec = JSON.parse(specStr);

      expect(spec.openapi).toBe('3.0.1');
      expect(spec.info.title).toBe('Mass Effect');
      expect(spec.servers[0].url).toBe('https://mass-effect.develop.polyapi.io');

      expect(Object.keys(spec.paths).length).toBe(1);
      const path1 = spec.paths[`/functions/api/${apiFunc.publicId}/execute`];
      expect(path1.post.summary).toBe('send a text message');
      expect(path1.post.operationId).toBe('commsMessagingTwilioSendSms');

      const bodySchema = spec.components.schemas.commsMessagingTwilioSendSmsBody;
      expect(bodySchema).toBeTruthy();

      // TODO run openapi spec validator in tests?
    });

    it('should render for a Custom Function', async () => {
      await _createPlugin(prisma);
      const customFunc = await _createCustomFunction(prisma);

      const specStr = await service.getOpenApiSpec('mass-effect.develop.polyapi.io', 'mass-effect');

      // write specStr to file for debugging
      fs.writeFileSync('/tmp/spec.json', specStr, 'utf8')
      console.log("file written to /tmp/spec.json")

      const spec = JSON.parse(specStr);

      expect(Object.keys(spec.paths).length).toBe(1);
      const path1 = spec.paths[`/functions/server/${customFunc.publicId}/execute`];
      expect(path1.post.summary).toBe('take a product ID and phone number');
      expect(path1.post.operationId).toBe('productsShopifySendProductUrlInSms');

      const bodySchema = spec.components.schemas.productsShopifySendProductUrlInSmsBody;
      expect(bodySchema).toBeTruthy();

      // TODO run openapi spec validator in tests?
    });

    it('should fail for invalid functionId', async () => {
      const body = {
        slug: 'bad',
        name: 'Bad',
        iconUrl: 'http://example.com/image.png',
        functionIds: ['bad'],
      };

      try {
        await service.createPlugin(body);
        expect(0).toBe(1); // force error here if no error thrown
      } catch (e) {
        // should start with correct message
        expect(e.message.indexOf('Invalid function')).toBe(0);
      }
    });
  });

  describe('getOpenApiUrl', () => {
    it('should return the right url for the environment', async () => {
      const url = service.getOpenApiUrl('mass-effect.polyapi.io', 'mass-effect');
      expect(url).toBe('https://mass-effect.polyapi.io/plugin/mass-effect/openapi');
    });
  });

  describe('getManifest', () => {
    it('should return the manifest for the environment', async () => {
      const url = service.getOpenApiUrl('develop.polyapi.io', 'develop');
      expect(url).toBe('https://develop.polyapi.io/openapi-develop.yaml');
    });
  });
});
