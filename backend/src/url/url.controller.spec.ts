import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UrlController } from './url.controller';
import { UrlService } from './url.service';

describe('UrlController', () => {
  let controller: UrlController;

  const mockUrlService = {
    createShortUrl: jest.fn(),
    getOriginalUrl: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string, defaultValue?: unknown) =>
      key === 'FRONTEND_ORIGIN' ? 'https://frontend.example.com' : defaultValue,
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UrlController],
      providers: [
        { provide: UrlService, useValue: mockUrlService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    controller = module.get<UrlController>(UrlController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createShortUrl', () => {
    it('should build the short URL from the configured frontend origin, not the request', async () => {
      const mockResponse = {
        shortUrl: 'https://frontend.example.com/abc123',
        shortCode: 'abc123',
        longUrl: 'https://example.com',
        createdAt: '2026-03-26T00:00:00.000Z',
        expiresAt: '2026-04-25T00:00:00.000Z',
      };

      mockUrlService.createShortUrl.mockResolvedValue(mockResponse);

      const result = await controller.createShortUrl({ longUrl: 'https://example.com' });
      expect(result).toEqual(mockResponse);
      expect(mockUrlService.createShortUrl).toHaveBeenCalledWith(
        { longUrl: 'https://example.com' },
        'https://frontend.example.com',
      );
    });
  });
});
