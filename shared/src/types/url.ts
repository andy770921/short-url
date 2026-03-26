export const CUSTOM_ALIAS_MAX_LENGTH = 20;
export const CUSTOM_ALIAS_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface CreateShortUrlRequest {
  longUrl: string;
  customAlias?: string;
}

export interface CreateShortUrlResponse {
  shortUrl: string;
  shortCode: string;
  longUrl: string;
  createdAt: string;
  expiresAt: string | null;
}
