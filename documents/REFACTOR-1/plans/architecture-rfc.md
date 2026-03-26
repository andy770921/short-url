# Architecture RFC: REFACTOR-1 — Deep Module Improvements

## Summary

Six targeted refactors to reduce coupling, eliminate duplication, and enforce clear module
boundaries across the URL shortener codebase. Each improvement creates a "deep module" —
a small interface hiding substantial implementation.

---

## Fix 1: Extract UrlCodeGenerator + UrlRepository from UrlService

### Motivation
`UrlService` (166 lines) blends four responsibilities: code generation (MD5→base62),
collision detection, Supabase I/O, and response formatting. Testing code generation requires
a database mock. Schema changes are invisible to the type system.

### Proposed Interface

```typescript
// url-code-generator.ts — pure in-process, no I/O
@Injectable()
class UrlCodeGenerator {
  md5ToBase62(input: string): string
  getCandidate(base62: string, offset: number, codeLength: number): string
  randomSuffix(length: number): string
}

// url.repository.ts — owns all Supabase access, typed schema
export interface UrlRecord {
  shortUrl: string;
  longUrl: string;
  creationTime: string;
  expirationTime: string | null;
}

@Injectable()
class UrlRepository {
  findByShortCode(shortCode: string): Promise<UrlRecord | null>
  findByLongUrl(longUrl: string): Promise<UrlRecord | null>
  isShortCodeTaken(shortCode: string): Promise<boolean>
  create(shortCode: string, longUrl: string): Promise<UrlRecord>
}

// url.service.ts — orchestration only
@Injectable()
class UrlService {
  createShortUrl(dto, baseUrl): Promise<CreateShortUrlResponse>
  getOriginalUrl(shortCode: string): Promise<string>
}
```

### What It Hides
- `UrlCodeGenerator`: MD5 hashing, base62 encoding, BigInt arithmetic, random suffix generation
- `UrlRepository`: Supabase query builder chaining, column names, error mapping to HTTP exceptions, expiration timestamp calculation

### Dependency Strategy
- `UrlCodeGenerator`: In-process (no I/O), unit testable without mocks
- `UrlRepository`: Local-substitutable (Supabase client can be mocked at injection point)

### Testing Strategy
- New: `url-code-generator.spec.ts` — pure unit tests, no mocks
- New: `url.repository.spec.ts` — mock `SUPABASE_CLIENT` token
- Updated: `url.service.spec.ts` — mock `UrlRepository` + `UrlCodeGenerator`

---

## Fix 2: Shared Validation Constants

### Motivation
`/^[a-zA-Z0-9_-]+$/` and `maxLength: 20` appear in both `backend/src/dto/create-short-url.dto.ts`
and `frontend/src/app/page.tsx`. A rule change requires two updates with no compiler enforcement.

### Proposed Interface

```typescript
// shared/src/types/url.ts
export const CUSTOM_ALIAS_MAX_LENGTH = 20;
export const CUSTOM_ALIAS_PATTERN = /^[a-zA-Z0-9_-]+$/;
```

### What It Hides
The single source of truth for alias validation rules. Both backend and frontend import from
`@repo/shared` — a constraint violation is caught at compile time.

### Dependency Strategy
In-process — pure constants, no I/O.

---

## Fix 3: Complete API Client Pattern

### Motivation
`frontend/src/lib/api-client.ts` only implements `health.get()` and is unused by the form.
The URL form directly calls `defaultFetchFn`, creating two competing patterns for making
API calls. Future callers have no clear convention to follow.

### Proposed Interface

```typescript
// api-client.ts — single typed gateway for all backend calls
export const apiClient = {
  health: { get: () => ... },
  urls: {
    create: (body: CreateShortUrlRequest) => Promise<CreateShortUrlResponse>,
  },
};
```

`use-create-short-url.ts` uses `apiClient.urls.create(body)` instead of calling
`defaultFetchFn` directly. Internally `apiClient` still delegates to `defaultFetchFn`
so timeout and error handling remain centralized.

### What It Hides
HTTP method, headers, path, and fetch internals. Callers see a typed method call.

---

## Fix 4: Configuration via ConfigService

### Motivation
`SHORT_CODE_LENGTH = 6`, `MAX_COLLISION_ATTEMPTS = 20`, `EXPIRATION_DAYS = 30` are hardcoded
in `url.service.ts`. Changing behavior requires a code deployment.

### Proposed Interface

```
# backend/.env.example
SHORT_CODE_LENGTH=6
MAX_COLLISION_ATTEMPTS=20
EXPIRATION_DAYS=30
```

Values read via `ConfigService.get<number>()` with defaults at construction time in
`UrlService` (code dimensions) and `UrlRepository` (expiration).

### Dependency Strategy
In-process — ConfigService is already globally available.

---

## Fix 5: Typed Database Schema (UrlRecord)

### Motivation
Supabase queries use raw string column names (`'longUrl'`, `'expirationTime'`) with no
TypeScript interface. A column rename causes a runtime error, not a compile error.

### Proposed Interface

```typescript
// url.repository.ts
export interface UrlRecord {
  shortUrl: string;
  longUrl: string;
  creationTime: string;
  expirationTime: string | null;
}
```

All `supabase.from('urls')` calls live in `UrlRepository`. The rest of the application
only sees `UrlRecord`.

---

## Fix 6: Two Controllers Design Decision (No Change)

### Decision: Keep the two-controller structure

`UrlController` (`POST /api/urls`) and `RedirectController` (`GET /:shortCode`) have
different base paths and different HTTP semantics. They cannot share a base path:
- `UrlController` is mounted at `/api/urls` with Swagger documentation
- `RedirectController` is mounted at `/` to act as a wildcard catch-all

Merging them into one controller would require an awkward split base path or removing the
wildcard behavior. The current structure is intentional. The only improvement is documentation
— `RedirectController` has a comment explaining the `@ApiExcludeController` is deliberate.

---

## Migration Plan

1. Create `url-code-generator.ts` + tests
2. Create `url.repository.ts` + tests
3. Slim `url.service.ts` + update tests
4. Update `url.module.ts` providers
5. Add env vars to `.env.example`
6. Add validation constants to `shared/src/types/url.ts`
7. Update backend DTO and frontend form to use shared constants
8. Extend `api-client.ts` with `urls.create()`
9. Update `use-create-short-url.ts` to use `apiClient`

## Status

- [x] RFC Approved
- [x] Implementation Started
- [x] Migration Complete
- [ ] Old Code Removed
