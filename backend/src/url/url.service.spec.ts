import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UrlService } from './url.service';
import { UrlRepository } from './url.repository';
import { UrlCodeGenerator } from './url-code-generator';

const BASE_URL = 'http://localhost:3000';

const mockRecord = {
  shortUrl: 'abc123',
  longUrl: 'https://example.com',
  creationTime: '2026-03-26T00:00:00.000Z',
  expirationTime: '2026-04-25T00:00:00.000Z',
};

describe('UrlService', () => {
  let service: UrlService;
  let mockRepo: jest.Mocked<UrlRepository>;
  let mockCodeGen: jest.Mocked<UrlCodeGenerator>;

  beforeEach(async () => {
    mockRepo = {
      findByShortCode: jest.fn().mockResolvedValue(null),
      findByLongUrl: jest.fn().mockResolvedValue(null),
      isShortCodeTaken: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue(mockRecord),
    } as any;

    mockCodeGen = {
      md5ToBase62: jest.fn().mockReturnValue('abcdefghij'),
      getCandidate: jest.fn().mockReturnValue('abc123'),
      randomSuffix: jest.fn().mockReturnValue('ab'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlService,
        { provide: UrlRepository, useValue: mockRepo },
        { provide: UrlCodeGenerator, useValue: mockCodeGen },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockImplementation((_key: string, defaultValue: unknown) => defaultValue) },
        },
      ],
    }).compile();

    service = module.get<UrlService>(UrlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createShortUrl', () => {
    it('should create a short URL with generated code', async () => {
      const result = await service.createShortUrl({ longUrl: 'https://example.com' }, BASE_URL);
      expect(result).toHaveProperty('shortUrl');
      expect(result).toHaveProperty('shortCode', 'abc123');
      expect(result).toHaveProperty('longUrl', 'https://example.com');
      expect(result.shortUrl).toBe('http://localhost:3000/abc123');
    });

    it('should return existing record when longUrl already exists', async () => {
      mockRepo.findByLongUrl.mockResolvedValue(mockRecord);

      const result = await service.createShortUrl({ longUrl: 'https://example.com' }, BASE_URL);
      expect(result.shortCode).toBe('abc123');
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should create a short URL with custom alias', async () => {
      const result = await service.createShortUrl(
        { longUrl: 'https://example.com', customAlias: 'my-link' },
        BASE_URL,
      );
      expect(result).toHaveProperty('shortUrl');
      expect(mockRepo.create).toHaveBeenCalledWith('my-link', 'https://example.com');
    });

    it('should deduplicate custom alias when same longUrl already exists', async () => {
      mockRepo.findByShortCode.mockResolvedValue(mockRecord);

      const result = await service.createShortUrl(
        { longUrl: 'https://example.com', customAlias: 'abc123' },
        BASE_URL,
      );
      expect(result.shortCode).toBe('abc123');
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when custom alias is taken by different URL', async () => {
      mockRepo.findByShortCode.mockResolvedValue({ ...mockRecord, longUrl: 'https://other.com' });

      await expect(
        service.createShortUrl({ longUrl: 'https://example.com', customAlias: 'taken' }, BASE_URL),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when all collision attempts are exhausted', async () => {
      mockRepo.isShortCodeTaken.mockResolvedValue(true);

      await expect(
        service.createShortUrl({ longUrl: 'https://example.com' }, BASE_URL),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getOriginalUrl', () => {
    it('should return the original URL for a valid short code', async () => {
      mockRepo.findByShortCode.mockResolvedValue({
        ...mockRecord,
        expirationTime: '2099-01-01T00:00:00.000Z',
      });

      const result = await service.getOriginalUrl('abc123');
      expect(result).toBe('https://example.com');
    });

    it('should throw NotFoundException for non-existent short code', async () => {
      mockRepo.findByShortCode.mockResolvedValue(null);

      await expect(service.getOriginalUrl('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw GoneException for expired short URL', async () => {
      mockRepo.findByShortCode.mockResolvedValue({
        ...mockRecord,
        expirationTime: '2020-01-01T00:00:00.000Z',
      });

      await expect(service.getOriginalUrl('expired')).rejects.toThrow(GoneException);
    });
  });
});
