import { z } from 'zod';
import { CUSTOM_ALIAS_MAX_LENGTH, CUSTOM_ALIAS_PATTERN } from '@repo/shared';

/**
 * Zod schema for creating short URLs
 * Validates on server-side before calling backend API
 */
export const createShortUrlSchema = z.object({
  longUrl: z
    .string()
    .url({ message: 'Must be a valid URL' })
    .startsWith('http', { message: 'URL must start with http:// or https://' }),
  customAlias: z
    .string()
    .max(CUSTOM_ALIAS_MAX_LENGTH, {
      message: `Maximum ${CUSTOM_ALIAS_MAX_LENGTH} characters`,
    })
    .regex(CUSTOM_ALIAS_PATTERN, {
      message: 'Only letters, numbers, hyphens, and underscores allowed',
    })
    .optional()
    .or(z.literal('')), // Allow empty string to be treated as undefined
});

export type CreateShortUrlInput = z.infer<typeof createShortUrlSchema>;
