-- ============================================================
-- FEAT-3: Automated Deletion of Expired URLs
-- Run these statements in Supabase SQL Editor (Dashboard)
-- ============================================================

-- Step 1: Add index for efficient cleanup scans
-- The DELETE query filters on "expirationTime", so an index
-- prevents full table scans as the table grows.
CREATE INDEX IF NOT EXISTS idx_urls_expiration_time
  ON urls ("expirationTime");

-- Step 2: Create the cleanup function
-- Returns the number of deleted rows and logs to PostgreSQL.
CREATE OR REPLACE FUNCTION delete_expired_urls()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- LIMIT 5000 prevents long-running locks if a large backlog
  -- accumulates (e.g., after cron was disabled). The monthly
  -- schedule will chip away at the backlog over multiple runs.
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

-- Step 3: Schedule the cleanup job (monthly — 1st of each month at midnight UTC)
-- Requires pg_cron extension (enabled by default on Supabase).
SELECT cron.schedule(
  'delete-expired-urls',
  '0 0 1 * *',
  $$SELECT delete_expired_urls();$$
);

-- ============================================================
-- Verification Queries (run after setup)
-- ============================================================

-- Check the job is registered:
-- SELECT * FROM cron.job WHERE jobname = 'delete-expired-urls';

-- Check run history (after the next monthly run):
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'delete-expired-urls')
-- ORDER BY start_time DESC
-- LIMIT 5;

-- Manual test:
-- SELECT delete_expired_urls();

-- ============================================================
-- To unschedule (if needed):
-- SELECT cron.unschedule('delete-expired-urls');
-- ============================================================
