'use server';

import { CreateShortUrlResponse } from '@repo/shared';
import { validateInput, executeAction } from '../lib/action-utils';
import { ActionResult } from '../lib/action-result';
import { createShortUrlSchema, CreateShortUrlInput } from './create-short-url.schema';

/**
 * Server Action: Create short URL with service key authentication
 * This runs ONLY on the server - service key never exposed to client
 */
export async function createShortUrlAction(
  input: CreateShortUrlInput,
): Promise<ActionResult<CreateShortUrlResponse>> {
  // Step 1: Validate input with Zod
  const validation = await validateInput(createShortUrlSchema, input);
  if (!validation.success) {
    return validation;
  }

  // Step 2: Execute backend call with service key
  return executeAction(async () => {
    const serviceKey = process.env.BACKEND_SERVICE_KEY;
    if (!serviceKey) {
      throw new Error('Server configuration error: Missing service key');
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

    const response = await fetch(`${apiUrl}/api/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': serviceKey, // ← Added only on server!
      },
      body: JSON.stringify({
        longUrl: validation.data.longUrl,
        customAlias: validation.data.customAlias || undefined,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || 'Failed to create short URL');
    }

    return response.json();
  });
}
