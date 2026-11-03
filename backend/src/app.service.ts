import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { HealthResponseDto } from './dto/health-response.dto';
import { SUPABASE_CLIENT } from './supabase/supabase.constants';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient | null) {}

  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /** Runs a minimal read against the `urls` table. Each call also counts as database
   *  activity, which is what keeps a Supabase Free-plan project from being paused. */
  async getDatabaseHealth(): Promise<HealthResponseDto> {
    if (!this.supabase) {
      throw new ServiceUnavailableException('Database connection is not configured');
    }

    const { error } = await this.supabase.from('urls').select('shortUrl').limit(1);

    if (error) {
      // Keep driver details in the logs; this endpoint is public.
      this.logger.error(`Database health check failed: ${error.message}`);
      throw new ServiceUnavailableException('Database is unreachable');
    }

    return this.getHealth();
  }
}
