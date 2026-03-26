'use client';

import { useMutation } from '@tanstack/react-query';
import { createShortUrlAction } from '@/actions/urls/create-short-url.action';
import type { CreateShortUrlRequest, CreateShortUrlResponse } from '@repo/shared';

export function useCreateShortUrl() {
  return useMutation<CreateShortUrlResponse, Error, CreateShortUrlRequest>({
    mutationFn: async (input) => {
      const result = await createShortUrlAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}
