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

  const mockRequest = {
    protocol: 'http',
    get: jest.fn().mockReturnValue('localhost:3000'),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UrlController],
      providers: [
        { provide: UrlService, useValue: mockUrlService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-service-key') } },
      ],
    }).compile();

    controller = module.get<UrlController>(UrlController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createShortUrl', () => {
    it('should create and return a short URL', async () => {
      const mockResponse = {
        shortUrl: 'http://localhost:3000/abc123',
        shortCode: 'abc123',
        longUrl: 'https://example.com',
        createdAt: '2026-03-26T00:00:00.000Z',
        expiresAt: '2026-04-25T00:00:00.000Z',
      };

      mockUrlService.createShortUrl.mockResolvedValue(mockResponse);

      const result = await controller.createShortUrl(mockRequest, { longUrl: 'https://example.com' });
      expect(result).toEqual(mockResponse);
      expect(mockUrlService.createShortUrl).toHaveBeenCalledWith(
        { longUrl: 'https://example.com' },
        'http://localhost:3000',
      );
    });
  });
});
