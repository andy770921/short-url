# Short Link Base URL — Implementation Steps

- **Ticket:** FEAT-5
- **Date:** 2026-09-04
- **Plan:** [`../plans/short-link-base-url.md`](../plans/short-link-base-url.md)

## Summary of Changes

| File | Change |
|------|--------|
| `backend/src/common/config/origins.ts` | **New.** Resolves the frontend and backend origins from env vars. |
| `backend/src/common/config/origins.spec.ts` | **New.** Unit tests for both resolvers. |
| `backend/src/url/url.controller.ts` | Builds the base URL from config instead of the request. |
| `backend/src/url/url.controller.spec.ts` | Updated for the new controller signature. |
| `backend/src/main.ts` | Reuses the shared origin helpers for the CORS whitelist. |
| `backend/src/dto/create-short-url-response.dto.ts` | Swagger example now shows the frontend origin. |
| `frontend/src/middleware.ts` | **New.** Forwards `/:shortCode` to the backend with a 307. |
| `frontend/src/utils/short-code/short-code.ts` | **New.** `isShortCodePath()` matcher. |
| `frontend/src/utils/short-code/short-code.spec.ts` | **New.** Unit tests for the matcher. |
| `CLAUDE.md` | Documents the short-link flow, the new module, and `FRONTEND_ORIGIN`'s second role. |

---

## Step 1: Add `backend/src/common/config/origins.ts`

Two resolvers, each stripping trailing slashes:

```typescript
const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

export function resolveFrontendOrigin(config: ConfigService): string {
  return stripTrailingSlash(config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3001'));
}

export function resolveBackendOrigin(config: ConfigService): string {
  const renderUrl = config.get<string>('RENDER_EXTERNAL_URL');
  if (renderUrl) {
    return stripTrailingSlash(renderUrl);
  }

  const vercelUrl = config.get<string>('VERCEL_URL');
  if (vercelUrl) {
    return `https://${stripTrailingSlash(vercelUrl)}`;
  }

  const railwayDomain = config.get<string>('RAILWAY_PUBLIC_DOMAIN');
  if (railwayDomain) {
    return `https://${stripTrailingSlash(railwayDomain)}`;
  }

  return `http://localhost:${config.get<number>('PORT', 3000)}`;
}
```

`resolveBackendOrigin` is the platform-detection block lifted verbatim out of `main.ts`,
restructured as early returns.

`resolveFrontendOrigin` serves double duty — CORS whitelist entry and short-link base
URL — because short links are served from the frontend origin, so a separate
`SHORT_URL_BASE` variable could only ever hold the same value. It carries a doc comment
explaining why the request is deliberately not consulted, so the next person to touch it
does not reintroduce `req.protocol`.

## Step 2: Rewrite `backend/src/url/url.controller.ts`

**Before:**

```typescript
async createShortUrl(
  @Req() req: Request,
  @Body() dto: CreateShortUrlDto,
): Promise<CreateShortUrlResponseDto> {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return this.urlService.createShortUrl(dto, baseUrl);
}
```

**After:**

```typescript
constructor(
  private readonly urlService: UrlService,
  private readonly configService: ConfigService,
) {}

async createShortUrl(@Body() dto: CreateShortUrlDto): Promise<CreateShortUrlResponseDto> {
  // Short links are served from the frontend origin, which forwards /:shortCode here.
  return this.urlService.createShortUrl(dto, resolveFrontendOrigin(this.configService));
}
```

**What changed:** the `@Req()` parameter and the `express` `Request` import are gone.
`UrlService` is untouched — it still receives `baseUrl` as an argument, so none of its
tests needed to change.

## Step 3: Simplify `backend/src/main.ts`

**Before** — 22 lines of inline platform detection feeding the CORS whitelist:

```typescript
const frontendOrigin = configService.get<string>('FRONTEND_ORIGIN', 'http://localhost:3001');
const port = configService.get<number>('PORT', 3000);

let backendOrigin: string;
const vercelUrl = configService.get<string>('VERCEL_URL');
// ...RENDER_EXTERNAL_URL / VERCEL_URL / RAILWAY_PUBLIC_DOMAIN branches...

const allowedOrigins = [frontendOrigin, backendOrigin];
```

**After:**

```typescript
const port = configService.get<number>('PORT', 3000);
const allowedOrigins = [resolveFrontendOrigin(configService), resolveBackendOrigin(configService)];
```

`port` is still read here because `app.listen(port)` uses it.

## Step 4: Add `frontend/src/utils/short-code/short-code.ts`

```typescript
import { CUSTOM_ALIAS_MAX_LENGTH } from '@repo/shared';

const SHORT_CODE_PATH = new RegExp(`^/[a-zA-Z0-9_-]{1,${CUSTOM_ALIAS_MAX_LENGTH}}$`);

