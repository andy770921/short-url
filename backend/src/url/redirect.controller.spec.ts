import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, GoneException } from '@nestjs/common';
import { RedirectController } from './redirect.controller';
import { UrlService } from './url.service';

describe('RedirectController', () => {
  let controller: RedirectController;

  const mockUrlService = {
    getOriginalUrl: jest.fn(),
  };

  const mockResponse = {
    redirect: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RedirectController],
      providers: [{ provide: UrlService, useValue: mockUrlService }],
    }).compile();

    controller = module.get<RedirectController>(RedirectController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('redirect', () => {
    it('should redirect to the original URL with 302', async () => {
      mockUrlService.getOriginalUrl.mockResolvedValue('https://example.com');

      await controller.redirect('abc123', mockResponse);

      expect(mockUrlService.getOriginalUrl).toHaveBeenCalledWith('abc123');
      expect(mockResponse.redirect).toHaveBeenCalledWith(302, 'https://example.com');
    });

    it('should throw NotFoundException for unknown short code', async () => {
      mockUrlService.getOriginalUrl.mockRejectedValue(new NotFoundException());

      await expect(controller.redirect('unknown', mockResponse)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw GoneException for expired short URL', async () => {
      mockUrlService.getOriginalUrl.mockRejectedValue(new GoneException());

      await expect(controller.redirect('expired', mockResponse)).rejects.toThrow(GoneException);
    });
  });
});
