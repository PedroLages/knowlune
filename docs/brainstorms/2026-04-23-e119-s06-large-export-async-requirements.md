---
story: E119-S06
title: Large-Export Async Path + Signed URL
date: 2026-04-23
status: requirements
---

# E119-S06: Large-Export Async Path + Signed URL

## Problem Statement

When a user's data exceeds 500 MB, `export-data` already returns `{ status: 'too-large', route: 'async' }` instead of streaming the ZIP. Currently no code handles that response: the UI shows a generic message and nothing happens. This story closes the loop — enqueuing the export job server-side, running it via an `export-worker` Edge Function, uploading the ZIP to the `exports/` Storage bucket, and emailing the user a 7-day signed URL.

The async path must also be resilient to duplicate requests (de-duplication) and transient failures (one retry with idempotency).

## Acceptance Criteria

- **AC-1** — When `callExportDataFunction` returns `{ status: 'too-large', route: 'async' }`, `MyDataSummary.tsx` shows the toast "We're preparing your export — you'll receive an email with a download link." (distinct from current generic message).
- **AC-2** — `export-data` enqueues an async job `(user_id, request_id, created_at, status='queued')` in a new `export_jobs` Supabase table and returns `202 { status: 'queued', eta: string }`.
- **AC-3** — `export-worker` Edge Function picks up queued jobs, builds the ZIP bundle (same logic as the inline path), uploads to `exports/<user_id>/<request_id>.zip`, creates a signed URL (7-day expiry), and emails the user.
- **AC-4** — If a user already has a `queued` or `processing` job, a second request returns the existing job's `request_id` (de-duplication). Only one URL is emailed.
- **AC-5** — If the worker fails, the job is retried once (idempotency key / `attempt_count` column); on second failure the job status is set to `failed` and the user receives an error email ("we couldn't build your export — please contact support").
- **AC-6** — The `exports/` bucket's signed URL expiry is 7 days; `retention-tick` (S11) is responsible for purging objects older than 7 days. This story documents that dependency.
- **AC-7** — `docs/deployment/retention-cron-setup.md` updated with `exports/` purge details.

## Out of Scope

- Retention enforcement job (S11) — only the documentation hook is delivered here.
- Consent toggles affecting export content (S08).
- Real-time progress UI (polling / WebSocket).

## Technical Context

### Existing code to extend

- `supabase/functions/export-data/index.ts` — already returns `{ status: 'too-large', route: 'async' }` when `estimatedBytes > MAX_EXPORT_BYTES`. Extend to also enqueue job + return 202.
- `src/app/components/settings/MyDataSummary.tsx` — already branches on `'status' in result`, but shows a generic message. Update to show AC-1 copy.
- `src/lib/compliance/emailTemplates.ts` — add `exportReadyEmail(downloadUrl, expiresAt)` and `exportFailedEmail()`.
- `supabase/functions/_shared/sendEmail.ts` — shared email helper already used by retention-tick.

### New code required

- `supabase/migrations/YYYYMMDDHHMMSS_export_jobs.sql` — `export_jobs` table with columns: `id uuid PK`, `user_id uuid FK auth.users`, `request_id uuid`, `status text` (queued/processing/done/failed), `attempt_count int`, `created_at`, `updated_at`, `completed_at`, `signed_url text`. RLS: users can SELECT own rows; service role full access.
- `supabase/functions/export-worker/index.ts` — Edge Function invoked by `export-data` via `fetch` or by a cron trigger. Picks up oldest queued job, sets status=processing, builds ZIP (reuses inline path logic), uploads, creates signed URL, emails user, sets status=done.
- Unit tests in `supabase/functions/export-worker/__tests__/` covering AC-3, AC-4, AC-5.

### Queue mechanism

Use a simple Supabase table (`export_jobs`) instead of Cloudflare Queues — self-hosted Supabase is already available, no extra infrastructure. `export-data` inserts the job and then fires `export-worker` via an async `fetch` (fire-and-forget) so the 202 returns quickly. `export-worker` selects jobs using a `FOR UPDATE SKIP LOCKED` pattern to avoid concurrent workers picking the same job.

### Signed URL

`supabase.storage.from('exports').createSignedUrl(path, 7 * 24 * 3600)` — 7-day TTL in seconds. The URL is stored in `export_jobs.signed_url` for audit/de-duplication.

## Open Questions

1. Should `export-data` fire `export-worker` inline (async fetch) or rely on polling? — Inline fire-and-forget chosen; simplest with no extra infra.
2. What ETA to return in the 202 response? — "within a few minutes" as plain text; no precise SLA committed.
3. Does the `exports/` bucket already exist? — Yes, listed in `STORAGE_BUCKETS` in `export-data/index.ts`; RLS migration may be needed.
