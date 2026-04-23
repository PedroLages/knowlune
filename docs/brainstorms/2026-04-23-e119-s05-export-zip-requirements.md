# E119-S05: Registry-Driven Export ZIP — Requirements

## Problem Statement

Users exercising GDPR Art 15/20 rights (data access / data portability) currently receive only a local Dexie snapshot via `exportAllAsJson`. This misses all server-truth data stored in Supabase and all user-owned media stored in Storage buckets. A complete, verifiable, server-authoritative export ZIP must be produced by an Edge Function that iterates every table in `tableRegistry.ts` and every user-owned Storage object — so that any future table addition is automatically included without per-table code changes.

## Acceptance Criteria

- **AC-1** `export-data` Edge Function streams a ZIP containing:
  - `data.json` — all 38 sync tables from `tableRegistry.ts`, Supabase server-truth rows merged with local-only Dexie rows tagged `_origin: 'local'`
  - `media/<bucket>/...` — all user-owned objects from 4 Storage buckets (books, imported-courses, avatars, exports)
  - `README.md` — manifest (see AC-2)
- **AC-2** README manifest includes: export timestamp, notice version acknowledged, schema version (`CURRENT_SCHEMA_VERSION = 14`), per-table row counts, per-bucket object counts, contact email.
- **AC-3** If streaming would exceed 500 MB, Edge Function aborts and returns `{ status: 'too-large', route: 'async' }`.
- **AC-4** Export requires JWT auth; user ID from JWT is the sole filter (RLS + explicit `.eq('user_id', userId)` filter on every table query).
- **AC-5** Registry-driven: every entry in `tableRegistry.ts` is automatically included; no per-table hardcoding in the Edge Function.
- **AC-6** `MyDataSummary.tsx` updated to call the new Edge Function and trigger ZIP download; legacy `exportAllAsJson` preserved for non-GDPR backup use.
- **AC-7** E2E test: authenticated user can call the Edge Function, unzip response, and verify `data.json` contains their own rows.
- **AC-8** Unit test: RLS error on any table query causes export to fail-closed with an explicit error message (not a silent gap).

## Out of Scope

- Async export path for > 500 MB (E119-S06).
- Consent-gated data categories (E119-S08).
- Uploading the generated ZIP to the `exports/` Storage bucket before streaming — stream directly to the client.

## Technical Context

- **tableRegistry** (`src/lib/sync/tableRegistry.ts`): 38 entries, ordered P0–P4. Each entry has `supabaseTable`, `dexieTable`, `conflictStrategy`, `stripFields`, `vaultFields`. Vault fields (`password`, `apiKey`) must be excluded from the export payload (same as sync strip).
- **Storage buckets** (4): `books`, `imported-courses`, `avatars`, `exports` — list with `storage.from(bucket).list(userId + '/')`.
- **ZIP streaming in Deno**: use `https://esm.sh/fflate` or the `@zip-js/zip-js` package via esm.sh for streaming ZIP output. Deno `std/archive` only has tar, not zip.
- **500 MB guard**: accumulate byte count during iteration; abort before adding to ZIP if running total would exceed threshold.
- **noticeVersion**: import `CURRENT_NOTICE_VERSION` from the compiled edge function shared path or hardcode latest version in Edge Function context.
- **Existing Edge Functions**: patterns in `supabase/functions/delete-account/index.ts` and `supabase/functions/_shared/hardDeleteUser.ts` demonstrate JWT extraction, Supabase admin client creation, and RLS error handling.
- **MyDataSummary.tsx**: currently calls `exportAllAsJson()` directly (local Dexie only). Must add a second code path calling `/functions/v1/export-data` with `Authorization: Bearer <supabase_session_token>` and triggering `<a download>` on the blob response.
- **exportService.ts**: `exportAllAsJson` (CURRENT_SCHEMA_VERSION = 14) must be preserved — used by CSV/Markdown export flows and non-GDPR backup.
- **`src/lib/compliance/`**: existing module boundary; `exportBundle.ts` belongs here as the shared bundle-description helper.
- **Tests**: unit tests under `src/lib/compliance/__tests__/`, E2E test at `tests/e2e/compliance/data-export.spec.ts`.

## Open Questions

1. Does `notificationPreferences` singleton (PK = `'singleton'` in Dexie, `user_id` in Supabase) need special handling in export? — No, Supabase RLS filters by `user_id` automatically; the row will appear normally in the query result.
2. Should `embeddings` (uploadOnly, 384-dim vectors) be included in the export? — Yes, it is in the registry; include it (portability value for the user's semantic search data).
3. Should vault fields (`password`, `apiKey`) be redacted or omitted? — Omit entirely (same policy as sync `vaultFields` strip); include a note in README.md that credentials were omitted for security.