export const isShortCodePath = (pathname: string): boolean => SHORT_CODE_PATH.test(pathname);
```

The character class and the length bound come from the shared `CUSTOM_ALIAS_PATTERN` /
`CUSTOM_ALIAS_MAX_LENGTH` contract, so the frontend matcher cannot drift from what the
backend accepts as an alias.

This lives in its own module rather than inside `middleware.ts` for a concrete reason:
importing `next/server` under the frontend's `jsdom` Jest environment throws
(`Request is not defined`), so a spec that imports the middleware cannot run. Extracting
the pure function keeps it testable.

## Step 5: Add `frontend/src/middleware.ts`

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isShortCodePath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(`${pathname}${search}`, API_URL), 307);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

Two layers of filtering, on purpose: the `matcher` keeps the middleware off Next's own
routes at the framework level, and `isShortCodePath` then decides whether a path is
actually a short link. `search` is carried through so query strings appended to a short
link survive the hop.

## Step 6: Documentation

- `CLAUDE.md` — added the short-link resolution flow to *Request Flow*, listed
  `src/common/config/origins.ts` under *Backend Structure*, noted that
  `redirect.controller.ts` is reached via the frontend middleware, and noted in
  *Environment Variables* that `FRONTEND_ORIGIN` is also the short-link base URL.
- `create-short-url-response.dto.ts` — Swagger example changed from
  `http://localhost:3000/abc123` to `http://localhost:3001/abc123`, matching the new
  frontend-hosted shape.

---

## Tests

### `backend/src/common/config/origins.spec.ts` (new, 6 cases)

Covers: the localhost fallbacks, trailing-slash stripping, the `https://` prefix applied
to `VERCEL_URL`, Render's already-complete URL passed through as-is, and the regression
case itself — an HTTPS frontend origin never being downgraded to `http://`.

### `backend/src/url/url.controller.spec.ts` (updated)

The mock request object was removed. `ConfigService` is mocked to return
`https://frontend.example.com` for `FRONTEND_ORIGIN`, and the test asserts the service
receives that value:

```typescript
expect(mockUrlService.createShortUrl).toHaveBeenCalledWith(
  { longUrl: 'https://example.com' },
  'https://frontend.example.com',
);
```

### `frontend/src/utils/short-code/short-code.spec.ts` (new, 6 cases)

Matches: a generated 6-char code, a custom alias containing `_` and `-`. Rejects: `/`,
a nested path (`/api/urls`), a static file (`/favicon.ico`), and a 21-character alias
(one over the limit).

---

## Verification

Dependencies were not installed in the working tree, so `npm install` was run first.

| Check | Result |
|-------|--------|
| `backend` Jest | **7 suites / 42 tests passed** |
| `frontend` Jest | **2 suites / 9 tests passed** |
| `npm run build` | **3/3 workspaces succeeded**; Next.js build output lists `ƒ Middleware  34 kB` |
| `npm run lint` | **Could not run** — see below |

### Local smoke test

Frontend dev server on port 3001, no backend required for the hop itself:

```
GET http://localhost:3001/4ymlZa
→ HTTP/1.1 307 Temporary Redirect
  location: http://localhost:3000/4ymlZa

GET http://localhost:3001/my-link?a=1
→ HTTP/1.1 307 Temporary Redirect
  location: http://localhost:3000/my-link?a=1     ← query preserved

GET http://localhost:3001/
→ 200                                              ← home page unaffected
```

### Lint could not be run

`npm run lint` fails in all three workspaces — including `shared`, which this change does
not touch — with an ESLint/ajv incompatibility raised during config loading:

```
TypeError: Cannot set properties of undefined (setting 'defaultMeta')
    at ajvOrig (node_modules/@eslint/eslintrc/dist/eslintrc.cjs:1626:27)
ESLint: 8.57.1
```

This is a pre-existing toolchain problem in the freshly installed `node_modules`, not a
consequence of this work. The code in this change was not lint-verified.

---

## Environment / Deployment Follow-Up

No new environment variables are needed — `FRONTEND_ORIGIN` already exists in
`backend/.env` and `backend/.env.example`. Its meaning has widened, so it is worth
updating the comment above it to note that it is also the base URL of generated short
links. (The sandbox denies writes to `.env*` files, so that edit has to be made by
hand.)

### Vercel environment variables

Backend project (`short-url-super`):

```
FRONTEND_ORIGIN=https://andy-short-url.vercel.app
```

Frontend project (`andy-short-url`):

```
NEXT_PUBLIC_API_URL=https://short-url-super.vercel.app
```

Both projects need a redeploy for the variables to take effect. If `FRONTEND_ORIGIN` is
unset on the backend it falls back to `http://localhost:3001`, and short links will be
unusable in production.

---

## Known Limitation

An unknown or expired code produces the backend's raw JSON error on the backend domain:

```
GET https://andy-short-url.vercel.app/nope
→ 307 → https://short-url-super.vercel.app/nope
→ 404 {"statusCode":404,"message":"Short URL not found",...}
```

Functionally correct, but the user is left on the API's domain looking at JSON.
Rendering these as frontend error pages is deliberately out of scope for FEAT-5.
