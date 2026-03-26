import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateShortUrlResponse } from '@repo/shared';

export class CreateShortUrlResponseDto implements CreateShortUrlResponse {
  @ApiProperty({
    description: 'The full short URL',
    example: 'http://localhost:3000/abc123',
  })
  shortUrl: string;

  @ApiProperty({
    description: 'The short code portion of the URL',
    example: 'abc123',
  })
  shortCode: string;

  @ApiProperty({
    description: 'The original long URL',
    example: 'https://www.example.com/very/long/path?query=value',
  })
  longUrl: string;

  @ApiProperty({
    description: 'ISO 8601 creation timestamp',
    example: '2026-03-26T10:30:00.000Z',
  })
  createdAt: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 expiration timestamp, or null if no expiration',
    example: '2026-04-25T10:30:00.000Z',
    nullable: true,
  })
  expiresAt: string | null;
}
