import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';
import { resolveBackendOrigin, resolveFrontendOrigin } from './common/config/origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // ===== SECURITY HEADERS =====
  app.use(helmet());

  // ===== REQUEST SIZE LIMITS =====
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // ===== CORS WHITELIST =====
  const port = configService.get<number>('PORT', 3000);
  const allowedOrigins = [resolveFrontendOrigin(configService), resolveBackendOrigin(configService)];

  app.enableCors({
    origin: allowedOrigins,        // Whitelist: Frontend + Backend self
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Key'],
  });

  // ===== ENHANCED VALIDATION =====
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Strip unknown properties
      transform: true,              // Auto-transform types
      forbidNonWhitelisted: true,   // Throw on unknown properties
    }),
  );

  // ===== SWAGGER DOCUMENTATION =====
  const config = new DocumentBuilder()
    .setTitle('NestJS Backend API')
    .setDescription('API documentation for fullstack boilerplate')
    .setVersion('1.0')
    .addTag('api', 'Core API endpoints')
    .addTag('urls', 'URL shortener endpoints')
    .addApiKey(
      { type: 'apiKey', name: 'X-Service-Key', in: 'header' },
      'service-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/', app, document, {
    customSiteTitle: 'Backend API Documentation',
    customfavIcon: 'https://nestjs.com/favicon.ico',
  });

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
