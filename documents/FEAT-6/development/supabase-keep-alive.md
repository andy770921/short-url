# Supabase Keep-Alive — Implementation

## Document Information

- **Ticket:** FEAT-6
- **Created:** 2026-11-03
- **Revised:** 2026-11-03 — GitHub Actions workflow replaced by Vercel Cron; `outputDirectory`
  added after the first deploy failed
- **Author:** Claude Code
- **Plan:** [../plans/supabase-keep-alive.md](../plans/supabase-keep-alive.md)

## Changes

| File                                        | Change                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `backend/src/app.service.ts`                | Injects `SUPABASE_CLIENT`; adds `getDatabaseHealth()`                        |
| `backend/src/app.controller.ts`             | Adds `GET /api/health/db` with `Cache-Control: no-store`                     |
| `backend/src/app.controller.spec.ts`        | Provides a mocked `SUPABASE_CLIENT`; covers ok / query error / unconfigured  |
| `backend/vercel.json`                       | Migrated from legacy `builds` + `routes`; adds three `crons` entries         |
| `.github/workflows/supabase-keep-alive.yml` | **Removed.** It was the first scheduler; see the plan for why it was dropped |

No new environment variables, no secrets, no database changes.

## Endpoint Behaviour

```
GET /api/health/db
```

| Situation                                    | Status | Body                                                              |
| -------------------------------------------- | ------ | ----------------------------------------------------------------- |
| Query succeeds                               | `200`  | `{ "status": "ok", "timestamp": "<ISO 8601>" }`                   |
| Supabase env vars missing                    | `503`  | `Database connection is not configured`                           |
| Query returns an error (e.g. project paused) | `503`  | `Database is unreachable`. Driver message is logged, not returned |

The query is `supabase.from('urls').select('shortUrl').limit(1)`. That is a real PostgREST
request against a user table, which is the kind of activity Supabase counts.

## Cron Schedule

| Schedule     | Fires between (UTC) | Fires between (Taiwan, UTC+8) |
| ------------ | ------------------- | ----------------------------- |
| `0 1 * * *`  | 01:00–01:59         | 09:00–09:59                   |
| `0 9 * * *`  | 09:00–09:59         | 17:00–17:59                   |
| `0 17 * * *` | 17:00–17:59         | 01:00–01:59 (next day)        |

On the Hobby plan, Vercel picks the minute within the hour. Each job runs only against the
production deployment.

## `backend/vercel.json`

Before:

```json
{
  "version": 2,
  "builds": [{ "src": "api/index.ts", "use": "@vercel/node" }],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.ts",
      "methods": ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    }
  ]
}
```

After:

```json
{
  "version": 2,
  "framework": null,
  "installCommand": "cd .. && npm install --include=dev && cd shared && npm run build",
  "buildCommand": "mkdir -p public && touch public/.gitkeep",
  "outputDirectory": "public",
  "functions": {
    "api/index.ts": {
      "includeFiles": "../shared/**/*"
    }
  },
  "rewrites": [{ "source": "/(.*)", "destination": "/api/index.ts" }],
  "crons": [
    { "path": "/api/health/db", "schedule": "0 1 * * *" },
    { "path": "/api/health/db", "schedule": "0 9 * * *" },
    { "path": "/api/health/db", "schedule": "0 17 * * *" }
  ]
}
```

Notes:

- **HEAD requests** still reach NestJS. `rewrites` apply to every method, which replaces the
  explicit `methods` list added in `c5882f4`.
- **`@repo/shared`** is still resolved at runtime (`CUSTOM_ALIAS_PATTERN` and
  `CUSTOM_ALIAS_MAX_LENGTH` are runtime values). `installCommand` installs from the
  monorepo root, and `includeFiles` ships `../shared` with the function. `shared/dist` is
  committed in this repo, and the install step rebuilds it anyway.
- **`outputDirectory` is required.** With `framework: null` ("Other") and a build command,
  Vercel requires a static output directory. The first deploy of this config used
  `"buildCommand": "true"` and failed with
  `STATIC_BUILD_NO_OUT_DIR: No Output Directory named "public" found`. An empty `public/`
  fails too, with `STATIC_BUILD_EMPTY_OUT_DIR`. The build command therefore writes
  `public/.gitkeep`, which is the only static file. Do not put an `index.html` there,
  because it would shadow Swagger UI at `/`.
- The file validates against Vercel's published schema (`https://openapi.vercel.sh/vercel.json`).

## Setup After Merge

1. **Check one dashboard setting before deploying.** Backend project → Settings → Build and
   Deployment → **Include source files outside of the Root Directory in the Build Step**
   must be enabled, because `installCommand` runs `cd ..`. If it is off, the build fails.
   A failed build is not promoted, so production keeps serving the previous deployment.
2. **Push to `main`** so Vercel deploys to production.
3. **Smoke-test production:**

   ```bash
   curl -i  https://short-url-super.vercel.app/api/health      # 200
   curl -i  https://short-url-super.vercel.app/api/health/db   # 200, Cache-Control: no-store
   curl -sI https://short-url-super.vercel.app/<existing-code> # HEAD → 302 with Location
   ```

4. **Confirm the jobs:** Backend project → Settings → **Cron Jobs** should list three entries
   for `/api/health/db`. A run can be triggered by hand from the deployment summary, or with
   the `vercel crons` CLI.
5. **If anything is wrong,** use Instant Rollback to the previous production deployment.

## Verification

```bash
# Unit tests (endpoint)
cd backend && npx jest src/app.controller.spec.ts

# Local endpoint (with backend/.env pointing at Supabase)
npm run dev
curl -i http://localhost:3000/api/health/db
```

### Reproducing the Vercel build locally

`vercel build` needs no login when the project settings are supplied by hand. Run it in a
throwaway clone so `.vercel/` and the root `node_modules` stay out of the working tree:

```bash
git clone . /tmp/short-url-build && cd /tmp/short-url-build
mkdir -p .vercel && cat > .vercel/project.json <<'JSON'
{"projectId":"prj_local","orgId":"team_local","settings":{"rootDirectory":"backend",
 "framework":null,"nodeVersion":"22.x","sourceFilesOutsideRootDirectory":true}}
JSON
npx vercel build --yes
```

A successful build writes `.vercel/output/` with `static/.gitkeep`, the
`functions/api/index.func` bundle, and the three crons in `config.json`. Files listed in
the function's `.vc-config.json` `filePathMap`, including the `node_modules/@repo/shared`
symlink, are only added at deploy time. To run the bundle outside the repo, copy those
files in first.

Vercel Cron does not run locally (`vercel dev` and framework dev servers are not
supported). Calling the endpoint directly is the local equivalent.

## Operations

- **Changing the schedule:** edit `crons` in `backend/vercel.json` and redeploy. Hobby rejects
  any expression that would run more than once a day.
- **Seeing results:** Settings → Cron Jobs → View Logs. Hobby keeps runtime logs for one hour
  only, so check soon after a run.
- **Failure alerts:** Vercel does not email on cron failures. The backstop is Supabase's
  warning email, sent about a week before a pause. If the project is already paused,
  restore it from the Supabase dashboard; cron calls do not unpause it.
- **Pausing the keep-alive:** Settings → Cron Jobs → Disable Cron Jobs. It stays disabled until
  it is re-enabled there.
