# REFACTOR-1 Implementation Notes

## Fix 1+4+5: UrlCodeGenerator + UrlRepository + slim UrlService

### New files
- `backend/src/url/url-code-generator.ts` — injectable, pure in-process. Methods: `md5ToBase62`, `getCandidate`, `randomSuffix`. No I/O, no constructor deps.
- `backend/src/url/url.repository.ts` — injectable. Owns all `supabase.from('urls')` calls. Exports `UrlRecord` interface (the typed schema). Reads `EXPIRATION_DAYS` from ConfigService.
- `backend/src/url/url-code-generator.spec.ts` — pure unit tests, no mocks needed.
- `backend/src/url/url.repository.spec.ts` — mocks `SUPABASE_CLIENT` token and ConfigService.

### Modified files
- `backend/src/url/url.service.ts` — no longer injects `SUPABASE_CLIENT`. Injects `UrlRepository`, `UrlCodeGenerator`, `ConfigService`. Reads `SHORT_CODE_LENGTH` and `MAX_COLLISION_ATTEMPTS` from config with defaults.
- `backend/src/url/url.service.spec.ts` — mocks `UrlRepository` and `UrlCodeGenerator` instead of raw Supabase. ConfigService mock uses `mockImplementation((_key, defaultValue) => defaultValue)` so defaults work.
- `backend/src/url/url.module.ts` — providers expanded: `[UrlCodeGenerator, UrlRepository, UrlService]`.
- `backend/.env.example` — added `SHORT_CODE_LENGTH=6`, `MAX_COLLISION_ATTEMPTS=20`, `EXPIRATION_DAYS=30`.

### Key decisions
- `EXPIRATION_DAYS` lives in `UrlRepository.create()` because it's only used when inserting a row.
- `SHORT_CODE_LENGTH` and `MAX_COLLISION_ATTEMPTS` live in `UrlService` because they govern the orchestration loop.
- `UrlRecord` is exported from `url.repository.ts` (not a separate types file) — it's the repository's public contract.

---

## Fix 2: Shared Validation Constants

### Modified files
- `shared/src/types/url.ts` — added `CUSTOM_ALIAS_MAX_LENGTH = 20` and `CUSTOM_ALIAS_PATTERN = /^[a-zA-Z0-9_-]+$/`.
- `backend/src/dto/create-short-url.dto.ts` — `@MaxLength(CUSTOM_ALIAS_MAX_LENGTH)` and `@Matches(CUSTOM_ALIAS_PATTERN)`.
- `frontend/src/app/page.tsx` — form register uses `CUSTOM_ALIAS_PATTERN` and `CUSTOM_ALIAS_MAX_LENGTH`.

---

## Fix 3: Complete API Client

### Modified files
- `frontend/src/lib/api-client.ts` — now imports `defaultFetchFn` from fetchers and exposes `apiClient.urls.create(body)`. All existing error handling (timeout, AbortController) is preserved via `defaultFetchFn`.
- `frontend/src/queries/use-create-short-url.ts` — `mutationFn` calls `apiClient.urls.create(body)` instead of `defaultFetchFn` directly.

---

## Fix 6: Two Controllers Decision

No code change. `UrlController` and `RedirectController` remain separate because they have fundamentally different base paths (`/api/urls` vs `/`). The redirect controller is intentionally at root to act as a wildcard catch-all for `/:shortCode`. Documented in RFC.

---

## Test results

All 33 backend tests pass after refactoring.

```
Test Suites: 6 passed, 6 total
Tests:       33 passed, 33 total
```

New test files added:
- `url-code-generator.spec.ts` — 6 tests (pure, no mocks)
- `url.repository.spec.ts` — 8 tests (mocks Supabase)
