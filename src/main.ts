import { NestFactory } from '@nestjs/core';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from 'app.module';
import { PrismaService } from 'prisma/prisma.service';
import { ConfigService } from 'config/config.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';

const logger = new Logger('main');

const initSwagger = (app: INestApplication) => {
  const options = new DocumentBuilder()
    .setTitle('Poly Server API')
    .setDescription('API description')
    .setVersion('1.0')
    .addBearerAuth({ name: 'Authorization', in: 'header', type: 'http', description: 'API Key', scheme: 'bearer' }, 'PolyApiKey')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('swagger', app, document);
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    transform: false,
  }));

  app.useBodyParser('json', { limit: '3mb' });

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
