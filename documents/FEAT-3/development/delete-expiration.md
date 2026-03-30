# Implementation Plan: Delete Expired URLs

## Overview

This document covers the full implementation for automated deletion of expired URLs. The work is split into two areas:

1. **Supabase SQL operations** — run manually in the Supabase Dashboard SQL Editor
2. **Backend code changes** — modifications to the NestJS application

## Part 1: Supabase SQL Operations

These steps must be performed in the **Supabase Dashboard → SQL Editor**.

The complete SQL script is available at: `documents/FEAT-3/development/cleanup-expired-urls.sql`

### Step 1: Create Performance Index

```sql
CREATE INDEX IF NOT EXISTS idx_urls_expiration_time
  ON urls ("expirationTime");
```

**Why:** The periodic DELETE filters on `"expirationTime" < NOW()`. Without an index, PostgreSQL performs a sequential scan. The index makes the cleanup query efficient as the table grows.

### Step 2: Create the Cleanup Function

```sql
CREATE OR REPLACE FUNCTION delete_expired_urls()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM urls
  WHERE "shortUrl" IN (
    SELECT "shortUrl" FROM urls
    WHERE "expirationTime" IS NOT NULL
      AND "expirationTime" < NOW()
    LIMIT 5000
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'delete_expired_urls: removed % expired rows', deleted_count;
  RETURN deleted_count;
END;
$$;
```

**Key design decisions:**
- `LIMIT 5000` — prevents long-running locks if a large backlog accumulates (e.g., after cron was disabled); the monthly schedule chips away at backlogs over multiple runs
- `WHERE "expirationTime" IS NOT NULL` — protects rows with no expiration (future-proofing for permanent URLs)
- `GET DIAGNOSTICS` — captures deleted row count for logging
- `RAISE LOG` — writes to PostgreSQL logs (visible in Supabase Dashboard → Logs → Postgres)
- Returns `INTEGER` — enables verification via `SELECT delete_expired_urls()`
- Column name `"expirationTime"` is double-quoted camelCase, matching the existing schema

### Step 3: Schedule the pg_cron Job

```sql
SELECT cron.schedule(
  'delete-expired-urls',
  '0 0 1 * *',
  $$SELECT delete_expired_urls();$$
);
```

**Why monthly (1st of each month at midnight UTC)?**
- Expired URLs are already handled on-demand (HTTP 410 Gone), so the cron is hygiene, not correctness
- URLs expire after 30 days — monthly cleanup matches the expiration cycle
- Low overhead — a simple indexed DELETE runs quickly even with accumulated rows

### Verification (Supabase SQL Editor)

```sql
-- 1. Insert an expired test row
INSERT INTO urls ("shortUrl", "longUrl", "creationTime", "expirationTime")
VALUES ('test-expired', 'https://example.com', NOW() - INTERVAL '31 days', NOW() - INTERVAL '1 day');

-- 2. Insert a non-expired test row
INSERT INTO urls ("shortUrl", "longUrl", "creationTime", "expirationTime")
VALUES ('test-active', 'https://example.com/active', NOW(), NOW() + INTERVAL '29 days');

-- 3. Run the function
SELECT delete_expired_urls();
-- Expected: returns 1

-- 4. Verify expired row is deleted
SELECT * FROM urls WHERE "shortUrl" = 'test-expired';
-- Expected: 0 rows

-- 5. Verify active row still exists
SELECT * FROM urls WHERE "shortUrl" = 'test-active';
-- Expected: 1 row

-- 6. Clean up test data
DELETE FROM urls WHERE "shortUrl" = 'test-active';
```

### Monitoring

```sql
-- Check job is registered
SELECT * FROM cron.job WHERE jobname = 'delete-expired-urls';

-- Check run history (after the next monthly run)
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'delete-expired-urls')
ORDER BY start_time DESC
LIMIT 5;
```

### Unscheduling (if needed)

```sql
SELECT cron.unschedule('delete-expired-urls');
```

---

## Part 2: Backend Code Changes

### Step 1: Add `deleteExpired()` to `UrlRepository`

**File:** `backend/src/url/url.repository.ts`

**Change:** Add a new method that calls the SQL function via Supabase RPC.

```typescript
async deleteExpired(): Promise<number> {
  const supabase = this.ensureSupabaseAvailable();

  const { data, error } = await supabase.rpc('delete_expired_urls');

  if (error) {
    throw new ServiceUnavailableException(
      'Failed to delete expired URLs: ' + error.message,
    );
  }

  return data as number;
}
```

**Rationale:** While pg_cron handles the scheduled cleanup, this method provides:
- Programmatic access for future admin endpoints
- Testability via the existing mock Supabase pattern
- Consistency with the repository pattern (all DB operations go through `UrlRepository`)

### Step 2: Add Unit Tests

**File:** `backend/src/url/url.repository.spec.ts`

**Change:** Add a `describe('deleteExpired')` block with two tests:

1. **Success case**: Mock `supabase.rpc()` returning `{ data: 5, error: null }`, verify it returns `5`
2. **Error case**: Mock `supabase.rpc()` returning an error, verify it throws `ServiceUnavailableException`

### What NOT to Change

- **Do NOT modify `url.service.ts`** — the on-demand expiration check at line 82 must remain as defense-in-depth
- **Do NOT install `@nestjs/schedule`** — it will not work on Vercel serverless
- **Do NOT remove any existing tests** — all existing behavior is preserved

## Testing Steps

1. Run `cd backend && npx jest src/url/url.repository.spec.ts` to verify new tests pass
2. Run `npm run test` from root to verify no regressions
3. Execute the verification SQL in Supabase SQL Editor (see Part 1)
4. After the next monthly run, check `cron.job_run_details` for successful runs

## Dependencies

- **Part 1 (SQL)** and **Part 2 (Backend)** are independent and can be done in any order
- The `deleteExpired()` method depends on the SQL function existing in Supabase (will fail with "function not found" if the SQL hasn't been run yet)

## Notes

- The SQL function and cron job run in Supabase's infrastructure — they are not part of the application deployment and must be configured separately via the Dashboard
- If the project later needs to track these SQL changes in version control, consider adding a migrations folder (e.g., `backend/migrations/`) — but this is out of scope for FEAT-3
