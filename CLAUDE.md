# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fullstack URL shortener monorepo with Next.js frontend and NestJS backend. Uses npm workspaces + Turborepo for unified dependency management.

```
├── frontend/           # Next.js 15 (App Router) + TanStack Query + Jest — port 3001
├── backend/            # NestJS 11 + Supabase + nodemon — port 3000
├── shared/             # Shared TypeScript types (@repo/shared)
├── .claude/commands/   # Custom slash commands
├── documents/          # Work tracking (organized by ticket)
├── turbo.json          # Turborepo configuration
└── package.json        # npm workspaces root
```

## Commands

```bash
npm install              # Install all dependencies
npm run dev              # Start FE (:3001) + BE (:3000) in parallel
npm run build            # Build all workspaces
npm run test             # Run all tests
npm run lint             # Lint all code
```

**Backend tests:**
```bash
cd backend && npm run test          # Jest unit tests
cd backend && npm run test:watch    # Watch mode
cd backend && npm run test:cov      # Coverage report
cd backend && npm run test:e2e      # E2E tests
```

**Run a single test file:**
```bash
cd frontend && npx jest src/path/to/file.spec.ts
cd backend  && npx jest src/path/to/file.spec.ts
```

## Architecture

### Request Flow

Frontend `page.tsx` (URL shortener form) → `useCreateShortUrl()` mutation hook → `apiClient.urls.create()` (`frontend/src/lib/api-client.ts`) → `fetchApi()` (`frontend/src/utils/fetchers/`) → Next.js rewrite `/api/*` → `http://localhost:3000/*` → NestJS `UrlController` → `UrlService` → `UrlRepository` → Supabase PostgreSQL.

- **API client**: `frontend/src/lib/api-client.ts` — typed wrapper using shared types; constructs URLs from `NEXT_PUBLIC_API_URL`
- **TanStack Query provider**: `frontend/src/app/providers.tsx` — default query fn uses `stringifyQueryKey` to turn key arrays into URL paths
- **Query hooks**: `frontend/src/queries/` — `useHealth` (query) and `useCreateShortUrl` (mutation)

### Shared Types

`shared/src/types/` exports interfaces and constants used by both FE and BE:
- `HealthResponse` — `{ status: 'ok' | 'error', timestamp: string }`
- `ApiResponse<T>` — generic wrapper
- `CreateShortUrlRequest` — `{ longUrl: string, customAlias?: string }`
- `CreateShortUrlResponse` — `{ shortUrl, shortCode, longUrl, createdAt, expiresAt }`
- `CUSTOM_ALIAS_MAX_LENGTH` — `20`
- `CUSTOM_ALIAS_PATTERN` — `/^[a-zA-Z0-9_-]+$/`

Import as: `import { CreateShortUrlRequest } from '@repo/shared'`

### Backend Structure

- `src/main.ts` — bootstraps NestJS, global `ValidationPipe` (whitelist + transform), CORS (`origin: true, credentials: true`), Swagger UI at `/docs`
- `src/app.module.ts` — root module; imports `ConfigModule` (global), `SupabaseModule`, `UrlModule`
- `src/supabase/` — global `SupabaseModule` provides `SUPABASE_CLIENT` injection token; built from `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` env vars
- `src/url/` — full URL shortener feature:
  - `url.controller.ts` — `POST /api/urls`
  - `redirect.controller.ts` — `GET /:shortCode` → 302 redirect (excluded from Swagger)
  - `url.service.ts` — business logic: deduplication, collision handling, expiration
  - `url.repository.ts` — Supabase queries on `urls` table (`shortUrl`, `longUrl`, `creationTime`, `expirationTime`)
  - `url-code-generator.ts` — MD5 → Base62, 6-char codes, up to 20 collision offsets then random suffix
  - `url.constant.ts` — `SHORT_CODE_LENGTH: 6`, `MAX_COLLISION_ATTEMPTS: 20`, `EXPIRATION_DAYS: 30`
- `src/dto/` — DTOs implement shared interfaces and add `@ApiProperty` decorators
- `api/index.ts` — Vercel serverless handler (singleton NestJS app)

### Environment Variables

Copy `.env.example` to `.env` in each workspace before running:
- `backend/.env` — `NODE_ENV`, `PORT` (default 3000), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`)

## Code Style

- **Prettier**: semi, 2-space tabs, 100 print width, single quotes, trailing commas
- **ESLint**: unified root `.eslintrc.js` — TypeScript, Next.js, Prettier; all packages at root
- **TypeScript**: strict mode; frontend uses `moduleResolution: bundler`; backend uses CommonJS + decorators; shared uses CommonJS

## Documentation Pattern

Work is tracked in `documents/[TICKET-NUMBER]/`:
```
documents/FEAT-1/
├── plans/        # PRDs, RFCs, design decisions
└── development/  # Implementation docs
```

## Custom Slash Commands

Located in `.claude/commands/[skill-name]/SKILL.md`. Replace `[TICKET]` with ticket ID (e.g., `FEAT-1`).

| Command | Description |
|---------|-------------|
| `/write-a-prd [TICKET]` | Create a PRD through systematic discovery |
| `/grill-me [TICKET]` | Stress-test a plan through questioning |
| `/tdd [TICKET]` | Implement features with test-driven development |
| `/triage-issue [TICKET]` | Investigate bugs and create fix plans |
| `/improve-codebase-architecture [TICKET]` | Find architectural improvements |
| `/deploy-vercel [TICKET]` | Deploy to Vercel with step-by-step guidance |

## Deployment (Vercel)

- **Frontend**: set root directory `frontend`, auto-detected as Next.js
- **Backend**: set root directory `backend`, runs as serverless function via `backend/api/index.ts`
- Backend serverless limitations: cold starts, no WebSockets, 10s timeout
