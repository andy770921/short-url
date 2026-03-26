import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { UrlService } from './url.service';

@ApiExcludeController()
@Controller()
export class RedirectController {
  constructor(private readonly urlService: UrlService) {}

  @Get(':shortCode')
  async redirect(
    @Param('shortCode') shortCode: string,
    @Res() res: Response,
  ): Promise<void> {
    const longUrl = await this.urlService.getOriginalUrl(shortCode);
    res.redirect(302, longUrl);
  }
}
