# Claude Code Fullstack Boilerplate

A fullstack monorepo featuring a URL shortener built with Next.js frontend and NestJS backend, optimized for Claude Code integration.

## Features

- **Frontend**: Next.js 15 (App Router) + TypeScript + TanStack Query v5 + Tailwind CSS v4 + Jest
- **Backend**: NestJS 11 + TypeScript + Supabase + Jest
- **Shared**: `@repo/shared` — TypeScript types and constants shared between FE and BE
- **Tooling**: ESLint + Prettier + Turborepo + npm workspaces
- **API Docs**: Swagger UI at `/docs`
- **Claude Code**: 6 custom slash commands for structured development

## Quick Start

```bash
# Install all dependencies
npm install

# Copy environment files
cp backend/.env.example backend/.env      # Add SUPABASE_URL and SUPABASE_SERVICE_KEY
cp frontend/.env.example frontend/.env.local  # Optional, defaults to localhost:3000

# Start development servers
npm run dev
# Frontend: http://localhost:3001
# Backend:  http://localhost:3000
# Swagger:  http://localhost:3000/docs
```

## Project Structure

```
├── frontend/             # Next.js 15 App Router application (port 3001)
├── backend/              # NestJS 11 application (port 3000)
├── shared/               # Shared TypeScript types (@repo/shared)
├── .claude/commands/     # Claude Code slash commands
├── documents/            # Work tracking by ticket (FEAT-1, REFACTOR-1, etc.)
├── CLAUDE.md             # Claude Code instructions
├── turbo.json            # Turborepo task configuration
└── package.json          # Root workspaces + scripts
```

## Environment Variables

**`backend/.env`**

| Variable               | Default       | Description               |
| ---------------------- | ------------- | ------------------------- |
| `NODE_ENV`             | `development` | Node environment          |
| `PORT`                 | `3000`        | Server port               |
| `SUPABASE_URL`         | —             | Supabase project URL      |
| `SUPABASE_SERVICE_KEY` | —             | Supabase service role key |

**`frontend/.env.local`**

| Variable              | Default                 | Description      |
| --------------------- | ----------------------- | ---------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Backend base URL |

## API Endpoints

| Method | Path          | Description                                                                 |
| ------ | ------------- | --------------------------------------------------------------------------- |
| `GET`  | `/api/health` | Health check → `{ status, timestamp }`                                      |
| `POST` | `/api/urls`   | Create short URL → `{ shortUrl, shortCode, longUrl, createdAt, expiresAt }` |
| `GET`  | `/:shortCode` | Redirect to original URL (302)                                              |
| `GET`  | `/docs`       | Swagger UI                                                                  |

### Create Short URL

```bash
POST /api/urls
Content-Type: application/json

{
  "longUrl": "https://example.com/very/long/path",
  "customAlias": "my-link"   // optional, max 20 chars, pattern: [a-zA-Z0-9_-]
}
```

Response:

```json
{
  "shortUrl": "http://localhost:3000/my-link",
  "shortCode": "my-link",
  "longUrl": "https://example.com/very/long/path",
  "createdAt": "2026-03-26T10:30:00.000Z",
  "expiresAt": "2026-04-25T10:30:00.000Z"
}
```

## Architecture

### Request Flow

```
Frontend (page.tsx)
  → useCreateShortUrl() hook (TanStack Query mutation)
  → apiClient.urls.create() (lib/api-client.ts)
  → fetchApi() (utils/fetchers/)
  → Next.js rewrite /api/* → http://localhost:3000/*
  → NestJS UrlController POST /api/urls
  → UrlService.createShortUrl()
  → UrlRepository → Supabase PostgreSQL
```

### Shared Types

`shared/src/types/` exports interfaces used by both frontend and backend:

```typescript
import { CreateShortUrlRequest, CreateShortUrlResponse, HealthResponse } from '@repo/shared';
```

### Backend Modules

| Module           | Responsibility                                                   |
| ---------------- | ---------------------------------------------------------------- |
| `AppModule`      | Root module, loads `ConfigModule`                                |
| `SupabaseModule` | Global Supabase client provider (DI token: `SUPABASE_CLIENT`)    |
| `UrlModule`      | URL shortening: controllers, service, repository, code generator |

### URL Code Generation

Generated short codes use MD5 → Base62 conversion (6 chars by default):

- Deterministic: same long URL always attempts the same first code
- Deduplication: returns existing record if same URL already shortened
- Collision handling: up to 20 offset attempts, then random suffix fallback
- Expiration: 30 days from creation

## Commands

```bash
npm install              # Install all dependencies
npm run dev              # Start FE (:3001) + BE (:3000) in parallel
npm run build            # Build all workspaces
npm run test             # Run all tests
npm run lint             # Lint all code
npm run format           # Format all code with Prettier
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

## Claude Code Commands

| Command                                   | Description                                 |
| ----------------------------------------- | ------------------------------------------- |
| `/write-a-prd [TICKET]`                   | Create a PRD through systematic discovery   |
| `/grill-me [TICKET]`                      | Stress-test a plan through questioning      |
| `/tdd [TICKET]`                           | Implement with test-driven development      |
| `/triage-issue [TICKET]`                  | Investigate bugs and create fix plans       |
| `/improve-codebase-architecture [TICKET]` | Find architectural improvements             |
| `/deploy-vercel [TICKET]`                 | Deploy to Vercel with step-by-step guidance |

## Production Deployment (Vercel)

| App      | Root Directory | URL                                |
| -------- | -------------- | ---------------------------------- |
| Frontend | `frontend/`    | https://andy-short-url.vercel.app  |
| Backend  | `backend/`     | https://short-url-super.vercel.app |

The backend runs as a Vercel serverless function via `backend/api/index.ts`. Set `NEXT_PUBLIC_API_URL` in the frontend Vercel project to the deployed backend URL.

> **Note**: Serverless limitations apply — cold starts, 10s timeout, no WebSockets.

## Documentation

See [CLAUDE.md](CLAUDE.md) for detailed project instructions and code conventions.

Work progress is tracked in [documents/](documents/) organized by ticket number.

## License

MIT
