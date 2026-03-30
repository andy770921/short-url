# Approach Comparison: Deleting Expired URLs

## Background

The URL shortener creates URLs with a 30-day expiration (`"expirationTime"` column, TIMESTAMPTZ). Expired URLs are currently handled on-demand during redirect (HTTP 410 Gone) but are never deleted from the database.

This document compares five approaches for automated cleanup.

## Critical Constraint

**The backend is deployed to Vercel as a serverless function** (`backend/api/index.ts`). There is no long-running NestJS process in production. Each request bootstraps the app (with a singleton cache for warm starts). This eliminates any approach that requires a persistent application process.

## Approach Comparison

| Criterion | **Supabase pg_cron** | **NestJS @nestjs/schedule** | **Supabase Edge Functions** | **On-Demand (Lazy)** | **External Cron (GitHub Actions)** |
|---|---|---|---|---|---|
| Works with Vercel serverless? | Yes | **NO** | Yes | Yes | Yes |
| Reliability | High — PostgreSQL native | N/A (broken in prod) | Medium — depends on Edge runtime | Low — depends on traffic | Medium — depends on GH Actions uptime |
| Operational complexity | Low — 2 SQL statements | N/A | Medium — new function + deploy pipeline | Low — code change only | Medium — workflow YAML + secrets |
| Supabase free tier | Included | N/A | 500K invocations/month | Zero cost | 2000 min/month free |
| Monitoring | `cron.job_run_details` table | N/A | Supabase dashboard logs | No visibility | GitHub Actions UI |
| Latency impact on requests | Zero — async in DB | N/A | Zero — async | Adds latency to redirects | Zero — async |
| Implementation effort | Very low | N/A | Medium | Low | Low-medium |
| Network round-trips | Zero — runs in DB | N/A | 1 (Edge → DB) | 0 (piggybacks on request) | 1 (GH Actions → Supabase API) |

## Detailed Analysis

### 1. Supabase pg_cron (Recommended)

**How it works:** Create a SQL function that DELETEs expired rows, then schedule it with pg_cron (PostgreSQL's built-in job scheduler). pg_cron is enabled on all Supabase projects.

**Pros:**
- Runs entirely within PostgreSQL — zero application dependency
- No cold starts, no network overhead
- Survives app deployments and outages
- Built-in monitoring via `cron.job_run_details`
- Available on Supabase free tier
- Trivially simple: 2 SQL statements

**Cons:**
- Must be configured via Supabase SQL Editor (not in application code)
- Minimum resolution: 1 minute (sufficient for cleanup)
- Cannot easily trigger from application code (mitigated by adding `supabase.rpc()` wrapper)

### 2. NestJS @nestjs/schedule (Disqualified)

**How it works:** Install `@nestjs/schedule`, use `@Cron()` decorator on a service method.

**Why disqualified:** The backend runs as a Vercel serverless function. There is no persistent process. The cron decorator would only fire during local development, creating a dangerous split between dev and prod behavior. **Do not use this approach.**

### 3. Supabase Edge Functions

**How it works:** Deploy a Deno-based Edge Function that calls `supabase.from('urls').delete()`. Trigger it via pg_cron or an external scheduler.

**Pros:**
- Familiar TypeScript/JavaScript runtime
- Can include complex business logic

**Cons:**
- Requires a separate deployment pipeline (Supabase CLI)
- Adds a network round-trip (Edge Function → PostgreSQL)
- More moving parts for a simple DELETE query
- Overkill for this use case

### 4. On-Demand (Lazy) Deletion

**How it works:** During each redirect request, also delete the expired row (or batch-delete expired rows).

**Pros:**
- No external infrastructure needed
- Zero operational overhead

**Cons:**
- Adds latency to the hot path (redirect requests)
- If traffic drops to zero, expired rows accumulate forever
- Mixes cleanup concerns with request handling
- Non-deterministic — cleanup depends on traffic patterns

### 5. External Cron (GitHub Actions)

**How it works:** A GitHub Actions workflow runs on a cron schedule, calling the Supabase REST API or a backend endpoint to trigger deletion.

**Pros:**
- Familiar CI/CD tooling
- No database-side configuration needed

**Cons:**
- Requires storing Supabase credentials in GitHub Secrets
- Adds external dependency (GitHub Actions uptime)
- Network round-trip for each execution
- Harder to monitor from Supabase dashboard
- GitHub Actions cron has ±5 minute jitter

## Recommendation

**Use Supabase pg_cron.** It is the simplest, most reliable, and most operationally lightweight approach. It runs where the data lives (inside PostgreSQL), has zero external dependencies, and is available on all Supabase plans.

The existing on-demand expiration check (`url.service.ts:82`, returning HTTP 410 Gone) should remain as defense-in-depth — it ensures expired URLs are rejected immediately, while the monthly cron handles storage reclamation.
