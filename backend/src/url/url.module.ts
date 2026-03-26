import { Module } from '@nestjs/common';
import { UrlController } from './url.controller';
import { RedirectController } from './redirect.controller';
import { UrlService } from './url.service';
import { UrlRepository } from './url.repository';
import { UrlCodeGenerator } from './url-code-generator';

@Module({
  controllers: [UrlController, RedirectController],
  providers: [UrlCodeGenerator, UrlRepository, UrlService],
})
export class UrlModule {}
