# FEAT-2: Implementation Steps

## Overview

Two RFCs implemented in sequence:

1. **RFC-A**: Shared types package (`shared/`)
2. **RFC-B**: Next.js frontend with TanStack Query + typed API client

---

## Phase 1 — Shared Types Package (RFC-A)

### 1.1 Scaffold `shared/` workspace

**Files to create:**

```
shared/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    └── types/
        ├── api.ts
        └── health.ts
```

**`shared/package.json`**

```json
{
  "name": "@repo/shared",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc --noEmit",
    "lint": "eslint src"
  }
}
```

**`shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### 1.2 Define types

**`shared/src/types/api.ts`**

```typescript
export interface ApiResponse<T> {
  data: T;
  error?: string;
}
```

**`shared/src/types/health.ts`**

```typescript
export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
}
```

**`shared/src/index.ts`**

```typescript
export * from './types/api';
export * from './types/health';
```

### 1.3 Register workspace

In root `package.json`, add `"shared"` to the `workspaces` array:

```json
"workspaces": ["frontend", "backend", "shared"]
```

In `turbo.json`, no changes required (build task auto-discovers all workspaces).

### 1.4 Wire into backend

In `backend/package.json` dependencies:

```json
"@repo/shared": "*"
```

Update `backend/src/app.service.ts`:

```typescript
import { HealthResponse } from '@repo/shared';

getHealth(): HealthResponse { ... }
```

Update `backend/src/app.controller.ts`:

```typescript
import { HealthResponse } from '@repo/shared';

@Get('health')
getHealth(): HealthResponse { ... }
```

---

## Phase 2 — Next.js Frontend with TanStack Query (RFC-B)

### 2.1 Replace frontend contents

Remove all Vite-specific files:

- `vite.config.ts`
- `src/App.tsx`, `src/App.css`, `src/main.tsx`, `src/setupTests.ts`
- `src/App.test.tsx`
- `index.html`

Keep `frontend/` directory (it's the workspace root).

### 2.2 Update `frontend/package.json`

```json
{
  "name": "frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "test": "vitest"
  },
  "dependencies": {
    "@repo/shared": "*",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-query-devtools": "^5.0.0",
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

> **Note**: Dev server moves to port 3001 to avoid conflict with backend on 3000.

### 2.3 `frontend/next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

The `rewrites` rule lets frontend code call `/api/health` without hardcoding the backend URL or hitting CORS in development.

### 2.4 `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### 2.5 Scaffold App Router structure

**`frontend/src/app/providers.tsx`** — client-side TanStack Query provider:

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

**`frontend/src/app/layout.tsx`**:

```tsx
import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = { title: 'Fullstack App' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 2.6 API client

**`frontend/src/lib/api-client.ts`**:

```typescript
import type { HealthResponse } from '@repo/shared';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  health: {
    get: () => get<HealthResponse>('/api/health'),
  },
};
```

> When `NEXT_PUBLIC_API_URL` is empty (default in dev), calls go to `/api/health` which Next.js rewrites to `http://localhost:3000/health` — no CORS needed.

### 2.7 TanStack Query hook

**`frontend/src/queries/use-health.ts`**:

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.health.get(),
  });
}
```

### 2.8 Home page

**`frontend/src/app/page.tsx`**:

```tsx
'use client';

import { useHealth } from '@/queries/use-health';

export default function Home() {
  const { data, isPending, error } = useHealth();

  return (
    <main>
      <h1>Frontend App</h1>
      {isPending && <p>Checking backend status…</p>}
      {error && <p>Error: {error.message}</p>}
      {data && (
        <p>
          Backend: <strong>{data.status}</strong> — {data.timestamp}
        </p>
      )}
    </main>
  );
}
```

### 2.9 Update `frontend/vercel.json`

```json
{
  "framework": "nextjs"
}
```

### 2.10 `frontend/.env.local` (dev only, gitignored)

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Phase 3 — Fetcher Layer + Default QueryFn (RFC-C)

### 3.1 Create `src/constants/common.ts`

```typescript
export const HTTP_STATUS_CODE = {
  REQUEST_TIMEOUT: 408,
};
```

### 3.2 Create `src/utils/fetchers/`

Four files in order of dependency:

1. `fetchers.error.ts` — `ApiResponseError` (standalone, no deps)
2. `fetchers.utils.ts` — `FetchOptions`, `getFetchQueryOptions`, `parseErrorBody`
3. `fetchers.ts` — `fetchApi` + `streamingFetchApi` (imports 1 & 2 + `@/constants/common`)
4. `fetchers.client.ts` — `'use client'`, `defaultFetchFn`, `streamingFetchFn` (imports 3 & 2)

### 3.3 Create `src/vendors/tanstack-query/`

1. `provider.utils.ts` — `stringifyQueryKey(queryKey: QueryKey): string` (imports `lodash-es`)
2. `provider.utils.spec.ts` — unit tests for `stringifyQueryKey`
3. `provider.tsx` — `TanStackQueryProvider` with global `queryFn: ({ queryKey }) => defaultFetchFn(stringifyQueryKey(queryKey))`

### 3.4 Add `lodash-es` to `frontend/package.json`

```json
"dependencies": {
  "lodash-es": "^4.17.21"
},
"devDependencies": {
  "@types/lodash-es": "^4.17.12"
}
```

### 3.5 Update `src/app/providers.tsx`

Replace the inline `QueryClientProvider` setup with `TanStackQueryProvider`:

```tsx
import TanStackQueryProvider from '@/vendors/tanstack-query/provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return <TanStackQueryProvider>{children}</TanStackQueryProvider>;
}
```

### 3.6 Remove `queryFn` from hooks

```typescript
// src/queries/use-health.ts — before
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.health.get(),
  });
}

// After — queryFn provided by TanStackQueryProvider default
export function useHealth() {
  return useQuery({ queryKey: ['health'] });
}
```

`queryKey: ['health']` → `stringifyQueryKey` → `'health'` → `defaultFetchFn('health')` → `GET /health`

### 3.7 Delete reference folders

- `frontend/tanstack-query-ref/`
- `frontend/fetchers-ref/`

---

## Phase 4 — Cleanup & Verification

### 4.1 Update root `package.json` workspaces

```json
"workspaces": ["frontend", "backend", "shared"]
```

### 4.2 Update `turbo.json`

Add `shared#build` as dependency for frontend and backend builds if needed. For type-only shared package (no compilation step), no change required.

### 4.3 Update CLAUDE.md

- Frontend: http://localhost:3001 (was :5173)
- Note shared types package at `shared/`

### 4.4 Smoke test checklist

- [ ] `npm install` — no errors
- [ ] `npm run dev` — both apps start (BE :3000, FE :3001)
- [ ] Navigate to http://localhost:3001 — health status shown from backend
- [ ] `npm run build` — both apps build successfully
- [ ] `npm run lint` — no errors
- [ ] TypeScript: changing `HealthResponse` in `shared/` causes compile errors in both apps

---

## Port Reference

| Service            | Dev Port |
| ------------------ | -------- |
| Backend (NestJS)   | 3000     |
| Frontend (Next.js) | 3001     |
