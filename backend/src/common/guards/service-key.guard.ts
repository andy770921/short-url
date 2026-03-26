import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * NestJS Guard: Validates X-Service-Key header
 * Prevents unauthorized access to protected endpoints
 */
@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const serviceKey = request.headers['x-service-key'];
    const expectedKey = this.configService.get<string>('SERVICE_KEY');

    // Fail fast if key not configured
    if (!expectedKey) {
      throw new Error('SERVICE_KEY environment variable not configured');
    }

    // Reject if key missing or doesn't match
    if (!serviceKey || serviceKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing service key');
    }

    return true;
  }
}
