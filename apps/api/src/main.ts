import './config/load-env';
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@subloop/shared';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { env, envList, envNumber } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser());

  // Strict CORS allowlist: only the configured web origins may call the API.
  app.enableCors({
    origin: envList('WEB_ORIGINS', ['http://localhost:3000']),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SubLoop API')
    .setDescription('Subscription management for Brightloop Software')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // 3001 by default: matches NEXT_PUBLIC_API_URL in .env.example and the web app.
  const port = envNumber('PORT', 3001);
  await app.listen(port, '0.0.0.0');

  Logger.log(`SubLoop API listening on http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
  Logger.log(`OpenAPI docs at http://localhost:${port}/api/docs`, 'Bootstrap');
  Logger.log(`CORS origins: ${env('WEB_ORIGINS', 'http://localhost:3000')}`, 'Bootstrap');
}

void bootstrap();
