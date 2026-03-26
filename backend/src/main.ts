import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
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
  SwaggerModule.setup('/docs', app, document, {
    customSiteTitle: 'Backend API Documentation',
    customfavIcon: 'https://nestjs.com/favicon.ico',
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger UI available at: http://localhost:${port}/docs`);
}
bootstrap();
