# Retention Cron Setup

Operational reference for the `retention-tick` Edge Function and its scheduled trigger.  
**E119-S11 update (2026-04-23):** Full retention enforcement is now implemented. This document has been updated with complete deployment instructions, dry-run procedures, and monitoring guidance.

Covers: account deletion grace finaliser (E119-S03/S04), exports bucket purge (E119-S06), chat_conversations rolling delete, and audit logging (E119-S11).

---

## Overview

`retention-tick` is a Supabase Edge Function (`supabase/functions/retention-tick/index.ts`) that performs periodic data hygiene:

1. **Hard-delete scheduled accounts** — users who requested deletion and whose 7-day grace period has expired.
2. **Purge expired exports** — ZIP archives in the `exports/` Storage bucket that are older than 7 days (signed URL TTL).

The function is triggered by an external cron caller (Cloudflare Worker cron trigger or equivalent) rather than pg_cron. This choice keeps the logic in TypeScript, observable in the same log stream as other functions, and avoids reliance on pg_cron availability in the self-hosted Supabase deployment.

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypasses RLS) | Yes |
| `STRIPE_SECRET_KEY` | Stripe API key for customer anonymisation | Optional |
| `RETENTION_TICK_SECRET` | Shared secret for cron-to-function auth | Yes (production) |
| `EMAIL_API_KEY` | Resend (or equivalent) API key for emails | Yes (production) |
| `EMAIL_FROM` | Sender address, e.g. `Knowlune <noreply@knowlune.com>` | Yes (production) |
| `EMAIL_PROVIDER_URL` | Email provider POST endpoint (defaults to Resend) | Optional |

---

## Cron Trigger Setup

### Option A: Cloudflare Worker cron trigger (recommended)

Create a Cloudflare Worker that fires daily at 03:00 UTC:

```toml
# wrangler.toml (Cloudflare Worker)
[triggers]
crons = ["0 3 * * *"]
```

Worker script (pseudocode):
```javascript
export default {
  async scheduled(event, env) {
    await fetch(`${env.SUPABASE_URL}/functions/v1/retention-tick`, {
      method: 'POST',
      headers: { 'X-Retention-Secret': env.RETENTION_TICK_SECRET },
    })
  }
}
```

Set `RETENTION_TICK_SECRET` as a secret in both the Cloudflare Worker and the Supabase Edge Function environment.

### Option B: External HTTP cron (e.g. cron-job.org)

Configure a daily HTTP POST to:

```
POST https://<supabase-project>/functions/v1/retention-tick
Headers:
  X-Retention-Secret: <RETENTION_TICK_SECRET value>
```

Schedule: `0 3 * * *` (03:00 UTC daily)

### Option C: pg_cron (not recommended for self-hosted)

pg_cron availability on self-hosted Supabase varies. Use Option A or B for reliability.

---

## Exports Bucket Purge

**Status: implementation deferred to E119-S11.**

### Background

The `exports/` Storage bucket stores GDPR data export ZIP archives created by `export-worker` (E119-S06). Each archive has a 7-day signed URL TTL (`SIGNED_URL_TTL_SECONDS = 604800`). After the signed URL expires, the object is inaccessible to the user but remains in Storage until explicitly purged.

### Purge window

Objects in `exports/<user_id>/<request_id>.zip` that are **older than 7 days** should be deleted. This matches the signed URL TTL so no accessible objects are purged prematurely.

### Implementation note (S11)

When implementing S11, add a purge step to `retention-tick/index.ts` that:

1. Lists all objects in the `exports/` bucket using `supabaseAdmin.storage.from('exports').list('')` (paginated).
2. Filters objects whose `created_at` metadata is older than 7 days.
3. Deletes filtered objects in batches using `supabaseAdmin.storage.from('exports').remove([...paths])`.

Reference: `export_jobs` table `completed_at` column can also be used to identify stale jobs and correlate with Storage objects.

### Audit trail

`export_jobs` rows with `status = 'done'` or `'failed'` should be retained for at least 90 days as an audit trail (GDPR Art 5(1)(e) storage limitation). The Storage object purge does not remove `export_jobs` rows — only the ZIP file is deleted.

---

## Testing the Cron Trigger

To verify the trigger is working:

```bash
# Manual invocation (replace URL and secret)
curl -X POST https://<supabase-project>/functions/v1/retention-tick \
  -H "X-Retention-Secret: <your-secret>" \
  -H "Content-Type: application/json"
```

Expected response: `{ "processed": <n>, "errors": [] }` (or equivalent from S11 implementation).

---

## S11 Complete Deployment (2026-04-23)

### Architecture

```
Cloudflare Cron (03:00 UTC)
  → Cloudflare Worker: knowlune-retention-cron
      → POST /functions/v1/retention-tick
          Header: x-retention-secret: <RETENTION_TICK_SECRET>
  ← 200 (clean) or 207 (partial failures)
```

### What the function does on each run

