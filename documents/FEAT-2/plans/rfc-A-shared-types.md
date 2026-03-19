# Architecture RFC: Shared Types Package (Candidate A)

## Summary

Introduce a `shared/` npm workspace package that centralises all TypeScript types and interfaces shared between the frontend and backend. Both apps depend on this package; neither duplicates type definitions.

## Motivation

Every API endpoint today requires manually mirroring request/response types in both apps. As soon as a field is renamed or a new one is added on the backend, the frontend silently diverges. A shared package eliminates this class of bug at compile time.

## Current State

### Friction Points

- `getHealth()` return type `{ status: string; timestamp: string }` is defined inline in `app.service.ts` and not available to the frontend at all.
- The inline return type annotation on `app.controller.ts:14` is the only "contract" — it lives inside the backend and is unreachable from frontend code.
- Adding any new endpoint requires copy-pasting type definitions into both codebases.

### Affected Modules

- `backend/src/app.service.ts` — inline return types
- `backend/src/app.controller.ts` — inline return types
- `frontend/src/` — no types exist; must be added manually per endpoint

## Proposed Interface

### Package Structure

```
shared/
├── package.json          # name: "@repo/shared"
├── tsconfig.json
└── src/
    ├── index.ts          # barrel export
    └── types/
        ├── api.ts        # generic API response envelope
        └── health.ts     # HealthResponse type
```

### Signature

```typescript
// shared/src/types/api.ts
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

// shared/src/types/health.ts
export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
}

// shared/src/index.ts
export * from './types/api';
export * from './types/health';
```

### Usage Example

```typescript
// backend/src/app.service.ts
import { HealthResponse } from '@repo/shared';

getHealth(): HealthResponse {
  return { status: 'ok', timestamp: new Date().toISOString() };
}

// frontend/src/lib/api.ts
import { HealthResponse } from '@repo/shared';

export async function fetchHealth(): Promise<HealthResponse> { ... }
```

### What It Hides

- Type duplication across apps
- Manual synchronisation burden
- Risk of silent contract drift

## Dependency Strategy

- **Category**: In-process
- **Approach**: Pure TypeScript declarations, zero runtime dependencies. Built once; both apps import directly from the workspace package via npm workspaces path resolution.

## Testing Strategy

### New Boundary Tests

- TypeScript compiler rejects any backend response that doesn't satisfy the shared type.
- TypeScript compiler rejects any frontend handler that misuses the shared type.
- (These are compile-time tests, not runtime — no new test files needed initially.)

### Tests to Remove

- Inline type assertions in `app.controller.spec.ts` that hardcode `{ status: string; timestamp: string }` — replace with the shared `HealthResponse` import.

## Migration Plan

1. Create `shared/` directory with `package.json` (name: `@repo/shared`), `tsconfig.json`, and `src/index.ts`.
2. Add `"shared"` to `workspaces` array in root `package.json`.
3. Define initial types: `HealthResponse`, `ApiResponse<T>`.
4. Add `"@repo/shared": "*"` to `backend/package.json` and `frontend/package.json` dependencies.
5. Replace inline return types in `app.service.ts` and `app.controller.ts` with shared imports.
6. Use shared types in frontend API client (see RFC-B).

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Backend and frontend on different Node versions might resolve the package differently | Pin Node version in `.nvmrc`; use workspace `*` version |
| tsconfig path differences (CommonJS vs ESM) | `shared/tsconfig.json` targets `ES2020`, `module: CommonJS` — importable from both |
| Breaking change if a shared type is modified | TypeScript will surface all affected call sites at compile time |

## Status

- [ ] RFC Approved
- [ ] Implementation Started
- [ ] Migration Complete
- [ ] Old Code Removed
