# Short Link Base URL — Plan

## Document Information

- **Ticket:** FEAT-5
- **Created:** 2026-09-04
- **Author:** Claude Code
- **Status:** Implemented

## Problem Statement

The production deployment returned short links over plain HTTP:

```
POST https://short-url-super.vercel.app/api/urls
→ { "shortUrl": "http://short-url-super.vercel.app/4ymlZa", ... }
```

The host was correct, the scheme was not. Every short link handed to a user was an
`http://` URL pointing at an HTTPS-only deployment.

A second, product-level issue surfaced alongside it: short links were built from the
**backend** origin (`short-url-super.vercel.app`), so the links users copy and share
carry the API's hostname rather than the product's own domain
(`andy-short-url.vercel.app`).

## Root Cause

`UrlController.createShortUrl` derived the base URL from the incoming request:

```typescript
const baseUrl = `${req.protocol}://${req.get('host')}`;
```

Express computes `req.protocol` from whether the **socket** is encrypted. It only
consults the `X-Forwarded-Proto` header when the `trust proxy` setting is enabled.

On Vercel, TLS terminates at the edge and the serverless function receives plain HTTP,
with the real scheme carried in `X-Forwarded-Proto: https`. Neither
`backend/src/main.ts` nor `backend/api/index.ts` ever set `trust proxy`, so
`req.protocol` evaluated to `'http'` on every request. The value was then interpolated
straight into the response by `UrlService.buildResponse`:

```typescript
shortUrl: `${baseUrl}/${shortCode}`
```

So this was a logic error, not a deployment misconfiguration.

## Options Considered

### Option A — Enable `trust proxy`

Add `app.set('trust proxy', 1)` during bootstrap so `req.protocol` honours
`X-Forwarded-Proto`.

- **Pros:** one line; smallest possible diff.
- **Cons:** leaves the base URL derived from `req.get('host')`, which is
  client-controlled. A caller sending `Host: evil.com` would receive
  `https://evil.com/<code>` back — a Host header injection that turns the API into a
  generator of plausible-looking links on an attacker's domain. It also cannot express
  the requirement that short links live on the frontend domain, because the request
  arrives at the backend.

### Option B — Resolve the base URL from configuration (chosen)

Build short links from an explicit, server-side configured base URL and stop reading
request headers entirely.

- **Pros:** deterministic; immune to Host header injection; the base URL becomes a
  deliberate deployment decision rather than an accident of the proxy chain; naturally
  supports pointing short links at the frontend domain.
- **Cons:** requires a new environment variable per deployment.

`backend/src/main.ts` already contained platform-detection logic for a
`backendOrigin` used by the CORS whitelist. That logic was duplicated conceptually by
what the controller needed, so Option B also removes the duplication by extracting one
shared module.

## Chosen Solution

### 1. Configuration-driven origins

Extract origin resolution into `backend/src/common/config/origins.ts`, exposing two
functions:

| Function | Source | Fallback |
|----------|--------|----------|
| `resolveFrontendOrigin()` | `FRONTEND_ORIGIN` | `http://localhost:3001` |
| `resolveBackendOrigin()` | `RENDER_EXTERNAL_URL` → `VERCEL_URL` → `RAILWAY_PUBLIC_DOMAIN` | `http://localhost:${PORT}` |

Both strip trailing slashes so the `${base}/${code}` concatenation cannot produce a
double slash.

`main.ts` consumes both for the CORS whitelist; `UrlController` consumes
`resolveFrontendOrigin()`, since that is exactly where short links are served from —
one variable, no second source of truth to keep in sync. `req.protocol` and
`req.get('host')` are no longer read anywhere in the codebase.

### 2. Short links on the frontend domain

Short links are minted against the frontend origin, and the frontend forwards the
lookup to the backend:

```
Browser  →  https://andy-short-url.vercel.app/4ymlZa
              │  Next.js middleware (frontend/src/middleware.ts)
              ▼  307 Temporary Redirect
            https://short-url-super.vercel.app/4ymlZa
              │  NestJS RedirectController
              ▼  302 Found
            https://www.booking.com/hotel/pe/terra-sagrada.zh-tw.html?...
```

The middleware matches a **single** path segment of alias-safe characters
(`[a-zA-Z0-9_-]`) up to `CUSTOM_ALIAS_MAX_LENGTH`, which is exactly the shape of a
generated code (6 chars) or a custom alias (≤ 20 chars). Anything else — `/`,
`/api/...`, `_next` assets, static files — falls through untouched.

`307` rather than `301`/`308`: short links expire after 30 days and can be deleted, so
the hop must never be cached permanently by the browser.

### Why a redirect rather than a Next.js rewrite

A rewrite would proxy the backend response through the frontend origin, keeping the
short link's domain in the address bar for the whole exchange. It was rejected because
a redirect makes the two hops explicit and preserves the backend's own status codes
(302 / 404 / 410) verbatim, without depending on how the Next.js proxy handles an
upstream 3xx.

## Environment Variables

No new variables are introduced. The existing `FRONTEND_ORIGIN` does both jobs.

Backend:

| Variable | Purpose | Production value |
|----------|---------|------------------|
| `FRONTEND_ORIGIN` | CORS whitelist **and** the base URL of generated short links | `https://andy-short-url.vercel.app` |

Frontend:

| Variable | Purpose | Production value |
|----------|---------|------------------|
| `NEXT_PUBLIC_API_URL` | Redirect target for the middleware hop | `https://short-url-super.vercel.app` |

A dedicated `SHORT_URL_BASE` was considered and rejected: short links are served by the
frontend, so a second variable could only ever hold the same value as `FRONTEND_ORIGIN`
and would introduce a way for the two to drift apart. Should a separate short domain
(e.g. `https://zap.link`) ever be introduced, splitting the two is a one-function
change in `origins.ts`.

## Risks and Trade-offs

| Risk | Assessment |
|------|------------|
| An extra network hop per short link | One 307 to a Vercel edge; negligible next to the DNS + TLS the browser already pays for the destination site. |
| A misconfigured `FRONTEND_ORIGIN` mints links on the wrong domain | The failure is loud and immediate — the first created link is visibly wrong — and it is a deploy-time constant, not per-request. Strictly better than the previous per-request, client-influenced value. The variable also drives the CORS whitelist, so a wrong value breaks the app visibly rather than silently. |
| Middleware now runs on all non-excluded paths | It performs one regex test and returns `NextResponse.next()`; the route table today is just `/`. |
| Short codes and future frontend routes share a namespace | A future page at `/dashboard` would be shadowed by the pattern. Adding it to the middleware matcher exclusion list is the mitigation; noted for whoever adds the second route. |

## Out of Scope

- **Error presentation.** An unknown or expired code still resolves to the backend's raw
  JSON 404/410 on the backend domain. Rendering these as frontend error pages is a
  separate piece of work.
- **`backend/api/index.ts`.** The Vercel serverless entry point keeps `origin: true`
  for CORS; it is unaffected by this change and was left alone.
- **Migrating existing links.** Codes already stored in Supabase resolve through the new
  path unchanged, because only the response's base URL changed — the stored records
  hold the code, never the full URL.
