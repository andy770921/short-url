import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { Request, Response } from 'express';

let app: NestExpressApplication;

async function bootstrap() {
  if (!app) {
    try {
      app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: ['error', 'warn', 'log'],
      });

      app.enableCors({
        origin: true,
        credentials: true,
      });

      // Global validation pipe (same as main.ts)
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

      // Swagger configuration
      const config = new DocumentBuilder()
        .setTitle('NestJS Backend API')
        .setDescription('API documentation for fullstack boilerplate')
        .setVersion('1.0')
        .addTag('api', 'Core API endpoints')
        .addTag('urls', 'URL shortener endpoints')
        .build();

      const document = SwaggerModule.createDocument(app, config);

      // Setup Swagger on root path for Vercel deployment
      SwaggerModule.setup('/', app, document, {
        customSiteTitle: 'Backend API Documentation',
        customfavIcon: 'https://nestjs.com/favicon.ico',
      });

      await app.init();
    } catch (error) {
      console.error('Failed to initialize NestJS app:', error);
      throw error;
    }
  }
  return app;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await bootstrap();
    const expressApp = app.getHttpAdapter().getInstance();
    return expressApp(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
