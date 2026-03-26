import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { UrlModule } from './url/url.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting configuration
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,        // 1 second window
        limit: 3,         // Max 3 requests per second
      },
      {
        name: 'medium',
        ttl: 10000,       // 10 second window
        limit: 20,        // Max 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000,       // 60 second window
        limit: 100,       // Max 100 requests per minute
      },
    ]),
    SupabaseModule,
    UrlModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
