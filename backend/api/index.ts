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
      console.log('[Bootstrap] Starting NestJS initialization...');
      console.log('[Bootstrap] Environment:', {
        NODE_ENV: process.env.NODE_ENV,
        HAS_SUPABASE_URL: !!process.env.SUPABASE_URL,
        HAS_SUPABASE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      });

      console.log('[Bootstrap] Creating NestJS application...');
      app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: ['error', 'warn', 'log'],
      });

      console.log('[Bootstrap] Enabling CORS...');
      app.enableCors({
        origin: true,
        credentials: true,
      });

      console.log('[Bootstrap] Setting up global pipes...');
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

      console.log('[Bootstrap] Configuring Swagger...');
      const config = new DocumentBuilder()
        .setTitle('NestJS Backend API')
        .setDescription('API documentation for fullstack boilerplate')
        .setVersion('1.0')
        .addTag('api', 'Core API endpoints')
        .addTag('urls', 'URL shortener endpoints')
        .build();

      console.log('[Bootstrap] Creating Swagger document...');
      const document = SwaggerModule.createDocument(app, config);

      console.log('[Bootstrap] Setting up Swagger UI...');
      SwaggerModule.setup('/', app, document, {
        customSiteTitle: 'Backend API Documentation',
        customfavIcon: 'https://nestjs.com/favicon.ico',
      });

      console.log('[Bootstrap] Initializing application...');
      await app.init();

      console.log('[Bootstrap] SUCCESS - Application ready!');
    } catch (error) {
      console.error('[Bootstrap] FAILED - Error details:');
      console.error('[Bootstrap] Name:', error instanceof Error ? error.name : 'Unknown');
      console.error('[Bootstrap] Message:', error instanceof Error ? error.message : String(error));
      console.error('[Bootstrap] Stack:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  }
  return app;
}

export default async function handler(req: Request, res: Response) {
  try {
    console.log('[Handler] Incoming request:', req.method, req.url);
    const app = await bootstrap();
    const expressApp = app.getHttpAdapter().getInstance();
    return expressApp(req, res);
  } catch (error) {
    console.error('[Handler] Request failed');
    console.error('[Handler] Request:', req.method, req.url);
    console.error('[Handler] Error:', error instanceof Error ? error.message : String(error));
    console.error('[Handler] Stack:', error instanceof Error ? error.stack : 'No stack');

    res.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
