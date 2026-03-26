# PRD: URL Shortener (Bitly-like)

## Problem Statement

Users need a simple, fast way to shorten long URLs for sharing. Long URLs are unwieldy in messages, presentations, and social media. A self-hosted URL shortener gives full control over short links, supports custom aliases, and avoids dependency on third-party services like Bitly.

## Solution Overview

A fullstack URL shortener built on the existing Next.js 15 + NestJS 11 monorepo. Users paste a long URL, optionally provide a custom alias, and receive a short URL that redirects to the original. The backend stores URL mappings in Supabase and handles redirection. The frontend provides a clean, minimalist interface styled with Tailwind CSS.

## User Stories

1. As a user, I want to paste a long URL and get a short URL so that I can share it easily.
2. As a user, I want to provide a custom alias for my short URL so that the link is memorable.
3. As a user, I want to click a short URL and be redirected to the original page seamlessly.
4. As a user, I want to copy the generated short URL to my clipboard with one click.
5. As a user, I want to see clear error messages when my custom alias is already taken.

## Implementation Decisions

### Modules

- **SupabaseModule** (`backend/src/supabase/`): Global NestJS module providing the Supabase client via dependency injection. Reads `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from environment.
- **UrlModule** (`backend/src/url/`): Feature module with URL shortening service, API controller (`POST /api/urls`), and redirect controller (`GET /:shortCode`).
- **Shared Types** (`shared/src/types/url.ts`): `CreateShortUrlRequest` and `CreateShortUrlResponse` interfaces used by both FE and BE.
- **Frontend Mutation Hook** (`frontend/src/queries/use-create-short-url.ts`): TanStack Query `useMutation` hook wrapping the create short URL API call.

### Architecture

- **URL shortening algorithm**: `md5(longUrl)` → hex → BigInt → base62 encoding → first 6 characters as the short code.
- **Collision handling**: Slide a window across the base62 string (offsets 0-16). If all collide, append 2 random base62 characters. Max 20 attempts before returning 409.
- **Idempotency**: If the same `longUrl` is submitted again, return the existing short code instead of creating a duplicate.
- **Expiration**: All URLs expire after 30 days. Expired URLs return 410 Gone on redirect.
- **Redirect**: 302 temporary redirect from `GET /:shortCode` to the original URL.
- **Swagger**: Moved from `/` to `/docs` to free up root-level routes for redirection.

### APIs/Interfaces

**POST /api/urls** — Create a short URL
```json
// Request
{
  "longUrl": "https://example.com/very/long/path",
  "customAlias": "my-link"  // optional
}

// Response (201)
{
  "shortUrl": "http://localhost:3000/abc123",
  "shortCode": "abc123",
  "longUrl": "https://example.com/very/long/path",
  "createdAt": "2026-03-26T10:00:00.000Z",
  "expiresAt": "2026-04-25T10:00:00.000Z"
}
```

**GET /:shortCode** — Redirect to original URL
- 302 redirect on success
- 404 if short code not found
- 410 if short URL expired

### Database Schema

```sql
CREATE TABLE urls (
  "shortUrl" TEXT PRIMARY KEY,
  "longUrl" TEXT NOT NULL,
  "creationTime" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expirationTime" TIMESTAMPTZ
);
CREATE INDEX idx_urls_long_url ON urls ("longUrl");
```

### Frontend

- **Styling**: Tailwind CSS v4 with minimalist card-based layout
- **Form**: React Hook Form with URL validation and optional custom alias
- **Result display**: Short URL with copy-to-clipboard button and expiration date
- **Error handling**: Inline error messages for validation and API errors (409 conflict)

## Testing Strategy

- **Backend unit tests**: Mock Supabase client. Test URL creation (generated + custom alias), collision handling, idempotency, redirect (success/404/410).
- **Frontend tests**: Existing TanStack Query utility tests continue to pass.
- **Manual E2E**: Submit URL → get short link → open short link → verify redirect.

## Out of Scope

- User authentication and login
- Analytics/click tracking
- Rate limiting
- Redis caching layer
- Custom expiration times per URL
- QR code generation
- Bulk URL shortening

## Status
- [x] Planning
- [x] In Development
- [ ] Complete
