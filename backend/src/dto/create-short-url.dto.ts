import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';
import { CreateShortUrlRequest, CUSTOM_ALIAS_MAX_LENGTH, CUSTOM_ALIAS_PATTERN } from '@repo/shared';

export class CreateShortUrlDto implements CreateShortUrlRequest {
  @ApiProperty({
    description: 'The long URL to shorten',
    example: 'https://www.example.com/very/long/path?query=value',
  })
  @IsUrl({}, { message: 'longUrl must be a valid URL' })
  @IsNotEmpty()
  longUrl: string;

  @ApiPropertyOptional({
    description: 'Optional custom alias for the short URL (alphanumeric, hyphens, underscores)',
    example: 'my-link',
  })
  @IsOptional()
  @IsString()
  @MaxLength(CUSTOM_ALIAS_MAX_LENGTH)
  @Matches(CUSTOM_ALIAS_PATTERN, {
    message: 'customAlias must contain only letters, numbers, hyphens, and underscores',
  })
  customAlias?: string;
}
