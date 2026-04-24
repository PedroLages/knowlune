---
title: "Migrate Knowlune from self-hosted Supabase + Unraid to Supabase Cloud + Cloudflare Pages"
type: refactor
status: active
date: 2026-04-24
---

# Migrate Knowlune from self-hosted Supabase + Unraid to Supabase Cloud + Cloudflare Pages

## Overview

Move Knowlune's entire backend and frontend off the Unraid server (`titan`) to fully managed hosting: Supabase Cloud (Free tier) for database/auth/storage/Edge Functions, and Cloudflare Pages for the React SPA. The Express API proxy that currently serves `/api/ai/*`, `/api/models`, `/api/calendar`, and `/api/cover-proxy` is ported to Supabase Edge Functions, eliminating Unraid entirely from the critical path. A dual-project Supabase MCP configuration (staging read-write + prod read-only) is set up so the Claude agent has safe, scoped access for future schema/migration work.

## Session Progress Log — 2026-04-24

**Status:** ~60% complete. Auth + schema + storage live on Cloud. Edge Functions + deploy still pending.

### What's DONE

- ✅ **Cloud project created**: `knowlune-prod` ref `chyvhrbtttpumsyuhgbu`, region `us-east-1`. (Staging project deferred.)
- ✅ **Schema migrated**: all 25 migrations applied via `supabase db push` (not `pg_dumpall` — see pivot below).
- ✅ **Storage buckets**: 6 buckets created + 18 RLS policies (3 per bucket, SELECT/INSERT/UPDATE) via Supabase MCP `apply_migration`. Policies match `supabase/storage-setup.sql`.
- ✅ **Google OAuth**: re-used existing `Knowlune Web` OAuth client (Client ID `1021420664724-ec510…`), added Cloud callback URI `https://chyvhrbtttpumsyuhgbu.supabase.co/auth/v1/callback`. Dashboard → Auth → Providers → Google enabled with creds; URL Configuration set (Site URL `https://knowlune.pedrolages.net`, redirect URLs `https://knowlune.pedrolages.net/**` + `http://localhost:5173/**`).
- ✅ **Local `.env` updated**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` swapped to Cloud values.
- ✅ **Supabase MCP installed**: project-scoped config in `.mcp.json`, OAuth-authenticated via hosted HTTP.
- ✅ **Signed-in smoke test PASSED**: `pedrocamposlages@gmail.com` → new UUID `0012ae1d-8c20-4e42-b770-c7a4a967dacd` in `auth.users`. App routed to `/courses`, user profile shown in UI, Dexie sync engine active.

### Critical fix applied

- ✅ **PKCE flow type** ([src/lib/auth/supabase.ts](src/lib/auth/supabase.ts)): Supabase JS SDK v2 defaulted to **implicit flow** on this client, which Cloud projects reject. Added explicit `flowType: 'pkce'`, `detectSessionInUrl: true`, `persistSession: true`, `autoRefreshToken: true` to `createClient`. Without this fix, the OAuth URL lacked `code_challenge` params and the callback never produced a session. This was a silent regression that would also have affected self-hosted once it upgraded SDK defaults.

### Key pivot from original plan

- **Skipped `pg_dumpall` restore.** Dump analysis (`migration/supabase_dumpall_20260424.sql`) showed only 2 rows in `auth.users` (Pedro + 1 deleted anon), 0 rows in all 46 public tables, empty vault, 4 old storage buckets with no objects. All real data lives in Dexie/IndexedDB client-side, not Postgres. Used `supabase db push` (schema only) + let Google OAuth create the user row fresh. `backfillUserId()` in `src/lib/sync/backfill.ts` stamps Dexie rows with the new UUID on first sync. No data loss because there was no Postgres data.
- **Manual `auth.users` insert skipped**: Supabase GoTrue internals (instance_id, aud, confirmation_token, etc.) are brittle to hand-craft. Fresh sign-in is cleaner and recommended by Supabase docs.

### Issues found during smoke test (not blocking auth)

1. **Sync engine schema mismatch** (`supabase-cloud-sync-updated-at` in [docs/known-issues.yaml](docs/known-issues.yaml)): 3 tables — `study_sessions`, `quiz_attempts`, `ai_usage_events` — have `created_at` but no `updated_at`. Sync engine at [src/lib/sync/syncEngine.ts:507](src/lib/sync/syncEngine.ts#L507) issues `?order=updated_at.asc` → 400 on every sync cycle. Pre-existing (same bug on self-hosted). Fix: either add `updated_at` columns via migration, or special-case these tables in the sync engine to order by `created_at`.
2. **`user_settings` 406 (Not Acceptable)**: 4× calls fail with 406 because code calls `.single()` but no row exists for new users. File: the caller should use `.maybeSingle()` or upsert a default row on first sign-in. Non-critical but noisy in console.
3. **Edge Functions CORS failures**: `/functions/v1/vault-credentials/check-credential`, `/functions/v1/vault-credentials/store-credential` → CORS preflight failed (functions don't exist on Cloud yet). Blocks AI provider key storage + ABS server credentials until Unit 5 (Edge Functions port) ships.

### What's LEFT

- 🔜 **Unit 5 — Edge Functions port** (now blocking): Deploy `vault-credentials`, `delete-account`, `cancel-account-deletion`, `export-data`, `export-worker`, `retention-tick`, `create-checkout`, `stripe-webhook`, plus the main `/api/*` dispatcher. Vercel AI SDK chain rewrite required for Deno.
- 🔜 **Unit 4 — Vault secrets**: re-insert OPDS passwords + ABS apiKeys (depends on Unit 5 vault-credentials function).
- 🔜 **Unit 8 — Cloudflare Pages deploy**: switch prod env vars, redeploy.
- 🔜 **Unit 9 — retention-tick Worker**: reconfigure cron to hit Cloud Edge Function.
- 🔜 **Unit 10 — cutover smoke**: verify on prod domain.
- 🔜 **Unit 11 — cleanup**: shut down Unraid services.
- 🔜 **Fix the 3 issues above** (2 pre-existing + 1 Edge Functions dependency).
- 🔜 **Rotate service_role key** — was pasted in chat during this session. Dashboard → Settings → API → Reset.

### Critical files modified this session

- [src/lib/auth/supabase.ts](src/lib/auth/supabase.ts) — PKCE flow config (THE fix)
- `.env` — Cloud URL + keys (gitignored)
- `.mcp.json` — Supabase project-scoped MCP server
- [docs/known-issues.yaml](docs/known-issues.yaml) — logged `supabase-cloud-sync-updated-at`
- `supabase/.temp/` — CLI state from `supabase link`

---

## Problem Frame

Today (2026-04-24), the self-hosted Supabase stack on `titan` (Unraid) is **actively crashed** — `supabase-db` went down 8 hours ago due to disk exhaustion on `/mnt/cache` (100% full). The Knowlune container is running but unhealthy because it depends on the crashed database. Cascading failures: `realtime` down 8h, `kong` unhealthy, `supavisor` unhealthy.

Beyond the immediate outage, the self-hosted topology creates structural problems:

- **Single point of failure**: Disk, network, DNS, and container health all depend on one Unraid box.
- **Operations burden**: Pedro has to maintain disk space, backup scripts (daily `pg_dumpall` at 04:40 UTC), container updates, TLS certs (Traefik/Cloudflare), and health monitoring — instead of shipping features.
- **Self-hosted hardening gap**: Kong+Supavisor+Realtime already unhealthy before the crash suggests configuration drift that's hard to debug without managed-platform tooling.
- **Personal app, small footprint**: DB is 2.7 MB, storage is ~2 MB, <100 users. Self-hosting is massive overkill.

The database outage makes this migration time-critical: Knowlune is effectively offline until either the Unraid disk is cleared or the migration completes.

## Requirements Trace

- **R1.** Knowlune returns online with zero data loss (auth users, all sync-engine tables, storage objects, vault secrets).
- **R2.** Password-based login continues to work using existing bcrypt hashes (no forced password reset beyond the one-time re-login from R6).
- **R3.** Guest-session backfill (E92-S04 `guestSessionId` → `userId`) still functions post-migration.
- **R4.** All E92 sync behaviors preserved: P0–P4 tiers, LWW/monotonic/insert-only/conflict-copy strategies, compound PK tables.
- **R5.** All 9 Edge Functions operate on Cloud (main dispatcher, retention-tick, export-data, export-worker, delete-account, cancel-account-deletion, create-checkout, stripe-webhook, vault-credentials).
- **R6.** Cutover migrates to JWT signing keys (ES256); users re-log in once; future rotations preserve sessions.
- **R7.** All six Express routes work on the new topology with full feature parity, including Ollama BYOK streaming.
- **R8.** OAuth (Google) continues to work with the new Cloud callback URL.
- **R9.** Claude agent has scoped MCP access: read-write on a staging project, read-only on production.
- **R10.** Unraid is fully removed from the runtime critical path. `titan` can be powered off without impacting `knowlune.pedrolages.net`.
- **R11.** Daily retention-tick cron continues to run (hard-deletes users past grace period, purges exports).

## Scope Boundaries

Non-goals:

- **Postgres version upgrade audit**: Cloud defaults to PG17; source is PG15.8. We accept the default PG17 target and spot-check extensions; we do NOT audit every SQL query for PG17 semantic differences.
- **Schema changes**: no new tables, RLS policies, or triggers as part of this migration. Pure lift-and-shift.
- **Feature changes**: the Edge Function port preserves current behavior exactly — no new AI providers, no new rate-limit tiers, no new calendar features.
- **Storage bucket restructuring**: path conventions (`{userId}/{recordId}/{filename}`) remain identical.
- **Unraid teardown**: we keep Unraid running read-only for 14 days post-cutover as a rollback target. Actual decommissioning is a separate follow-up.

### Deferred to Separate Tasks

- **Ollama-specific hardening**: Ollama BYOK works through an Edge Function passthrough in this plan, but reviewing timeout/streaming behavior across Supabase's CDN is a follow-up.
- **Supabase staging project feature parity**: staging gets schema migrations only; seeded fixture data is a follow-up.
- **Branching for preview deploys**: Cloudflare Pages preview branches pointing at Supabase branches — deferred, Free tier does not include branching anyway.
- **`/api/abs/proxy/*` and `/api/audible/proxy` routes**: The Express server also has ABS proxy and Audible proxy routes not covered in the 6-endpoint count. These routes have no plan in Unit 5; they remain on Unraid (or break) until a separate follow-up. **Implication:** ABS book cover fetching and Audible API calls will stop working post-cutover. Low severity (non-critical feature, personal use).
- **Zhipu GLM provider**: `zhipu-ai-provider` npm package may not have a Deno equivalent. If raw-fetch fallback is needed for GLM, that's implementation-time discovery in Unit 5.

## Context & Research

### Live Unraid State (from `ssh titan` inspection, 2026-04-24)

- `supabase-db` (postgres:15.8.1.085) **CRASHED 04:23 UTC** — `/mnt/cache` full.
- Last good backup: `/mnt/cache/appdata/supabase/db/dumps/supabase_dumpall_20260424_044001.sql` (2.7 MB).
- Storage backend: filesystem at `/mnt/cache/appdata/supabase/storage/` (~2 MB).
- Docker compose: `/mnt/user/docker/stacks/supabase/docker-compose.yml`.
- Edge functions on disk: `/mnt/cache/appdata/supabase/functions/` (9 functions, matches repo).
- Knowlune container: `ghcr.io/pedrolages/knowlune:main` on titan, UNHEALTHY (DB dep).
- Traefik v3.6.13 + cloudflared — terminates TLS, tunnels to public internet.

**Disk recovery is a blocker for Migration Unit 1** (need the DB running to take a fresh dump). Recovery = clear `/mnt/cache/data` space (`audiobook-m4b` = 8.6 GB, top candidate) OR start from the 04:40 pre-crash dump.

### Supabase Integration Surface (from codebase exploration)

**Client:** `src/lib/auth/supabase.ts` — reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Returns null when unset (app gracefully degrades to local-only guest mode).

**Migrations:** `supabase/migrations/` — 25 files: two legacy-sequential (`001_*`, `002_*`) plus 23 timestamp-versioned (`20260413NNNNNN` through `20260501NNNNNN`). Run in lexical order.

**Storage schema:** `supabase/storage-setup.sql` — 6 buckets (`course-thumbnails`, `screenshots`, `avatars`, `pdfs`, `book-files`, `book-covers`) + owner-only RLS policies via `(storage.foldername(name))[1] = auth.uid()::text`.

**Tables (39 synced, from `src/lib/sync/tableRegistry.ts`):** P0 `content_progress`, `study_sessions`, `video_progress` → P4 `quiz_attempts`, `ai_usage_events`. Plus non-synced: `flashcard_reviews` (insert-only event log), `subscriptions` (entitlement lookup).

**RPC functions (3):** `compute_reading_streak(user_id)`, `merge_user_settings(user_id, settings_json)`, `reset_vocabulary_mastery(user_id)`. All defined in migrations.

**Auth flows (`src/stores/useAuthStore.ts`):** email/password, magic link OTP, Google OAuth, `onAuthStateChange` session callback. Guest→signed-in backfill at `src/lib/sync/backfill.ts`.

**Edge Functions (`supabase/functions/`):** `main` (router), `retention-tick`, `export-data`, `export-worker`, `delete-account`, `cancel-account-deletion`, `create-checkout`, `stripe-webhook`, `vault-credentials`. `_shared/` has `hardDeleteUser.ts`, `emailTemplates.ts`, `sendEmail.ts`, `retentionPolicy.ts`.

**Express server (`server/`):** `index.ts` wires middleware chain (origin-check → JWT auth → BYOK detection → entitlement → rate limiter) for `/api/ai/*`, `/api/models`, `/api/calendar`, `/api/cover-proxy`. Also includes `/api/abs/proxy/*` (ABS cover passthrough), `/api/audible/proxy` (hardcoded Audible), and `/api/abs/ping`. LRU cache (5 min TTL) for entitlement lookups. Streaming SSE via Vercel AI SDK (`ai` package v6 + `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/openai`; no LangChain). Providers at `server/providers.ts`: Anthropic, Google, Groq, OpenAI, Zhipu GLM, Ollama (OpenAI-compat). **SPA API calls use hardcoded relative `/api/*` paths** (not `VITE_API_BASE_URL`), except `useStudyScheduleStore.ts` which uses `VITE_API_BASE_URL` for the calendar feed URL. All call sites must be updated in Unit 5 to use the new Edge Function URL base.

### Institutional Learnings

- `project_abs_cors_proxy.md`: ABS API calls need Express backend proxy because Cloudflare strips CORS headers. This stays relevant — `/api/cover-proxy` covers this, ports to an Edge Function unchanged.
- `reference_sync_engine_api.md`: `syncableWrite` is the single entry point for synced writes; don't bypass it.
- `project_actual_deployment_topology.md`: Knowlune currently bundled on Unraid (not the Pages+Express split). This migration **implements** the Pages split from the earlier beta launch plan (`docs/plans/2026-04-18-011-feat-knowlune-online-beta-launch-plan.md`).
- `feedback_pr_merge_strategy.md`: force-merge PRs immediately, no CI wait.

### External References

- [Supabase: Migrating Auth Users Between Projects](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects) — `auth.users` + `auth.identities` bcrypt hashes transfer portably.
- [Supabase: Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) — `supabase db dump` with `--role-only`, `--data-only --use-copy`.
- [Supabase: Copy Storage Objects from Platform (S3)](https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3) — rclone over S3 protocol; filesystem copy does NOT work.
- [Supabase: JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys) — migrate to ES256 post-cutover for rotation-safe sessions.
- [Supabase: MCP Server](https://supabase.com/docs/guides/getting-started/mcp) — `@supabase/mcp-server-supabase` via hosted HTTP OAuth transport.
- [GitHub Issue #34964](https://github.com/supabase/supabase/issues/34964) — must exclude `pgsodium.key`, `vault.secrets`, `pgsodium.key_key_id_seq` from data.sql.
- [Cloudflare Pages SPA deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/) — build command + `_redirects` for SPA fallback.

## Key Technical Decisions

- **Supabase Cloud Free tier.** 500 MB DB / 1 GB storage fits our 2.7 MB + 2 MB footprint trivially. Auto-pause after 7 days inactivity is acceptable for a personal app. Upgrade to Pro ($25/mo) deferred until usage justifies it.
- **Full DB dump + restore (not JSON auth-only export).** At 2.7 MB, one-shot `supabase db dump` is both simpler and preserves FK integrity with `session_replication_role = replica`. Manually strip three COPY blocks (`pgsodium.key`, `vault.secrets`, `pgsodium.key_key_id_seq`).
- **Vault re-insert via `vault.decrypted_secrets` export.** Ciphertext is not portable across pgsodium master keys; pre-cutover we SELECT plaintext and re-insert on Cloud via `vault.create_secret()`.
- **JWT migration to signing keys (ES256).** One forced re-login post-cutover is acceptable for <100 users; long-term posture is strictly better. Preserves Knowlune's current SDK-based session validation (no custom `jose` verification to refactor).
- **Port Express to Supabase Edge Functions with Ollama passthrough.** Full feature parity including BYOK. Ollama endpoints proxy to the user-provided Ollama URL from the request body (unchanged behavior). Entitlement LRU cache becomes per-request (no shared memory across Edge Function invocations) — acceptable because the underlying Supabase query is indexed.
- **Cloudflare Pages for frontend.** GitHub integration auto-deploys on `main` push. `_redirects` handles SPA routing. `wrangler.toml` already present for the retention-tick worker — Pages config is additive.
- **Dual Supabase project MCP setup.** `knowlune-prod` (read-only, hosted HTTP OAuth) + `knowlune-staging` (read-write, hosted HTTP OAuth). Both committed in `.mcp.json`. Agent can do schema/migration work on staging safely; prod is inspect-only. Best of both worlds vs. a single-project config.
- **Keep Unraid warm for 14 days.** `titan` Docker stack stays up with self-hosted Supabase running read-only (restored after disk recovery). DNS `supabase.pedrolages.net` still resolves. Rollback = flip env vars, redeploy.
- **Cloudflare Worker (retention-tick cron) reconfigured, not replaced.** `wrangler.toml` already exists; swap `SUPABASE_FUNCTIONS_URL` secret to the new project URL.

## Open Questions

### Resolved During Planning

- **Express fate**: port all six endpoints to Edge Functions, including Ollama passthrough → eliminates Unraid from critical path.
- **Session preservation**: fresh secret + immediate migration to ES256 signing keys → one re-login, better long-term posture.
- **App host**: Cloudflare Pages → free, fast, GitHub-integrated, aligns with pre-existing beta launch plan.
- **Cloud tier**: Free tier to start; upgrade triggered by auto-pause becoming painful or MAU > 50k.
- **Edge parity**: full parity including Ollama BYOK passthrough.
- **MCP scope**: dual-project, hosted HTTP OAuth, staging RW + prod RO.

### Deferred to Implementation

- **Edge Function cold-start impact on AI streaming UX**: Supabase Edge Functions have ~200-400ms cold-start on the first invocation. We'll measure post-deploy and either (a) accept, (b) enable function warming, or (c) ship a progress indicator. Decision made in Unit 5 post-deploy.
- **Daily backup strategy on Free tier**: Free includes daily backups with 7-day retention but no PITR. If this proves insufficient, consider a GitHub Actions cron that runs `supabase db dump` to a private Cloudflare R2 bucket. Not blocking for cutover.
- **`server/providers.ts` → Deno rewrite details**: `server/providers.ts` uses the Vercel AI SDK (`ai` package + `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/openai`, `zhipu-ai-provider`). These are npm packages; Deno compatibility audit happens in Unit 5. Likely path: port to raw `fetch` calls to provider REST APIs (all support it natively) rather than importing npm provider packages into Deno, avoiding any npm-in-Deno shim complexity.

## High-Level Technical Design

> *This illustrates the intended topology and is directional guidance for review, not implementation specification.*

```
BEFORE (current):
┌──────────────────────────────────────────────────────────────┐
│ Cloudflare DNS + Tunnel                                      │
│   knowlune.pedrolages.net       supabase.pedrolages.net      │
└─────────┬──────────────────────────────┬─────────────────────┘
          ↓                              ↓
┌──────────────────────────────── titan (Unraid) ──────────────┐
│  Traefik                                                     │
│    ↓                              ↓                          │
│  Knowlune Docker (Nginx+Express)    Kong → Supabase stack    │
│    - SPA served from dist/            - postgres 15.8        │
│    - Express /api/* on :3000          - gotrue, storage,     │
│                                         realtime, edge-fn    │
│                                       - vault, pgsodium       │
└──────────────────────────────────────────────────────────────┘

AFTER (this plan):
┌──────────────────────────────────────────────────────────────┐
│ Cloudflare DNS                                               │
│   knowlune.pedrolages.net → Pages    *.supabase.co → Cloud   │
└─────────┬──────────────────────────────┬─────────────────────┘
          ↓                              ↓
┌──────────────────────┐    ┌─────────────────────────────────┐
│ Cloudflare Pages     │    │ Supabase Cloud (Free tier)       │
│  - Knowlune SPA      │───→│  - Postgres 17                  │
│  - auto-deploy from  │    │  - Auth (ES256 signing keys)    │
│    main branch       │    │  - Storage (S3-backed)          │
└──────────────────────┘    │  - Edge Functions:              │
                            │      main, retention-tick,      │
                            │      export-data, export-worker,│
                            │      delete-account, cancel-*,  │
                            │      create-checkout,           │
                            │      stripe-webhook,            │
                            │      vault-credentials,         │
                            │      ai-proxy (NEW),            │
                            │      ai-stream (NEW),           │
                            │      models (NEW),              │
                            │      calendar (NEW),            │
                            │      cover-proxy (NEW)          │
                            └─────────────────────────────────┘
          │
          └──→ Cloudflare Worker (retention-tick cron)
               - unchanged; SUPABASE_FUNCTIONS_URL updated

titan: KEPT WARM for 14 days post-cutover as rollback.
       After 14 days: SUPABASE stack can be stopped.
                      audiobookshelf / other services continue.
```

**Client-side changes are minimal.** The SDK entry point `src/lib/auth/supabase.ts` reads two env vars; those swap to Cloud values at build time. Six Express endpoints → six Edge Function paths; `VITE_API_BASE_URL` swaps from `https://knowlune.pedrolages.net/api` to `https://<project>.supabase.co/functions/v1`. No code refactor in the SPA beyond env + one base-URL string.

## Implementation Units

Dependency order:

```
Unit 1 (Prep)
   ↓
Unit 2 (DB migrate) ←── Unit 3 (Storage migrate) ←── Unit 4 (Vault migrate)
   ↓                                                        ↓
Unit 5 (Edge Functions port) ←──────────────────────────────┘
   ↓
Unit 6 (Auth reconfig) ←── Unit 7 (MCP setup — parallel, independent)
   ↓
Unit 8 (SPA env + Cloudflare Pages deploy)
   ↓
Unit 9 (Retention-tick worker reconfig)
   ↓
Unit 10 (Cutover + smoke test)
   ↓
Unit 11 (Post-cutover cleanup + 14-day rollback window)
```

---

- [ ] **Unit 1: Recover Unraid disk and create Supabase Cloud projects**

**Goal:** Unblock the migration by restoring `supabase-db` long enough to take a fresh dump, and provision both Supabase Cloud projects (prod + staging).

**Requirements:** R1, R9

**Dependencies:** None (entry point)

**Files:** *(operational — no repo files changed)*
- Create: `.env.migration` (gitignored — holds both project URLs, service role keys, JWT secrets, PATs)

**Approach:**
- On titan: identify largest consumers in `/mnt/cache/data` and `/mnt/cache/appdata`; move `audiobook-m4b` (8.6 GB) to `/mnt/user/media/` or external. Target: `/mnt/cache` < 90% full.
- Restart the `supabase-db` container; verify Postgres comes up (`SELECT 1` via `psql`).
- On Supabase Cloud Dashboard: create two projects in the same region (choose one close to Pedro — likely `eu-west-2` or `us-east-1`):
  - `knowlune-prod` — production.
  - `knowlune-staging` — for MCP write access + future preview work.
- Collect from Dashboard for each project: Project Ref, Project URL, anon key, service_role key, JWT secret, region.
- Install Supabase CLI locally if not present: `brew install supabase/tap/supabase`.
- Login: `supabase login`.

**Patterns to follow:**
- `docs/deployment/retention-cron-setup.md` for secret-management style.

**Test scenarios:**
- Happy path: `ssh titan 'docker exec supabase-db psql -U postgres -c "SELECT 1"'` returns 1.
- Happy path: `supabase projects list` shows both new projects.
- Edge case: if disk recovery fails, fall back to restoring the 04:40 UTC dump locally (`pg_restore` into a Docker Postgres) to take subsequent dumps from there.

**Verification:**
- `docker ps` on titan shows `supabase-db`, `supabase-auth`, `supabase-storage`, `supabase-kong` all healthy.
- Both Cloud projects visible in Dashboard with "Healthy" badge.

---

- [x] **Unit 2: Export self-hosted DB and restore to Cloud (prod)** — ✅ 2026-04-24. Pivoted: used `supabase db push` (schema only) instead of `pg_dumpall` restore, because dump analysis showed 0 rows in all 46 public tables. All 25 migrations applied cleanly.

**Goal:** Move all database state (auth users with hashes, public schema tables, sync data) into `knowlune-prod`.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1

**Files:** *(operational — dumps are local artifacts)*
- Create (local, gitignored): `migration/roles.sql`, `migration/schema.sql`, `migration/data.sql`, `migration/history.sql`

**Approach:**
1. Put self-hosted into read-only mode: announce maintenance; stop the Knowlune container (`docker stop knowlune`) so new writes don't hit the DB.
2. Take fresh dumps via Supabase CLI against self-hosted pooler URL (`postgresql://postgres.<ref>:<password>@db.supabase.pedrolages.net:6543/postgres` or the equivalent direct connection):
   - `supabase db dump --db-url "$SELF_HOSTED_DB_URL" -f migration/roles.sql --role-only`
   - `supabase db dump --db-url "$SELF_HOSTED_DB_URL" -f migration/schema.sql`
   - `supabase db dump --db-url "$SELF_HOSTED_DB_URL" -f migration/data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"`
   - `supabase db dump --db-url "$SELF_HOSTED_DB_URL" -f migration/history.sql --use-copy --data-only --schema supabase_migrations`
3. Open `migration/data.sql` in an editor; remove three blocks:
   - `COPY "pgsodium"."key"` and its data
   - `COPY "vault"."secrets"` and its data
   - `SELECT pg_catalog.setval('pgsodium.key_key_id_seq'...)`
4. Restore to Cloud prod (pooler connection string from Dashboard → Settings → Database):
   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file migration/roles.sql \
     --file migration/schema.sql \
     --command 'SET session_replication_role = replica' \
     --file migration/data.sql \
     --dbname "$CLOUD_PROD_DB_URL"
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file migration/history.sql \
     --dbname "$CLOUD_PROD_DB_URL"
   ```
5. Apply `supabase/storage-setup.sql` via Dashboard SQL Editor (creates buckets + RLS policies).
6. Row-count parity check: for each table in `src/lib/sync/tableRegistry.ts`, verify source and Cloud row counts match. Script this with a simple SQL loop.

**Patterns to follow:**
- [Supabase: Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) exact command shape.

**Test scenarios:**
- Happy path: `SELECT count(*) FROM auth.users` on Cloud matches self-hosted.
- Happy path: password verification — pick a test user, attempt sign-in against Cloud via a local Supabase client pointed at prod Cloud URL; sign-in succeeds.
- Happy path: `SELECT count(*) FROM public.content_progress` matches across both DBs; same for all 39 sync tables.
- Happy path: RLS policies present — `SELECT count(*) FROM pg_policies WHERE schemaname = 'public'` matches.
- Edge case: `session_replication_role = replica` correctly disables triggers during restore (auth passwords not re-encrypted).
- Error path: if any FK violation occurs, roll back transaction, inspect, repair, rerun. Do not accept partial state.
- Integration: `supabase_migrations.schema_migrations` history preserved so future `supabase db push` is a no-op.

**Verification:**
- Row counts match across all `tableRegistry` tables.
- `SELECT count(*) FROM auth.users` + `SELECT count(*) FROM auth.identities` match.
- Sign-in succeeds for at least one test user using their original password.
- `supabase db push --dry-run` against Cloud reports "no pending migrations".

---

- [x] **Unit 3: Migrate storage buckets (self-hosted filesystem → Cloud S3)** — ✅ 2026-04-24. 6 buckets created via SQL Editor, 18 RLS policies applied via Supabase MCP `apply_migration` (bypassed `42501 must be owner` by running as `postgres` role). Old buckets on self-hosted had 0 objects, so no file migration needed.

**Goal:** Copy all objects across six buckets to Cloud Storage.

**Requirements:** R1

**Dependencies:** Unit 2 (buckets must exist on Cloud; created by `storage-setup.sql` in Unit 2)

**Files:** *(operational)*
- Create (local, gitignored): `~/.config/rclone/rclone.conf` entries for `self-hosted` and `cloud-prod`.

**Approach:**
1. Self-hosted: verify `REGION`, `S3_PROTOCOL_ACCESS_KEY_ID`, `S3_PROTOCOL_ACCESS_KEY_SECRET` are set in the docker-compose `.env`. If missing, add and restart the `supabase-storage` container.
2. Cloud prod: Dashboard → Storage → S3 Connection → generate access key pair.
3. Configure rclone with two remotes (self-hosted S3 endpoint + cloud S3 endpoint).
4. For each of the 6 buckets, `rclone copy self-hosted:<bucket> cloud-prod:<bucket> --progress --transfers 4 --checkers 8`.
5. Spot-check: for 3 random objects per bucket, verify size matches between source and destination.
6. Confirm storage RLS policies are in place (applied via `storage-setup.sql` in Unit 2).

**Patterns to follow:**
- [Supabase: Copy Storage Objects from Platform (S3)](https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3) — rclone config + command shape.

**Test scenarios:**
- Happy path: `rclone ls cloud-prod:book-covers | wc -l` matches `rclone ls self-hosted:book-covers | wc -l` for all 6 buckets.
- Happy path: random-sample 3 objects per bucket; `rclone size` matches.
- Integration: in the SPA (Unit 8), load a book cover for a user; cover renders via Cloud signed URL.
- Edge case: large objects (book-files up to 200 MB) transfer fully — verify checksums not just existence.
- Error path: if an object is corrupt on source, skip with `--ignore-errors` and log; manually re-upload from the local file if needed.

**Verification:**
- Object counts match per bucket.
- Spot-checked file sizes match.
- No "file not found" errors from Cloud Storage when accessed via signed URLs in smoke test (Unit 10).

---

- [ ] **Unit 4: Re-insert Vault secrets (OPDS passwords, ABS apiKeys)**

**Goal:** Preserve vault-stored credentials without restoring un-decryptable ciphertext.

**Requirements:** R1

**Dependencies:** Unit 1 (self-hosted must be running); Unit 2 (Cloud vault schema exists post-schema-restore).

**Files:** *(operational, local artifacts only)*
- Create (local, encrypted with `age` or `gpg`): `migration/vault-plaintext.enc`

**Approach:**
1. On self-hosted, before stopping, SELECT from the decrypted view:
   ```sql
   SELECT id, name, decrypted_secret AS plaintext, description
   FROM vault.decrypted_secrets
   ORDER BY name;
   ```
   Save rows to a local file (JSON). Encrypt immediately with `age` or `gpg` — plaintext stays encrypted at rest on Pedro's laptop.
2. On Cloud prod, for each row re-insert:
   ```sql
   SELECT vault.create_secret(
     new_secret   => '<plaintext>',
     new_name     => '<name>',
     new_description => '<description>'
   );
   ```
3. Audit the `vault-credentials` Edge Function code: confirm it looks up secrets by `name` (not by `id`). If it uses `id`, Unit 5 must map old→new IDs. Grep `supabase/functions/vault-credentials/` for `.id` vs `.name` access.
4. Verify SPA flows that read vault secrets: OPDS password flow (`opds_catalogs` table) and ABS apiKey flow (`audiobookshelf_servers` table).

**Patterns to follow:**
- [Supabase Vault docs](https://supabase.com/docs/guides/database/vault) — `vault.create_secret()` signature.

**Test scenarios:**
- Happy path: count of rows in `vault.decrypted_secrets` matches across source and Cloud.
- Happy path: `vault-credentials` Edge Function can fetch a secret on Cloud and return plaintext (test from Dashboard's function invoker).
- Happy path: in Unit 10 smoke test, a user with an OPDS server configured successfully authenticates.
- Integration: ABS apiKey retrieval during sync works (test via ABS book list call in Unit 10).
- Edge case: if a secret name contains special chars, quote properly.
- Error path: if `vault.create_secret` fails with duplicate-name, check for existing row and update via `vault.update_secret` instead.

**Verification:**
- Row count parity between source `vault.decrypted_secrets` and Cloud `vault.decrypted_secrets`.
- Encrypted plaintext file on laptop is destroyed post-cutover (shred; don't leave on disk).

---

- [ ] **Unit 5: Port Express endpoints to Supabase Edge Functions**

**Goal:** Full feature parity on six endpoints: `/api/ai/generate`, `/api/ai/stream`, `/api/ai/ollama/*`, `/api/models`, `/api/calendar`, `/api/cover-proxy`. Preserve streaming, JWT auth, entitlement, rate limiting, and Ollama BYOK.

**Requirements:** R5, R7

**Dependencies:** Unit 2 (Cloud DB with `subscriptions` + `entitlements` tables)

**Files:**
- Create: `supabase/functions/ai-generate/index.ts` — non-streaming LLM proxy
- Create: `supabase/functions/ai-stream/index.ts` — SSE streaming LLM proxy
- Create: `supabase/functions/ai-ollama/index.ts` — Ollama passthrough (tags, health, chat)
- Create: `supabase/functions/models/index.ts` — available models list
- Create: `supabase/functions/calendar/index.ts` — iCal feed via calendar token
- Create: `supabase/functions/cover-proxy/index.ts` — book cover proxy (CORS unwrap)
- Create: `supabase/functions/_shared/entitlement.ts` — tier resolution (port of `server/middleware/entitlement.ts`)
- Create: `supabase/functions/_shared/rate-limit.ts` — per-tier rate limiting
- Create: `supabase/functions/_shared/origin-check.ts` — ALLOWED_ORIGINS (read from Edge Function secret)
- Fix: `supabase/functions/_shared/hardDeleteUser.ts` — update stale `STORAGE_BUCKETS` constant (currently `['avatars', 'course-media', 'audio', 'exports']`) to match the actual 6 buckets in `supabase/storage-setup.sql` (`['course-thumbnails', 'screenshots', 'avatars', 'pdfs', 'book-files', 'book-covers']`)
- Create: `supabase/functions/_shared/providers.ts` — Deno-compatible provider calls (Anthropic, Google, Groq, OpenAI, Ollama via raw `fetch`)
- Modify: `src/ai/llm/proxy-client.ts` — update `/api/ai/stream` hardcoded path to `${VITE_SUPABASE_URL}/functions/v1/ai-stream`
- Modify: `src/ai/llm/ollama-client.ts` — update `/api/ai/ollama` and `/api/ai/ollama/tags` paths
- Modify: `src/ai/learningPath/*.ts` (3 files: suggestPlacement, generatePath, suggestOrder) — update `/api/ai/generate` path
- Modify: `src/ai/quizGenerationService.ts` — update `/api/ai/ollama/chat` path
- Modify: `src/app/components/library/BookMetadataEditor.tsx` — update `/api/cover-proxy` path
- Modify: `src/stores/useStudyScheduleStore.ts` — update `VITE_API_BASE_URL` usage for calendar feed URL (keep env var but document it now points at Edge Functions base)
- Test: `supabase/functions/ai-generate/index.test.ts` (Deno-native tests)
- Test: `supabase/functions/ai-stream/index.test.ts`
- Test: `supabase/functions/_shared/entitlement.test.ts`
- Test: `tests/e2e/ai-proxy.spec.ts` — existing E2E test updated to point at Cloud Functions URL

**Approach:**
- Each Edge Function = one Deno module exporting `Deno.serve(handler)`.
- Auth: use `@supabase/supabase-js` Deno import; verify JWT via `supabase.auth.getUser(token)`.
- Entitlement: query `public.subscriptions` via Supabase service client (service_role key available as `SUPABASE_SERVICE_ROLE_KEY` Edge secret); cache decision in-memory for the life of the request (no cross-invocation cache — acceptable tradeoff).
- Rate limiting: use Supabase DB table `rate_limit_buckets` with `user_id` + per-minute window, incremented via `UPDATE ... RETURNING`. Free: 5/min, Premium: 15/min, BYOK: 15/min. (Alternative: Upstash Redis via fetch — defer to follow-up if DB approach proves slow.)
- Streaming: return `new Response(readableStream, { headers: { 'Content-Type': 'text/event-stream' } })`. Provider fetch → ReadableStream → client. Anthropic/Groq/OpenAI/Google all support native SSE.
- Ollama passthrough: read `ollamaServerUrl` from request body; proxy to user's Ollama. No entitlement check (BYOK).
- Calendar: existing logic in `server/routes/calendar.ts` ports near-directly; token-based auth (no JWT).
- Cover proxy: simple `fetch(url)` + CORS headers; preserve caching semantics.
- Secrets via `supabase secrets set --env-file ./supabase/.env.production`:
  - `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY` (platform keys for free-tier users)
  - `ALLOWED_ORIGINS`
  - `SUPABASE_SERVICE_ROLE_KEY` (auto-provided by Supabase)

**Patterns to follow:**
- `supabase/functions/main/index.ts` — existing router with JWT verification + `WORKER_ENV_ALLOWLIST` pattern.
- `supabase/functions/_shared/hardDeleteUser.ts` — pattern for shared modules.
- `server/providers.ts` — the Node version; rewrite provider-by-provider in Deno.

**Execution note:** Test-first for the entitlement and rate-limit shared modules — these are pure logic, easy to Deno-test, and high-risk if broken (silent AI lockout or bill shock).

**Test scenarios:**
- Happy path: authenticated user with `tier=free` can call `/functions/v1/ai-generate` with a short Anthropic prompt and get back a response.
- Happy path: streaming endpoint emits SSE chunks with `data: ...\n\n` format; client receives incremental tokens.
- Happy path: `/functions/v1/ai-ollama/tags` with `ollamaServerUrl` in body returns the user's local Ollama models list.
- Happy path: `/functions/v1/calendar?token=<ical_token>` returns valid `text/calendar` response.
- Happy path: `/functions/v1/cover-proxy?url=<google-books-cover-url>` returns image bytes with permissive CORS.
- Edge case: free-tier user exceeds 5 req/min → 429 response with `Retry-After` header.
- Edge case: premium user, 15 req/min, no 429s.
- Edge case: BYOK request (apiKey present in body) skips entitlement check entirely.
- Error path: missing JWT → 401.
- Error path: expired JWT → 401 with clear message.
- Error path: provider API error → bubble up with original status + body.
- Error path: Ollama server unreachable → 502 with "Ollama connection failed" body.
- Integration: SPA loads, user sends a chat message, stream arrives in real-time; verify via Playwright in Unit 10.
- Integration: delete-account flow hard-deletes storage objects from all 6 buckets (not just the 4 previously listed in `hardDeleteUser.ts`).

**Verification:**
- All 6 endpoints respond correctly to curl tests using a valid Cloud JWT.
- Streaming endpoint chunks arrive without buffering (verified via `curl -N`).
- Rate limit returns 429 after threshold.
- Deno tests pass: `supabase functions serve --no-verify-jwt=false` + `deno test`.
- `supabase functions deploy` succeeds for all 14 functions (9 existing + 5 new: ai-generate, ai-stream, ai-ollama, models, calendar, cover-proxy; `ai-ollama` consolidates the three Ollama routes).

---

- [x] **Unit 6: Auth reconfiguration (JWT signing keys, OAuth redirect URIs)** — ✅ 2026-04-24 (partial). Google OAuth re-configured (reused existing `Knowlune Web` client, added Cloud callback URI). Site URL + Redirect URLs set. **Added critical PKCE fix** to `src/lib/auth/supabase.ts` — SDK defaulted to implicit flow which Cloud rejects. JWT key rotation (ES256) deferred since Cloud projects ship with new key format by default.

**Goal:** Migrate to ES256 signing keys and repoint Google OAuth to the Cloud callback URL.

**Requirements:** R6, R8

**Dependencies:** Unit 2 (Cloud auth schema exists)

**Files:** *(operational — Cloud Dashboard config)*
- Modify: Google Cloud Console → OAuth credentials (add new callback URI)
- Modify: Supabase Cloud Dashboard → Authentication → Providers → Google (paste existing client ID/secret)
- Modify: Supabase Cloud Dashboard → Authentication → URL Configuration (set Site URL + Redirect URLs)
- Modify: Supabase Cloud Dashboard → Authentication → JWT Signing Keys → Migrate legacy JWT secret, then generate ES256 keypair
- Modify: `src/lib/auth/supabase.ts` — verify `supabase.auth.getClaims()` is used (not manual JWT verification). *Audit step only; no code change expected.*

**Approach:**
1. Google Console: add `https://<project-ref>.supabase.co/auth/v1/callback` to Authorized redirect URIs. Keep the old one during cutover.
2. Cloud Dashboard → Auth Providers → Google: paste `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`.
3. Cloud Dashboard → Auth → URL Configuration:
   - Site URL: `https://knowlune.pedrolages.net` (and later `https://<cfp-deploy>.pages.dev` + custom domain)
   - Additional Redirect URLs: `https://knowlune.pedrolages.net/auth/callback`, `http://localhost:5173/auth/callback`
4. Cloud Dashboard → Auth → JWT Signing Keys:
   - Ship with fresh secret (invalidates old tokens) — accept one-time re-login cost.
   - Enable "Migrate JWT secret" — promotes current shared secret to a signing key.
   - Generate new ES256 keypair — mark as current; downgrade shared secret to standby.
5. Audit client code: grep for `jsonwebtoken`, `jose`, `jwt.verify` — ensure SPA only uses SDK's `supabase.auth.getUser()` / `getClaims()`. No manual verification found in previous exploration ✓.
6. Audit Edge Functions: `supabase/functions/_shared/hardDeleteUser.ts` and middleware use `supabase.auth.getUser(token)` — compatible with signing keys. ✓

**Patterns to follow:**
- [Supabase: JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase: Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)

**Test scenarios:**
- Happy path: in a private browser, visit the new Cloud-backed app; sign in with Google; land on Overview page with user profile populated.
- Happy path: sign in with email/password using a test user migrated in Unit 2; success.
- Happy path: request magic link; email arrives via Cloud's default SMTP (or via custom SMTP if configured); click → signed in.
- Edge case: existing session from before migration invalidated; user sees sign-in prompt rather than a silent error.
- Error path: OAuth with old (self-hosted) callback URI fails gracefully with clear message; user retries with the correct env.
- Integration: guest → signed-in backfill still runs; verify `hasUnlinkedRecords()` returns 0 post-link; records get `userId` stamped.

**Verification:**
- Google OAuth completes, lands user back on the app.
- Email/password login succeeds for a test user (proves bcrypt hashes transferred).
- `auth.jwt_signing_keys` table shows an active ES256 keypair and the legacy HS256 shared secret demoted to standby.

---

- [x] **Unit 7: Set up Supabase MCP (dual-project, hosted HTTP OAuth)** — ✅ 2026-04-24 (prod only). Prod project-scoped MCP added via `claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=chyvhrbtttpumsyuhgbu"`. OAuth-authenticated. Tools used this session: `execute_sql`, `apply_migration`. **Staging project + read-only prod scope deferred.**

**Goal:** Configure Claude Code's Supabase MCP so the agent has read-write access on the staging project and read-only access on prod. No PATs to manage.

**Requirements:** R9

**Dependencies:** Unit 1 (both projects exist)

**Files:**
- Create: `.mcp.json` (repo root, committed) — staging RW + prod RO configs
- Modify: `.gitignore` — verify it already ignores `.mcp.local.json` patterns (defensive)
- Create: `docs/engineering/supabase-mcp-setup.md` — short runbook for Pedro on how to OAuth in/out, revoke access, and swap read-only toggles

**Approach:**
- `.mcp.json` contains **two** MCP server entries, both HTTP transport:
  ```json
  {
    "mcpServers": {
      "supabase-staging": {
        "type": "http",
        "url": "https://mcp.supabase.com/mcp?project_ref=<staging-ref>&read_only=false&features=database,docs,debugging,functions,development"
      },
      "supabase-prod": {
        "type": "http",
        "url": "https://mcp.supabase.com/mcp?project_ref=<prod-ref>&read_only=true&features=database,docs,debugging"
      }
    }
  }
  ```
- First-time use: Claude Code will open a browser window per server; Pedro OAuths into Supabase. Sessions auto-refresh; revoke via Supabase Dashboard → Account → Sessions.
- Runbook covers: (a) how to OAuth, (b) how to revoke (kill session from Dashboard), (c) how to temporarily switch staging to read-only during sensitive work, (d) what happens when both prod and staging are invoked in one prompt (agent explicitly names the server).

**Patterns to follow:**
- [Supabase MCP docs](https://supabase.com/docs/guides/getting-started/mcp) for URL parameters.
- Existing `.mcp.json` patterns in adjacent repos if present; otherwise fresh.

**Test scenarios:**
- Happy path: in a fresh Claude Code session, invoke an MCP tool from `supabase-staging`; browser OAuth prompt appears; after approval, tool returns expected result.
- Happy path: invoke `supabase-prod` `execute_sql` with a SELECT — succeeds. With an UPDATE — fails with read-only error.
- Edge case: two projects configured in same session — both OAuth independently.
- Edge case: session refresh after prolonged inactivity — re-prompt for auth, no stuck state.
- Integration: agent writes a migration to staging, tests it, then Pedro promotes to prod via `supabase db push` from CLI (agent cannot directly write to prod).
- Error path: if Pedro revokes the OAuth session, next MCP call returns a clear error; agent does not hang.

**Verification:**
- `/mcp` command in Claude Code lists both servers as connected.
- Read-only enforcement verified by attempted UPDATE against prod returning an error.

---

- [ ] **Unit 8: Switch SPA env and deploy to Cloudflare Pages**

**Goal:** Point Knowlune at Cloud Supabase; deploy the SPA to Cloudflare Pages auto-building from `main`.

**Requirements:** R1, R10

**Dependencies:** Unit 2, 5, 6

**Files:**
- Modify: `.env.example` — document new Cloudflare Pages + Cloud Supabase env setup
- Modify: `.env.production` (or wherever prod env lives) — swap `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`
- Create: `public/_redirects` — Cloudflare Pages SPA fallback: `/* /index.html 200`
- Create: `docs/deployment/cloudflare-pages-setup.md` — runbook for the Pages dashboard (connect GitHub repo, set build command, env vars, custom domain)
- Modify: `vite.config.ts` — verify build output is `dist/` (default, likely no change)
- Modify: `.github/workflows/deploy-titan.yml` — keep but mark as "deprecated — see cloudflare-pages-setup.md"; don't delete yet (for rollback)

**Approach:**
1. On Cloudflare Pages dashboard: create project, connect the Knowlune GitHub repo, set:
   - Framework preset: None (custom)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variables (Production): `VITE_SUPABASE_URL=https://<prod-ref>.supabase.co`, `VITE_SUPABASE_ANON_KEY=<anon>`, `VITE_API_BASE_URL=https://<prod-ref>.supabase.co/functions/v1`, `VITE_SENTRY_DSN=<if any>`
   - Custom domain: initially `knowlune-cfp.pages.dev` (test); during cutover (Unit 10), point `knowlune.pedrolages.net` at Pages.
2. `public/_redirects` with `/* /index.html 200` handles SPA route fallback (otherwise direct navigation to `/courses` 404s).
3. Push a branch to verify auto-deploy; preview URL populated.
4. Keep `Dockerfile`, `docker-compose.yml`, and `deploy-titan.yml` intact for rollback window.

**Patterns to follow:**
- [Cloudflare Pages + React SPA](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- The earlier `docs/plans/2026-04-18-011-feat-knowlune-online-beta-launch-plan.md` which proposed this split — reuse any finalized env var list.

**Test scenarios:**
- Happy path: push a branch, Pages preview deploys, preview URL loads Knowlune with Cloud Supabase backing.
- Happy path: navigating to `/courses` directly on Pages preview returns the SPA (not a 404).
- Edge case: env vars missing → build fails loudly; Pages dashboard surfaces the error.
- Integration: sign in from Pages preview, create a note, refresh, note persists (proves full stack works end-to-end).
- Error path: bad Supabase URL → SDK client is null, app falls back to guest-only mode (graceful degradation in `src/lib/auth/supabase.ts`).

**Verification:**
- Preview URL loads with working sign-in, sync, and AI chat.
- Custom domain staging (e.g., `beta.knowlune.pedrolages.net`) resolves and loads.
- `docs/deployment/cloudflare-pages-setup.md` written and reviewed.

---

- [ ] **Unit 9: Reconfigure Cloudflare Worker (retention-tick cron) to point at Cloud**

**Goal:** Keep the 03:00 UTC daily retention cron running against the new Cloud project.

**Requirements:** R11

**Dependencies:** Unit 5 (retention-tick function deployed to Cloud)

**Files:**
- Modify: `wrangler.toml` — verify cron config unchanged; update comments
- Modify: Cloudflare Worker secrets via `wrangler secret put`:
  - `SUPABASE_FUNCTIONS_URL` → `https://<prod-ref>.supabase.co/functions/v1`
  - `RETENTION_TICK_SECRET` → regenerate (one-time rotate during migration)
- Modify: `supabase/functions/retention-tick/index.ts` — update expected `RETENTION_TICK_SECRET` env var from Cloud Functions secrets (set via `supabase secrets set`)

**Approach:**
1. `wrangler secret put RETENTION_TICK_SECRET` — set new random secret.
2. `wrangler secret put SUPABASE_FUNCTIONS_URL` — set to Cloud URL.
3. `supabase secrets set RETENTION_TICK_SECRET=<same_value> --project-ref=<prod-ref>` — must match on both sides.
4. Deploy Worker: `wrangler deploy`.
5. Manually trigger once via `wrangler tail` + manual cron fire (or wait for 03:00 UTC and monitor logs).

**Patterns to follow:**
- `docs/deployment/retention-cron-setup.md` existing runbook.

**Test scenarios:**
- Happy path: manual trigger of retention-tick writes an audit row to `public.retention_audit_log` on Cloud.
- Happy path: cron fires at 03:00 UTC (day+1), audit log has new row.
- Edge case: user flagged with `pending_deletion_at` > 7 days ago gets hard-deleted (verify in staging first!).
- Edge case: exports bucket objects > 7d old are purged.
- Error path: wrong secret → 401 from Edge Function; Worker logs the error, does not silently succeed.
- Integration: old self-hosted retention cron should be disabled (stop the Cloudflare Worker's old config if it existed, or confirm there was only one).

**Verification:**
- `retention_audit_log` row appears on Cloud after manual trigger.
- Next 03:00 UTC fire lands a second row without manual intervention.

---

- [ ] **Unit 10: Cutover and smoke test**

**Goal:** Flip DNS to Cloudflare Pages + Cloud Supabase, smoke-test critical flows, monitor for issues.

**Requirements:** R1, R2, R3, R4, R5, R7, R8, R10

**Dependencies:** Units 2, 3, 4, 5, 6, 8, 9 (all done)

**Files:** *(operational)*
- Modify: Cloudflare DNS → `knowlune.pedrolages.net` → Cloudflare Pages target
- Modify: Cloudflare DNS → `supabase.pedrolages.net` — leave pointing at titan during the 14-day rollback window (or remove if confident)
- Modify: Traefik on titan → flip Knowlune container to read-only / disable inbound (stop-gap)

**Approach:**
1. Pre-cutover checklist:
   - All Unit 1-9 verifications green.
   - Encrypted vault plaintext file still exists on laptop (rollback resource).
   - `migration/` dump files archived to Cloudflare R2 or similar (rollback resource).
2. Maintenance banner: push a one-line notice to knowlune.pedrolages.net via the Unraid container (if possible), or just skip — downtime is acceptable for a <100-user personal app.
3. Stop writes to self-hosted: `docker stop knowlune` on titan (app no longer talks to the DB).
4. Take a final delta dump from self-hosted (catches any writes between the initial Unit 2 dump and now — usually zero if maintenance was clean).
5. Apply delta to Cloud if non-empty (skip if empty).
6. DNS flip: Cloudflare DNS → `knowlune.pedrolages.net` → Cloudflare Pages (`knowlune-cfp.pages.dev` target, or directly CNAME'd). Propagation ~minute with Cloudflare proxy.
7. Smoke tests (manual, via Playwright if available):
   - Anonymous guest: load landing, try to use a feature that requires auth → sees sign-in prompt.
   - Sign up: new account creation + email verification flow works.
   - Sign in: existing email/password works (proves bcrypt hash transfer).
   - Google OAuth: sign in via Google succeeds.
   - Guest → signed-in: guest does some writes (localStorage'd), signs in, data backfilled with `userId`.
   - AI chat: send message, streaming response arrives.
   - Ollama BYOK: configure Ollama URL, chat, streaming works.
   - Sync: create a note, refresh, note present (download phase).
   - Storage: upload a PDF/book cover, verify it appears.
   - Calendar: subscribe to iCal URL in an external calendar app; events load.
   - Cover proxy: book cover from a Google Books URL renders.
   - Account deletion: test user triggers soft-delete → `pending_deletion_at` set.
   - Export: test user requests data export → ZIP delivered (or async job started).
8. Monitor Supabase Cloud Dashboard → Logs for 2 hours post-cutover. Watch for 500s, RLS rejections, rate-limit anomalies.

**Patterns to follow:**
- Existing smoke-test patterns in `tests/e2e/` (Playwright).

**Test scenarios:**
- Happy path: each of the 13 smoke test flows above.
- Edge case: user with a large sync backlog (many queued writes from offline work) signs in → backlog uploads successfully.
- Edge case: user on mobile Safari (common for personal apps) loads and signs in.
- Error path: any 500 in Supabase logs → pause, diagnose, decide: fix forward or rollback.
- Integration: AI streaming + sync happening concurrently — no interference.
- Integration: retention-tick's 03:00 fire the night of cutover — executes cleanly.

**Verification:**
- All 13 smoke tests pass.
- Zero 500s in Supabase Cloud logs for 2 hours post-cutover.
- `knowlune.pedrolages.net` serves Pages SPA (check `Server:` header).
- AI chat streaming works end-to-end with a real provider.

---

- [ ] **Unit 11: Post-cutover cleanup and 14-day rollback window**

**Goal:** Keep rollback option warm for 14 days; then decommission self-hosted cleanly.

**Requirements:** R10

**Dependencies:** Unit 10 (cutover complete)

**Files:**
- Modify: `CLAUDE.md` or `docs/engineering-patterns.md` — update reference to deployment topology (from "bundled on Unraid" to "split: Cloudflare Pages + Supabase Cloud")
- Modify: memory file `project_actual_deployment_topology.md` on 2026-05-08 (14 days post-cutover) — update to reflect new reality
- Modify: `docs/deployment-guide.md` — deprecate or rewrite
- Delete (day 14+): `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh` — only after rollback window closes
- Delete (day 14+): `.github/workflows/deploy-titan.yml`
- Delete (day 14+): `server/` directory — after 14 days of zero Edge Function regression reports

**Approach:**

**Day 0-14 (rollback window):**
- Titan stays running with self-hosted Supabase and Knowlune container in read-only mode.
- If a critical bug on Cloud surfaces:
  - Flip DNS `knowlune.pedrolages.net` back to titan.
  - Flip titan Knowlune container back to read-write.
  - Cloud becomes read-only clone; manually reconcile any writes that happened on Cloud since DNS flip (likely small).
- Daily check: review Supabase Cloud logs + Sentry. Open issues for any unexpected behavior.

**Day 14:**
- Confirm no outstanding issues.
- Delete the local encrypted vault plaintext file (`shred migration/vault-plaintext.enc`).
- Stop the `supabase-*` Docker containers on titan (`docker compose -f /mnt/user/docker/stacks/supabase/docker-compose.yml down`).
- Delete `/mnt/cache/appdata/supabase/` after backing up to cold storage (Cloudflare R2 or external drive).
- Remove `server/` from the repo — commit deletion.
- Update CLAUDE.md, `docs/engineering-patterns.md`, and memory file `project_actual_deployment_topology.md`.
- Archive the `knowlune-staging` Supabase project OR keep for continued use — Pedro's call.

**Patterns to follow:**
- Memory update pattern — `feedback_sprint_status_drift.md` style (re-check state, update the memory).

**Test scenarios:**
- Happy path: day 14 cleanup proceeds; no production impact; rollback artifacts safely removed.
- Edge case: a regression discovered day 13 → rollback path works; migration remains paused for 7 more days.
- Integration: CLAUDE.md update reflects actual deployment; next agent session reading CLAUDE.md has accurate context.

**Verification:**
- `docker ps` on titan shows zero Supabase containers.
- Repo `grep -r "titan\|supabase.pedrolages.net" src/ server/` returns no hits.
- Memory index + project file updated.

---

## System-Wide Impact

- **Interaction graph:**
  - Client SDK (`src/lib/auth/supabase.ts`) touches every auth and data path. Env swap is the single load-bearing change.
  - Edge Functions replace Express middleware chain — `server/middleware/{authenticate,entitlement,rate-limiter,origin-check}.ts` have direct equivalents in `supabase/functions/_shared/`.
  - Cloudflare Worker (retention-tick) crosses two boundaries: Worker → Edge Function → DB. Secret rotation touches both sides.
- **Error propagation:**
  - DB unavailability during Unit 2/Unit 10 cutover surfaces as 503s in SPA; current graceful-degradation (null client → guest mode) handles this cleanly.
  - Edge Function cold starts (200-400ms) add latency to AI first-token time; acceptable but trackable.
  - Rate-limit 429s need to surface in UI — confirm existing AI-chat toast handling.
- **State lifecycle risks:**
  - Post-DNS-flip, writes briefly land on Cloud while inflight Express requests still hit titan. Mitigation: Unit 10 step 3 stops the Knowlune container on titan BEFORE DNS flip, so no writes are possible.
  - `auth.refresh_tokens` dumped in Unit 2 but will be invalidated by signing-key migration in Unit 6 — one forced re-login, expected.
- **API surface parity:** SPA sees identical API shapes; only the base URL changes. No client-side refactor beyond env vars.
- **Integration coverage:** the Cutover Unit (10) bundles the integration scenarios — sync engine + AI + storage + calendar + OAuth + guest→signed-in all exercised in one smoke-test pass.
- **Unchanged invariants:**
  - Database schema — zero changes (restored as-is).
  - Table names, column names, RLS policies — unchanged.
  - SDK major version — still `@supabase/supabase-js` v2.
  - `syncableWrite()` entry point — unchanged.
  - Dexie schema — unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Unraid disk stays full → can't take fresh dump | Fall back to 04:40 UTC pre-crash dump (`/mnt/cache/appdata/supabase/db/dumps/supabase_dumpall_20260424_044001.sql`). Accept ≤8 hours of pre-crash writes as potentially lost (acceptable given app has been down since crash anyway). |
| Edge Function cold start degrades AI streaming UX | Measure in Unit 5 smoke test. If median > 600ms, enable Supabase function warming OR add a "thinking..." indicator that's already present for non-streaming paths. |
| `auth.users` password hash restore fails silently | Test at least 3 users (different auth methods — email/password, OAuth, magic link) in Unit 2 verification. Do NOT proceed to Unit 10 without proof. |
| Vault re-insert breaks OPDS/ABS integrations | Unit 4 tests specifically exercise OPDS and ABS flows. Confirm `vault-credentials` Edge Function uses name-based lookup. |
| Cloudflare Pages preview works but custom domain routing breaks | Test custom-domain preview (`beta.knowlune.pedrolages.net`) in Unit 8 before the DNS flip in Unit 10. |
| Ollama BYOK timeout through Edge Function CDN layer | Ollama endpoint has no entitlement check and is simple passthrough; timeouts surface as 504. If problematic, short-term mitigation: user points Ollama requests directly at their local instance by setting `apiBaseUrl` in client. |
| Free-tier Cloud DB auto-pauses after 7 days inactivity | Pedro is actively developing, so in practice the DB stays warm. If pause occurs during dev, first request after pause takes ~30s (warmup). If this becomes painful → upgrade to Pro ($25/mo). |
| pgsodium / vault changes in Cloud post-migration | pgsodium is deprecation-pending; vault API stable. No action needed. Watch Supabase release notes for vault internals swap. |
| JWT signing key migration breaks some auth paths | Unit 6 verification exercises all auth methods; if any fails, revert to HS256 legacy secret (still present as standby) until the issue is isolated. |
| Rollback DB diverges from Cloud during 14-day window | Rollback is only triggered on critical issues; by definition writes are minimal during that window. Document the 2-write reconciliation path: manual diff via `pg_dump --data-only` comparison. |
| `server/providers.ts` uses Vercel AI SDK npm packages → Deno compatibility uncertainty | Audit in Unit 5; likely outcome is raw `fetch` to provider REST APIs. No Vercel SDK streaming abstractions are load-bearing that can't be replaced by direct `ReadableStream` from provider SSE. Zhipu GLM (`zhipu-ai-provider`) is a niche package — may need raw fetch fallback. |

## Documentation / Operational Notes

- **Runbooks to write:**
  - `docs/deployment/cloudflare-pages-setup.md` (Unit 8)
  - `docs/engineering/supabase-mcp-setup.md` (Unit 7)
- **Runbooks to update:**
  - `docs/deployment/retention-cron-setup.md` — update Supabase Functions URL reference.
  - `docs/deployment-guide.md` — deprecate or rewrite for Pages+Cloud topology.
  - `CLAUDE.md` — reference the new topology.
- **Memories to update (post-Unit 11):**
  - `project_actual_deployment_topology.md` — new reality (Pages + Cloud, no Unraid).
  - `reference_supabase_unraid.md` — mark as historical; link to migration plan.
  - `project_abs_cors_proxy.md` — update Express→Edge Function reference.
- **Monitoring additions:**
  - Cloudflare Pages analytics (free, built-in).
  - Supabase Dashboard → Logs (rely on this during rollback window).
  - Existing Sentry (`VITE_SENTRY_DSN`) continues capturing client-side errors.

## Sources & References

- [Supabase: Migrating Auth Users Between Projects](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)
- [Supabase: Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase: Copy Storage Objects from Platform (S3)](https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3)
- [Supabase: Edge Functions — Deploy to Production](https://supabase.com/docs/guides/functions/deploy)
- [Supabase: Edge Functions — Environment Variables](https://supabase.com/docs/guides/functions/secrets)
- [Supabase: Vault](https://supabase.com/docs/guides/database/vault)
- [Supabase Issue #34964 — pgsodium.key and vault.secrets restore](https://github.com/supabase/supabase/issues/34964)
- [Supabase: JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase: Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase: MCP Server](https://supabase.com/docs/guides/getting-started/mcp)
- [Supabase Community MCP Server (GitHub)](https://github.com/supabase-community/supabase-mcp)
- [Cloudflare Pages: React deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- Related repo plans: `docs/plans/2026-04-18-011-feat-knowlune-online-beta-launch-plan.md`
- Related memories: `project_actual_deployment_topology.md`, `reference_supabase_unraid.md`, `project_abs_cors_proxy.md`
- Live-state report (from `ssh titan` inspection): inline in Context & Research → Live Unraid State
