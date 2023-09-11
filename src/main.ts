import { NestFactory } from '@nestjs/core';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from 'app.module';
import { PrismaService } from 'prisma/prisma.service';
import { ConfigService } from 'config/config.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { API_TAG_INTERNAL } from 'common/constants';

const logger = new Logger('main');

const initSwagger = (app: INestApplication) => {
  const filterOutPathByTag = (tag: string) => (path: string) => {
    const paths = publicDocument.paths[path];
    publicDocument.paths[path] = Object.keys(paths)
      .filter(method => {
        const pathMethod = paths[method];
        return !pathMethod.tags?.includes(tag);
      })
      .reduce((acc, method) => {
        acc[method] = paths[method];
        return acc;
      }, {});
    return true;
  };

  const internalOptions = new DocumentBuilder()
    .setTitle('Poly Server API (internal)')
    .setDescription('API description')
    .setVersion('1.0')
    .addBearerAuth({ name: 'Authorization', in: 'header', type: 'http', description: 'API Key', scheme: 'bearer' }, 'PolyApiKey')
    .build();
  const internalDocument = SwaggerModule.createDocument(app, internalOptions);
  SwaggerModule.setup('swagger-internal', app, internalDocument);

  const publicOptions = new DocumentBuilder()
    .setTitle('Poly Server API')
    .setDescription('API description')
    .setVersion('1.0')
    .addBearerAuth({ name: 'Authorization', in: 'header', type: 'http', description: 'API Key', scheme: 'bearer' }, 'PolyApiKey')
    .build();
  const publicDocument = SwaggerModule.createDocument(app, publicOptions);
  publicDocument.paths = Object.keys(publicDocument.paths)
    .filter(filterOutPathByTag(API_TAG_INTERNAL))
    .reduce((acc, path) => {
      acc[path] = publicDocument.paths[path];
      return acc;
    }, {});
  SwaggerModule.setup('swagger', app, publicDocument);
};

// eslint-disable-next-line func-style
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    transform: false,
  }));

  app.useBodyParser('json', { limit: '10mb' });

  const config = app.get(ConfigService);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  if (config.useSwaggerUI) {
    initSwagger(app);
  }

  await app.listen(config.port);
}

bootstrap()
  .then(() => logger.log('Poly Server is ready!'));
