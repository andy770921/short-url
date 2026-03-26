import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateShortUrlResponse } from '@repo/shared';
import { CreateShortUrlDto } from '../dto/create-short-url.dto';
import { URL_CONSTANTS } from './url.constant';
import { UrlCodeGenerator } from './url-code-generator';
import { UrlRecord, UrlRepository } from './url.repository';

@Injectable()
export class UrlService {
  private readonly shortCodeLength = URL_CONSTANTS.SHORT_CODE_LENGTH;
  private readonly maxCollisionAttempts = URL_CONSTANTS.MAX_COLLISION_ATTEMPTS;

  // Blocked domain patterns for security
  private readonly BLOCKED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '192.168.', // Private IP range
    '10.', // Private IP range
    '172.16.', // Private IP range
  ];

  constructor(
    private readonly repo: UrlRepository,
    private readonly codeGen: UrlCodeGenerator,
  ) {}

  /**
   * Validates URL for security concerns
   * Blocks internal IPs and enforces HTTPS in production
   */
  private validateUrl(longUrl: string): void {
    try {
      const url = new URL(longUrl);

      // Block internal/private IPs
      const isBlocked = this.BLOCKED_DOMAINS.some((blocked) =>
        url.hostname.includes(blocked),
      );
      if (isBlocked) {
        throw new BadRequestException('Cannot shorten internal or private URLs');
      }

      // Require HTTPS in production
      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        throw new BadRequestException('Only HTTPS URLs are allowed in production');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid URL format');
    }
  }

  async createShortUrl(dto: CreateShortUrlDto, baseUrl: string): Promise<CreateShortUrlResponse> {
    const { longUrl, customAlias } = dto;

    // Validate URL for security
    this.validateUrl(longUrl);

    if (customAlias) {
      return this.createWithCustomAlias(longUrl, customAlias, baseUrl);
    }

    return this.createWithGeneratedCode(longUrl, baseUrl);
  }

  async getOriginalUrl(shortCode: string): Promise<string> {
    const record = await this.repo.findByShortCode(shortCode);

    if (!record) {
      throw new NotFoundException('Short URL not found');
    }

    if (record.expirationTime && new Date(record.expirationTime) < new Date()) {
      throw new GoneException('Short URL has expired');
    }

    return record.longUrl;
  }

  private async createWithCustomAlias(
    longUrl: string,
    alias: string,
    baseUrl: string,
  ): Promise<CreateShortUrlResponse> {
    const existing = await this.repo.findByShortCode(alias);

    if (existing) {
      if (existing.longUrl === longUrl) {
        return this.buildResponse(alias, longUrl, existing, baseUrl);
      }
      throw new ConflictException('Custom alias is already taken');
    }

    const record = await this.repo.create(alias, longUrl);
    return this.buildResponse(alias, longUrl, record, baseUrl);
  }

  private async createWithGeneratedCode(
    longUrl: string,
    baseUrl: string,
  ): Promise<CreateShortUrlResponse> {
    const existing = await this.repo.findByLongUrl(longUrl);

    if (existing) {
      return this.buildResponse(existing.shortUrl, longUrl, existing, baseUrl);
    }

    const base62 = this.codeGen.md5ToBase62(longUrl);

    for (let offset = 0; offset < this.maxCollisionAttempts; offset++) {
      const candidate = this.codeGen.getCandidate(base62, offset, this.shortCodeLength);
      const taken = await this.repo.isShortCodeTaken(candidate);

      if (!taken) {
        const record = await this.repo.create(candidate, longUrl);
        return this.buildResponse(candidate, longUrl, record, baseUrl);
      }
    }

    throw new ConflictException('Unable to generate a unique short code. Please try again.');
  }

  private buildResponse(
    shortCode: string,
    longUrl: string,
    record: Pick<UrlRecord, 'creationTime' | 'expirationTime'>,
    baseUrl: string,
  ): CreateShortUrlResponse {
    return {
      shortUrl: `${baseUrl}/${shortCode}`,
      shortCode,
      longUrl,
      createdAt: record.creationTime ?? new Date().toISOString(),
      expiresAt: record.expirationTime ?? null,
    };
  }
}
