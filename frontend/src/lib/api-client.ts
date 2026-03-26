import { defaultFetchFn } from '../utils/fetchers/fetchers.client';
import type { CreateShortUrlRequest, CreateShortUrlResponse, HealthResponse } from '@repo/shared';

export const apiClient = {
  health: {
    get: () => defaultFetchFn<HealthResponse>('api/health'),
  },
  urls: {
    create: (body: CreateShortUrlRequest) =>
      defaultFetchFn<CreateShortUrlResponse, CreateShortUrlRequest>('api/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
  },
};
