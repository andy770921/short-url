import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiConflictResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UrlService } from './url.service';
import { CreateShortUrlDto, CreateShortUrlResponseDto } from '../dto';

@ApiTags('urls')
@Controller('api/urls')
export class UrlController {
  constructor(private readonly urlService: UrlService) {}

  @Post()
  @ApiOperation({ summary: 'Create a short URL', description: 'Shorten a long URL with optional custom alias' })
  @ApiResponse({ status: 201, description: 'Short URL created', type: CreateShortUrlResponseDto })
  @ApiConflictResponse({ description: 'Custom alias already taken or unable to generate unique code' })
  async createShortUrl(
    @Req() req: Request,
    @Body() dto: CreateShortUrlDto,
  ): Promise<CreateShortUrlResponseDto> {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.urlService.createShortUrl(dto, baseUrl);
  }
}
