import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from 'app.module';
import { PrismaService } from 'prisma/prisma.service';
import { ConfigService } from 'config/config.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const initSwagger = (app: INestApplication) => {
  const options = new DocumentBuilder()
    .setTitle('Poly Server API')
    .setDescription('API description')
    .setVersion('1.0')
    .addApiKey({name: 'X-PolyApiKey', in: 'header', type: 'apiKey', description: 'API Key'})
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('swagger', app, document);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    transform: false,
  }));

  const config = app.get(ConfigService);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  if (config.useSwaggerUI) {
    initSwagger(app);
  }

  await app.listen(config.port);
}

void bootstrap();
