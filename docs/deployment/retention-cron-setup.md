# Retention Cron Setup

Operational reference for the `retention-tick` Edge Function and its scheduled trigger. This document covers both the account deletion retention job (E119-S03/S04) and the exports bucket purge (E119-S06), with full implementation deferred to E119-S11.

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

## Related Files

- `supabase/functions/retention-tick/index.ts` — Edge Function implementation
- `supabase/functions/export-worker/index.ts` — Worker that creates exports (E119-S06)
- `supabase/migrations/20260430000001_export_jobs.sql` — `export_jobs` queue table (E119-S06)
- `docs/compliance/` — GDPR compliance artifacts (see S07–S13 stories)
