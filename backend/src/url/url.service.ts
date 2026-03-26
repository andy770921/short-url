import { ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateShortUrlResponse } from '@repo/shared';
import { CreateShortUrlDto } from '../dto/create-short-url.dto';
import { URL_CONSTANTS } from './url.constant';
import { UrlCodeGenerator } from './url-code-generator';
import { UrlRecord, UrlRepository } from './url.repository';

@Injectable()
export class UrlService {
  private readonly shortCodeLength = URL_CONSTANTS.SHORT_CODE_LENGTH;
  private readonly maxCollisionAttempts = URL_CONSTANTS.MAX_COLLISION_ATTEMPTS;

  constructor(
    private readonly repo: UrlRepository,
    private readonly codeGen: UrlCodeGenerator,
  ) {}

  async createShortUrl(dto: CreateShortUrlDto, baseUrl: string): Promise<CreateShortUrlResponse> {
    const { longUrl, customAlias } = dto;

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
