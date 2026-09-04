import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiConflictResponse, ApiOperation, ApiResponse, ApiTags, ApiSecurity } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { UrlService } from './url.service';
import { CreateShortUrlDto, CreateShortUrlResponseDto } from '../dto';
import { ServiceKeyGuard } from '../common/guards/service-key.guard';
import { resolveFrontendOrigin } from '../common/config/origins';

@ApiTags('urls')
@Controller('api/urls')
export class UrlController {
  constructor(
    private readonly urlService: UrlService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @UseGuards(ServiceKeyGuard)
  @ApiSecurity('service-key')
  @ApiOperation({ summary: 'Create a short URL', description: 'Shorten a long URL with optional custom alias' })
  @ApiResponse({ status: 201, description: 'Short URL created', type: CreateShortUrlResponseDto })
  @ApiConflictResponse({ description: 'Custom alias already taken or unable to generate unique code' })
  async createShortUrl(@Body() dto: CreateShortUrlDto): Promise<CreateShortUrlResponseDto> {
    // Short links are served from the frontend origin, which forwards /:shortCode here.
    return this.urlService.createShortUrl(dto, resolveFrontendOrigin(this.configService));
  }
}
