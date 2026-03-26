import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.constants';

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      useFactory: (configService: ConfigService): SupabaseClient => {
        const url = configService.getOrThrow<string>('SUPABASE_URL');
        const key = configService.getOrThrow<string>('SUPABASE_SERVICE_KEY');
        return createClient(url, key);
      },
      inject: [ConfigService],
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
