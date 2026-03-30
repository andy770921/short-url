# PRD: Automated Deletion of Expired URLs

## Problem Statement

Expired URLs (older than 30 days) are never deleted from the database. The current system only checks expiration on-demand during redirect requests (returning HTTP 410 Gone), but the rows remain in the `urls` table indefinitely. This leads to:

- Unbounded storage growth in Supabase PostgreSQL
- Slower queries as the table grows (especially deduplication lookups on `longUrl`)
- Stale data that serves no purpose after expiration

## Solution Overview

Use Supabase's built-in **pg_cron** extension to schedule a PostgreSQL function that deletes expired rows monthly (1st of each month). This runs entirely within the database layer — no application code, no network round-trips, no dependency on the NestJS backend process.

The existing on-demand expiration check in `url.service.ts` remains as defense-in-depth — it ensures expired URLs return HTTP 410 immediately, while the cron handles storage reclamation.

## User Stories

1. As a **system operator**, I want expired URLs to be automatically deleted so that the database does not grow unboundedly.
2. As a **system operator**, I want to monitor cleanup job execution so that I can verify it is running correctly.
3. As a **developer**, I want a repository method to trigger cleanup programmatically so that I can use it in tests or future admin endpoints.

## Implementation Decisions

### Approach: Supabase pg_cron

**Why pg_cron over other approaches:**

- The backend deploys to **Vercel as a serverless function** — there is no long-running NestJS process, so `@nestjs/schedule` would never fire in production.
- pg_cron is native to PostgreSQL, available on all Supabase plans (including free tier), and requires zero application-layer infrastructure.
- The DELETE runs directly in the database with no cold starts or network overhead.

See [delete-expiration.md](./delete-expiration.md) for a full comparison of all evaluated approaches.

### Modules

- **SQL Function (`delete_expired_urls`)**: Encapsulates the DELETE logic with logging and row count return.
- **pg_cron Schedule**: Triggers the function monthly (1st of each month at midnight UTC).
- **Performance Index**: `idx_urls_expiration_time` on the `"expirationTime"` column for efficient cleanup scans.
- **Repository Method (`deleteExpired`)**: Optional application-layer access via `supabase.rpc()`.

### Architecture

```
pg_cron (monthly, 1st of each month)
  └─> SELECT delete_expired_urls()
        └─> DELETE FROM urls WHERE "expirationTime" IS NOT NULL AND "expirationTime" < NOW()
              └─> RAISE LOG (deleted count)
```

No changes to the request flow. The existing redirect path (`GET /:shortCode` → `url.service.ts` → 410 Gone) remains unchanged.

### APIs/Interfaces

No new HTTP endpoints required. The cleanup is fully database-side.

Optional: `UrlRepository.deleteExpired(): Promise<number>` — calls the SQL function via `supabase.rpc('delete_expired_urls')` for programmatic access.

## Testing Strategy

1. **SQL Function Verification**: Insert expired test rows, run `SELECT delete_expired_urls()`, verify deletion.
2. **Cron Job Verification**: Query `cron.job` and `cron.job_run_details` tables in Supabase.
3. **Unit Tests**: Test the `deleteExpired()` repository method with mocked Supabase client.
4. **Existing Tests**: Ensure all existing tests still pass (`npm run test`).

## Out of Scope

- Admin UI for managing cleanup schedules
- Configurable cleanup intervals (hardcoded to monthly)
- Soft-delete / archival of expired URLs
- Notifications or alerts on cleanup failures (can be added later via Supabase monitoring)

## Status

- [x] Planning
- [ ] In Development
- [ ] Complete
