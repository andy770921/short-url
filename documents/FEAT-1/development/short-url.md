# FEAT-1: URL Shortener — Implementation Notes

## Overview

Implemented a Bitly-like URL shortener across the fullstack monorepo. Users paste a long URL (with optional custom alias), receive a short URL, and are redirected when visiting the short URL.

---

## Phase 1: Shared Types & Backend Infrastructure

### 1.1 New file: `shared/src/types/url.ts`

Added two shared interfaces consumed by both frontend and backend:

- `CreateShortUrlRequest` — `{ longUrl: string; customAlias?: string }`
- `CreateShortUrlResponse` — `{ shortUrl, shortCode, longUrl, createdAt, expiresAt }`

### 1.2 Modified file: `shared/src/index.ts`

Added `export * from './types/url'` to expose the new types via `@repo/shared`.

### 1.3 New file: `backend/src/supabase/supabase.constants.ts`

Defines the injection token `SUPABASE_CLIENT` used for NestJS dependency injection.

### 1.4 New file: `backend/src/supabase/supabase.module.ts`

`@Global()` NestJS module that provides the Supabase client. Uses a factory provider that reads `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from `ConfigService` and calls `createClient()`.

### 1.5 Modified file: `backend/src/app.module.ts`

- Imported `SupabaseModule` and `UrlModule` into the root module's `imports` array.

### 1.6 Modified file: `backend/.env.example`

Added `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` placeholders.

### 1.7 Modified file: `backend/src/main.ts`

- Added `ValidationPipe` globally with `whitelist: true` and `transform: true` to enable DTO validation via `class-validator`.
- Moved Swagger UI from `/` to `/docs` to free up root-level routes for the redirect endpoint.
- Added `urls` Swagger tag.
- Installed new dependencies: `@supabase/supabase-js`, `class-validator`, `class-transformer`.

### 1.8 Modified file: `backend/api/index.ts`

Moved Swagger setup path from `/` to `/docs` (Vercel serverless entry point, mirrors `main.ts`).

---

## Phase 2: Backend URL Module

### 2.1 New file: `backend/src/dto/create-short-url.dto.ts`

Request DTO implementing `CreateShortUrlRequest`. Decorators:
- `@IsUrl()` + `@IsNotEmpty()` on `longUrl`
- `@IsOptional()` + `@IsString()` + `@MaxLength(20)` + `@Matches(/^[a-zA-Z0-9_-]+$/)` on `customAlias`
- Swagger decorators for API documentation

### 2.2 New file: `backend/src/dto/create-short-url-response.dto.ts`

Response DTO implementing `CreateShortUrlResponse` with Swagger `@ApiProperty` decorators for all fields (`shortUrl`, `shortCode`, `longUrl`, `createdAt`, `expiresAt`).

### 2.3 Modified file: `backend/src/dto/index.ts`

Added exports for both new DTOs.

### 2.4 New file: `backend/src/url/url.service.ts`

Core business logic. Key methods:

- **`createShortUrl(dto)`** — Entry point. Delegates to `createWithCustomAlias()` or `createWithGeneratedCode()` based on whether `customAlias` is provided.

- **`getOriginalUrl(shortCode)`** — Queries DB by `shortUrl` PK, checks `expirationTime`. Throws `NotFoundException` (404) if not found, `GoneException` (410) if expired.

- **`createWithCustomAlias(longUrl, alias)`** — Checks if alias exists. If it maps to the same `longUrl`, returns existing record (idempotent). If it maps to a different URL, throws `ConflictException` (409). Otherwise inserts.

- **`createWithGeneratedCode(longUrl)`** — First checks if `longUrl` already has a mapping (idempotent). If not, generates code via `md5ToBase62()` and uses a sliding window collision strategy:
  - Tries offsets 0 through `base62String.length - 6` (chars 0-5, 1-6, 2-7, etc.)
  - If all windows collide, falls back to first 4 chars + 2 random base62 chars
  - Max 20 attempts before returning 409

- **`md5ToBase62(input)`** — `crypto.createHash('md5')` → hex string → `BigInt` → repeated division by 62 → base62 characters (`0-9a-zA-Z`). Produces ~22 character string.

- **`insertUrl(shortCode, longUrl)`** — Inserts into Supabase `urls` table with 30-day expiration (`EXPIRATION_DAYS = 30`).

- **`buildResponse()`** — Constructs `CreateShortUrlResponse` using `BASE_URL` env var (defaults to `http://localhost:3000`).

### 2.5 New file: `backend/src/url/url.controller.ts`

- `@Controller('api/urls')` with `@ApiTags('urls')`
- `POST /api/urls` — accepts `CreateShortUrlDto` body, returns `CreateShortUrlResponseDto`
- Swagger decorators for 201 and 409 responses

### 2.6 New file: `backend/src/url/redirect.controller.ts`

- `@Controller()` at root level (no prefix) with `@ApiExcludeController()` to hide from Swagger
- `GET /:shortCode` — calls `urlService.getOriginalUrl()`, issues `res.redirect(302, longUrl)`
- NestJS exception filters handle 404/410 automatically

### 2.7 New file: `backend/src/url/url.module.ts`

NestJS feature module registering `UrlController`, `RedirectController`, and `UrlService`.

---

## Phase 3: Frontend Setup

### 3.1 New file: `frontend/postcss.config.mjs`

PostCSS config for Tailwind CSS v4: `{ plugins: { '@tailwindcss/postcss': {} } }`.

