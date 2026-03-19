# Architecture RFC: Default QueryFn + Fetcher Layer (Candidate C)

## Summary

Introduce a centralised HTTP fetcher layer (`src/utils/fetchers/`) and move `queryFn` out of individual hooks into the `TanStackQueryProvider` as a global default. Query hooks declare only `queryKey`; the key is automatically converted to a URL path.

## Motivation

The original RFC-B pattern required every hook to supply its own `queryFn`:

```typescript
// Before — each hook knows about the HTTP client
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.health.get(),
  });
}
```

Problems with this approach:
- Every hook imports `apiClient` — tight coupling between query declaration and transport.
- Each hook independently manages error serialisation, timeout, and base URL.
- Streaming and standard fetch share no code path.
- No single place to intercept all outgoing requests (auth headers, error normalisation, timeout).

## Proposed Architecture

### 1. Fetcher Layer (`src/utils/fetchers/`)

A standalone, framework-agnostic HTTP library used by both client and server code.

```
src/utils/fetchers/
├── fetchers.ts         # fetchApi + streamingFetchApi (core, env-agnostic)
├── fetchers.utils.ts   # FetchOptions type, getFetchQueryOptions, parseErrorBody
├── fetchers.error.ts   # ApiResponseError class
└── fetchers.client.ts  # 'use client' — defaultFetchFn, streamingFetchFn
```

**`fetchers.error.ts`** — typed error class with `status`, `statusText`, `body`:
```typescript
export class ApiResponseError<TErrorBody = unknown> extends Error {
  public status: number;
  public statusText: string;
  public body: TErrorBody;
  public hasStatusCode(statusCode: number): boolean;
}
```

**`fetchers.ts`** — core `fetchApi` with timeout, streaming support, and error normalisation. Never imported directly by components.

**`fetchers.client.ts`** (`'use client'`) — resolves backend base URL; called only in browser context:
```typescript
export const defaultFetchFn = async <TResponseData>(
  path: string,
  options?: FetchOptions,
): Promise<TResponseData>
```

> **Note (post-implementation)**: `baseUrl` uses `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'` (pointing directly at the backend) rather than `window.location.origin`. Using `window.location.origin` (`http://localhost:3001`) + path `'health'` hit `/health` on the Next.js server instead of the backend — Next.js rewrites only cover `/api/*`. See `development/implementation-notes.md` §3 for full rationale.

### 2. `stringifyQueryKey` (`src/vendors/tanstack-query/provider.utils.ts`)

Converts a TanStack Query `QueryKey` array into a URL path string:

| queryKey | URL |
|----------|-----|
| `['health']` | `health` |
| `['users', 42]` | `users/42` |
| `['users', ['a', 'b']]` | `users/a/b` |
| `['users', { page: 1, tag: ['x','y'] }]` | `users?page=1&tag=x&tag=y` |

This makes the query key the single source of truth for both cache identity and URL.

### 3. `TanStackQueryProvider` (`src/vendors/tanstack-query/provider.tsx`)

Registers the default `queryFn` globally:

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      throwOnError: true,
      queryFn: async ({ queryKey }) => {
        return defaultFetchFn(stringifyQueryKey(queryKey));
      },
      staleTime: 60 * 1000,
    },
  },
})
```

Every `useQuery` call that omits `queryFn` automatically uses this default.

### 4. Hooks declare only `queryKey`

```typescript
// After — hook is pure data declaration
export function useHealth() {
  return useQuery({ queryKey: ['health'] });
}
```

The transport, base URL, timeout, and error handling all live in the fetcher layer. The hook has zero HTTP knowledge.

## Directory Structure

```
frontend/src/
├── constants/
│   └── common.ts                          # HTTP_STATUS_CODE
├── utils/
│   └── fetchers/
│       ├── fetchers.ts                    # core fetch + stream
│       ├── fetchers.utils.ts              # types + helpers
│       ├── fetchers.error.ts              # ApiResponseError
│       └── fetchers.client.ts             # browser defaultFetchFn
└── vendors/
    └── tanstack-query/
        ├── provider.tsx                   # TanStackQueryProvider
        ├── provider.utils.ts              # stringifyQueryKey
        └── provider.utils.spec.ts         # unit tests
```

## What This Enables

- **Override per-hook**: Any hook can still pass its own `queryFn` to opt out of the default (e.g. streaming queries with `useStreamQuery`).
- **Server fetchers**: A parallel `fetchers.server.ts` can handle SSR/RSC requests with auth headers, token refresh, and Next.js `cache` options — same error normalisation, different base URL resolution.
- **Single timeout/retry config**: Change `REQUEST_TIMEOUT` or retry behaviour in one file.
- **Testability**: `defaultFetchFn` is a plain async function — mock it in unit tests without touching `QueryClient`.

## Testing Strategy

### New Tests

- `provider.utils.spec.ts` — covers `stringifyQueryKey` for arrays, nested arrays, and query-string objects.

### Existing Hooks

- `use-health.ts` — no `queryFn` to mock; test by providing a custom `QueryClient` with a mock `queryFn` in the default options.

## Migration Notes

- `src/lib/api-client.ts` is no longer used by hooks. It can be kept for direct non-hook fetch calls or removed when all endpoints use the default pattern.
- `@tanstack/react-query-devtools` was removed from `providers.tsx` to keep the vendor wrapper minimal; add back at the `app/layout.tsx` level if needed.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `stringifyQueryKey` produces wrong URL for complex keys | Covered by unit tests in `provider.utils.spec.ts` |
| Default `throwOnError: true` breaks existing error boundaries | Ensure every page has an error boundary; or set `throwOnError: false` per hook |
| `window.location.origin` unavailable in SSR | `fetchers.client.ts` is marked `'use client'` — never imported in server components |
| `Promise.race` timeout leaves fetch in flight after rejection | Replaced with `AbortController` — cancels the underlying connection on timeout |
| `parseErrorBody` type cast `'' as TErrorBody` lies to callers | Removed cast; return type is `TErrorBody \| string`, empty string is valid as-is |

## Status

- [x] RFC Approved
- [x] Implementation Complete
- [x] Simplify pass applied (AbortController, type fixes, baseUrl correction)
- [x] Old `queryFn` references removed from hooks
- [x] Ref folders deleted
