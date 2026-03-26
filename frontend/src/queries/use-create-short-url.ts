'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { CreateShortUrlRequest, CreateShortUrlResponse } from '@repo/shared';

export function useCreateShortUrl() {
  return useMutation<CreateShortUrlResponse, Error, CreateShortUrlRequest>({
    mutationFn: (body) => apiClient.urls.create(body),
  });
}