### 3.2 New file: `frontend/src/app/globals.css`

Single line: `@import 'tailwindcss';` — Tailwind v4 CSS-first configuration.

### 3.3 Modified file: `frontend/src/app/layout.tsx`

- Added `import './globals.css'` to load Tailwind styles.
- Updated page title to `'Snip — URL Shortener'`.
- Installed new dependencies: `tailwindcss`, `@tailwindcss/postcss`, `react-hook-form`.

---

## Phase 4: Frontend UI

### 4.1 New file: `frontend/src/queries/use-create-short-url.ts`

TanStack Query mutation hook using the existing `defaultFetchFn` from `@/utils/fetchers/fetchers.client`. Sends `POST` to `api/urls` with `Content-Type: application/json` header (the fetcher layer does not auto-set this for JSON bodies). Typed with `CreateShortUrlRequest` / `CreateShortUrlResponse` from `@repo/shared`.

### 4.2 Modified file: `frontend/src/app/page.tsx`

Replaced the health-check page with the URL shortener UI. Key implementation details:

- **React Hook Form** manages two fields:
  - `longUrl` — required, validated with regex `^https?:\/\/.+`
  - `customAlias` — optional, validated with `^[a-zA-Z0-9_-]*$`, max 20 chars

- **State management**:
  - `result: CreateShortUrlResponse | null` — holds the API response
  - `copied: boolean` — tracks clipboard copy feedback (auto-resets after 2s)

- **Mutation flow**: `onSubmit` → clears previous result → calls `mutate()` with `onSuccess` callback to set result

- **Copy to clipboard**: Uses `navigator.clipboard.writeText()` with visual feedback ("Copy" → "Copied!")

- **UI layout** (Tailwind CSS):
  - Full-height centered layout with subtle gradient background
  - White card with rounded corners, subtle border and shadow
  - Indigo submit button with disabled/loading state
  - Red error banner for API errors
  - Green success area with monospace short URL display and copy button
  - Expiration date shown below the short URL

---

## Phase 5: Tests

### 5.1 New file: `backend/src/url/url.service.spec.ts`

11 tests covering:
- `md5ToBase62`: deterministic output, base62 character set, different inputs produce different results
- `createShortUrl`: generated code creation, custom alias creation, 409 on taken alias
- `getOriginalUrl`: returns URL for valid code, 404 for missing, 410 for expired

Supabase client is fully mocked with chained method returns.

### 5.2 New file: `backend/src/url/url.controller.spec.ts`

3 tests covering:
- Returns short URL response from service
- Passes DTO correctly to service

### 5.3 New file: `backend/src/url/redirect.controller.spec.ts`

3 tests covering:
- 302 redirect on valid short code
- Propagates `NotFoundException` for unknown codes
- Propagates `GoneException` for expired codes

### Test Results

- **Backend**: 17 tests passing (4 test suites)
- **Frontend**: 3 tests passing (1 test suite — existing TanStack Query utility tests)

---

## File Summary

### New Files (14)

| File | Purpose |
|------|---------|
| `shared/src/types/url.ts` | Shared request/response interfaces |
| `backend/src/supabase/supabase.constants.ts` | `SUPABASE_CLIENT` injection token |
| `backend/src/supabase/supabase.module.ts` | Global Supabase client provider |
| `backend/src/dto/create-short-url.dto.ts` | Request DTO with validation |
| `backend/src/dto/create-short-url-response.dto.ts` | Response DTO with Swagger decorators |
| `backend/src/url/url.service.ts` | URL shortening logic + DB queries |
| `backend/src/url/url.controller.ts` | `POST /api/urls` endpoint |
| `backend/src/url/redirect.controller.ts` | `GET /:shortCode` redirect endpoint |
| `backend/src/url/url.module.ts` | NestJS feature module |
| `backend/src/url/url.service.spec.ts` | Service unit tests |
| `backend/src/url/url.controller.spec.ts` | Controller unit tests |
| `backend/src/url/redirect.controller.spec.ts` | Redirect controller unit tests |
| `frontend/postcss.config.mjs` | PostCSS config for Tailwind v4 |
| `frontend/src/app/globals.css` | Tailwind CSS entry point |
| `frontend/src/queries/use-create-short-url.ts` | Mutation hook |

### Modified Files (7)

| File | Change |
|------|--------|
| `shared/src/index.ts` | Added URL type exports |
| `backend/src/app.module.ts` | Imported SupabaseModule and UrlModule |
| `backend/src/main.ts` | Swagger → `/docs`, added ValidationPipe, added `urls` tag |
| `backend/api/index.ts` | Swagger → `/docs` |
| `backend/.env.example` | Added SUPABASE_URL, SUPABASE_SERVICE_KEY |
| `backend/src/dto/index.ts` | Exported new DTOs |
| `frontend/src/app/layout.tsx` | Imported globals.css, updated title |
| `frontend/src/app/page.tsx` | Replaced health page with URL shortener UI |

### New Dependencies

| Package | Workspace | Purpose |
|---------|-----------|---------|
| `@supabase/supabase-js` | backend | Supabase client for DB access |
| `class-validator` | backend | DTO validation decorators |
| `class-transformer` | backend | DTO transformation |
| `tailwindcss` | frontend | CSS framework |
| `@tailwindcss/postcss` | frontend | PostCSS plugin for Tailwind v4 |
| `react-hook-form` | frontend | Form state management |
