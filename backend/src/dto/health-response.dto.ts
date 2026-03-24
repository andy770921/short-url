import { ApiProperty } from '@nestjs/swagger';
import { HealthResponse } from '@repo/shared';

/**
 * Health check response DTO
 * Implements shared HealthResponse interface with Swagger decorators
 */
export class HealthResponseDto implements HealthResponse {
  @ApiProperty({
    description: 'Health check status',
    enum: ['ok', 'error'],
    example: 'ok',
  })
  status: 'ok' | 'error';

  @ApiProperty({
    description: 'ISO 8601 timestamp of the health check',
    example: '2026-03-24T10:30:00.000Z',
    type: String,
  })
  timestamp: string;
}
