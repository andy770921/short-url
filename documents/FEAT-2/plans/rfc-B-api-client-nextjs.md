# Architecture RFC: Typed API Client with Next.js + TanStack Query (Candidate B)

## Summary

Replace the Vite + React frontend with Next.js (App Router). Introduce a single typed API client module backed by shared types (RFC-A), and wrap all server data fetching with TanStack Query v5 custom hooks. Components become consumers of hooks — they never know about HTTP, URLs, or error shapes.

## Motivation

Without this layer:

- Every component that needs backend data must know the URL, HTTP method, headers, error shape, and response type — 5 separate concerns per call site.
- No caching, deduplication, or loading/error state management out of the box.
- No type safety at the HTTP boundary.

With this module:

- A component calls `useHealth()` — it gets `{ data, isPending, error }` back.
- Retries, deduplication, cache invalidation, and stale-while-revalidate are handled by TanStack Query.
- The API client is the single place that knows about the backend URL and response shape.

## Current State

### Friction Points

- Frontend is Vite + React — no file-system routing, no server components, no built-in API route support.
- Zero API calls exist today; the pattern established for the first call becomes the template for all future calls.
- No HTTP client abstraction — future callers would scatter `fetch('/api/...')` across components.
- No loading / error state conventions.

### Affected Modules

- `frontend/` — entire directory replaced with Next.js app
- `frontend/src/App.tsx` — replaced by `frontend/src/app/page.tsx`
- `frontend/vite.config.ts` — replaced by `next.config.ts`
- `frontend/vercel.json` — updated for Next.js deployment
- `frontend/package.json` — swapped dependencies

## Proposed Interface

### API Client (`src/lib/api-client.ts`)

```typescript
// Single entry point for all HTTP calls.
// Knows the base URL; returns typed data or throws typed errors.

export const apiClient = {
  health: {
    get: (): Promise<HealthResponse> => get('/health'),
  },
  // future: users, posts, etc.
};
```

### TanStack Query Hooks (`src/queries/`)

```typescript
// src/queries/use-health.ts
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.health.get(),
  });
}
```

### Component Usage

```tsx
// src/app/page.tsx — component knows nothing about HTTP
function StatusPage() {
  const { data, isPending, error } = useHealth();

  if (isPending) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;
  return (
    <p>
      Status: {data.status} at {data.timestamp}
    </p>
  );
}
```

### What It Hides

- Backend base URL (`NEXT_PUBLIC_API_URL` env var)
- HTTP method, headers, Content-Type
- Response parsing (`res.json()`)
- Error normalisation (non-2xx → throw)
- Cache strategy (stale time, retry count)
- Loading and error state machine

## Directory Structure (Next.js App Router)

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout: wraps with QueryClientProvider
│   │   ├── page.tsx          # Home page
│   │   └── providers.tsx     # 'use client' — TanStack Query provider
│   ├── queries/
│   │   └── use-health.ts     # TanStack Query custom hook
│   └── lib/
│       └── api-client.ts     # Typed HTTP client
├── next.config.ts
├── package.json
├── tsconfig.json
└── vercel.json
```

## Dependency Strategy

- **Category**: True external (Mock)
- **Approach**: `apiClient` is the single mocked boundary in tests. Components and hooks are tested against a mock `apiClient`, never against real HTTP. TanStack Query's `QueryClient` is reset between tests.

## Environment Variables

| Variable              | Purpose          | Default                 |
| --------------------- | ---------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | Backend base URL | `http://localhost:3000` |

## Testing Strategy

### New Boundary Tests

- `api-client.test.ts` — mock `fetch`, assert correct URL/method/headers per endpoint.
- `use-health.test.ts` — mock `apiClient.health.get`, assert hook states (loading → data, loading → error).
- `page.test.tsx` — mock `useHealth`, assert rendered output for each state.

### Tests to Remove

- `src/App.test.tsx` — component no longer exists; replaced by page-level tests.

## Migration Plan

1. **Prep**: Complete RFC-A (shared types package) first — API client depends on `@repo/shared`.
2. **Replace frontend**: Remove Vite+React `frontend/` contents; scaffold Next.js 15 with App Router into the same directory.
3. **Install TanStack Query**: `@tanstack/react-query` + `@tanstack/react-query-devtools`.
4. **Create providers**: `src/app/providers.tsx` (QueryClientProvider, 'use client').
5. **Update layout**: `src/app/layout.tsx` wraps children with `<Providers>`.
6. **Create API client**: `src/lib/api-client.ts` — base `get/post` helpers + endpoint map.
7. **Create hooks**: `src/queries/use-health.ts`.
8. **Build demo page**: `src/app/page.tsx` calls `useHealth()` and renders status.
9. **Update vercel.json**: Next.js framework preset.
10. **Update CLAUDE.md**: Note port change if any.

## Risks and Mitigations

| Risk                                         | Mitigation                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| App Router is more complex than Pages Router | Use minimal App Router features; document the pattern clearly                                      |
| CORS in local dev (FE :5173 → BE :3000)      | Backend already has `origin: true`; Next.js dev can use `rewrites` in `next.config.ts` as fallback |
| TanStack Query v5 API differs from v4        | Use v5 throughout; no mixing                                                                       |
| `NEXT_PUBLIC_API_URL` missing in CI          | Set a default fallback in `api-client.ts`                                                          |

## Status

- [ ] RFC Approved
- [ ] Implementation Started
- [ ] Migration Complete
- [ ] Old Code Removed
