import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // ===== SECURITY HEADERS =====
  app.use(helmet());

  // ===== REQUEST SIZE LIMITS =====
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // ===== CORS WHITELIST =====
  const frontendOrigin = configService.get<string>('FRONTEND_ORIGIN', 'http://localhost:3001');
  const port = configService.get<number>('PORT', 3000);

  // Backend origin: automatically detect based on deployment platform
  // Vercel: VERCEL_URL (e.g., 'my-app-abc123.vercel.app')
  // Render: RENDER_EXTERNAL_URL (e.g., 'https://my-app.onrender.com')
  // Railway: RAILWAY_PUBLIC_DOMAIN (e.g., 'my-app.railway.app')
  // Development: http://localhost:PORT
  let backendOrigin: string;
  const vercelUrl = configService.get<string>('VERCEL_URL');
  const renderUrl = configService.get<string>('RENDER_EXTERNAL_URL');
  const railwayDomain = configService.get<string>('RAILWAY_PUBLIC_DOMAIN');

  if (renderUrl) {
    // Render provides full URL with protocol
    backendOrigin = renderUrl;
  } else if (vercelUrl) {
    backendOrigin = `https://${vercelUrl}`;
  } else if (railwayDomain) {
    backendOrigin = `https://${railwayDomain}`;
  } else {
    backendOrigin = `http://localhost:${port}`;
  }

  const allowedOrigins = [frontendOrigin, backendOrigin];

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
