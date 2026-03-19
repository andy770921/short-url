import { Injectable } from '@nestjs/common';
import { HealthResponse } from '@repo/shared';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello from NestJS!';
  }

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