1. **Heartbeat check** — warns via `[HEARTBEAT_MISS]` if no audit log row in 48h.
2. **Grace finaliser** — hard-deletes users whose `pending_deletion_at` is >7 days old (AC-5).
3. **Per-entry enforcement** — iterates `RETENTION_POLICY` (47 entries):
   - `storage:exports` — purges objects older than 7 days from the exports bucket (AC-6).
   - `chat_conversations` — deletes rows with `updated_at < now() - 365 days` (365d rolling, no pinning yet).
   - All other entries — logged as skipped (handled by hardDeleteUser cascade or manually managed).
4. **Audit logging** — writes one `retention_audit_log` row per entry per run.
5. Returns HTTP 200 (all clean) or 207 (partial failures for alerting).

### Cloudflare Worker deployment

```bash
# Install wrangler if not present
npm install -g wrangler

# Authenticate
wrangler login

# Set secrets (never stored in wrangler.toml)
wrangler secret put RETENTION_TICK_SECRET
# → Paste the shared secret (also set in Supabase Edge Function env)

wrangler secret put SUPABASE_FUNCTIONS_URL
# → Enter: https://<supabase-host>/functions/v1

# Deploy
wrangler deploy

# Verify cron is registered
wrangler triggers list
# Expected: "0 3 * * *"
```

### Database migration

Apply the `retention_audit_log` migration before first use:

```bash
# Self-hosted Supabase (Unraid) — copy migration file then push
# supabase/migrations/20260501000001_retention_audit_log.sql
supabase db push
```

### Generate the shared secret

```bash
openssl rand -hex 32
# Set this value in BOTH:
#   - Cloudflare Worker secret (wrangler secret put RETENTION_TICK_SECRET)
#   - Supabase Edge Function env var (RETENTION_TICK_SECRET)
```

### Manual dry-run (AC-10)

```bash
# Seed a chat_conversations row older than 365 days (in Supabase Studio SQL editor):
#   INSERT INTO public.chat_conversations (id, user_id, course_id, video_id, mode,
#     hint_level, messages, created_at_epoch, created_at, updated_at)
#   VALUES (gen_random_uuid(), '<test-user-id>', 'test', 'test', 'tutor', 0, '[]',
#     0, now()-interval '400 days', now()-interval '400 days');

# Invoke the function
curl -X POST https://<supabase-host>/functions/v1/retention-tick \
  -H "x-retention-secret: <RETENTION_TICK_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

# Expected: { "success": true, "run_id": "<uuid>", "processed": 2, "skipped": 45 }

# Verify audit log
# SELECT artefact, rows_affected, skipped, error FROM public.retention_audit_log
#   WHERE run_id = (SELECT run_id FROM retention_audit_log ORDER BY completed_at DESC LIMIT 1)
#   ORDER BY artefact;

# Verify chat row was deleted
# SELECT count(*) FROM public.chat_conversations WHERE updated_at < now()-interval '365 days';
# Expected: 0
```

### Heartbeat monitoring

The function emits `console.error('[HEARTBEAT_MISS] ...')` if no `retention_audit_log` row has `completed_at > now() - 48h` (and this is not the first run).

Watch for it in:

- Cloudflare Worker Logs (Dashboard → `knowlune-retention-cron` → Logs)
- Supabase Edge Function Logs (Studio → `retention-tick` → Logs)

SQL check:

```sql
SELECT count(*) FROM public.retention_audit_log
  WHERE completed_at > now() - interval '48 hours';
-- If 0 and table is non-empty, cron missed its last run.
```

### Rollback

```bash
# Disable the cron trigger only (keeps Worker deployed)
# Remove the [triggers] section from wrangler.toml and redeploy:
wrangler deploy

# Or delete the Worker entirely
wrangler delete knowlune-retention-cron
```

### Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| 401 Unauthorized | `x-retention-secret` mismatch | Verify secret matches in Cloudflare Worker secrets and Supabase Edge Function env |
| 500 Internal Server Error | Missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` | Check Edge Function secrets in Supabase Studio |
| Audit rows not appearing | Migration not applied | Run `20260501000001_retention_audit_log.sql` |
| `[HEARTBEAT_MISS]` on first run | Expected — no prior rows | Ignore on first deployment |
| Cron not firing | Worker not deployed or trigger removed | `wrangler deploy` then `wrangler triggers list` |
| `exports/` objects not purged | Objects stored under user prefix | Verify objects are at root level (not `userId/`) in the exports bucket |

---

## Related Files

- `supabase/functions/retention-tick/index.ts` — Edge Function implementation (E119-S11 full)
- `supabase/functions/_shared/retentionPolicy.ts` — Deno-compatible retention policy (must stay in sync with `src/lib/compliance/retentionPolicy.ts`)
- `supabase/migrations/20260501000001_retention_audit_log.sql` — Audit log table
- `cloudflare-workers/retention-cron.js` — Cloudflare Worker pass-through
- `wrangler.toml` — Cloudflare Worker config with cron trigger
- `supabase/functions/export-worker/index.ts` — Worker that creates exports (E119-S06)
- `supabase/migrations/20260430000001_export_jobs.sql` — `export_jobs` queue table (E119-S06)
- `docs/compliance/` — GDPR compliance artifacts (see S07–S13 stories)
