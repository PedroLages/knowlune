---
title: "feat: Registry-Driven Export ZIP (E119-S05)"
type: feat
status: active
date: 2026-04-23
origin: docs/brainstorms/2026-04-23-e119-s05-export-zip-requirements.md
---

# feat: Registry-Driven Export ZIP (E119-S05)

## Overview

Add an `export-data` Supabase Edge Function that streams a ZIP archive containing all 38 sync-table rows (server-truth, user-scoped via RLS), all user-owned Storage objects from 4 buckets, and a README manifest — driven automatically by `tableRegistry.ts`. Update `MyDataSummary.tsx` to call this new endpoint for GDPR exports while preserving the existing `exportAllAsJson` for non-GDPR backup.

## Problem Frame

GDPR Art 15/20 entitle users to a portable, complete copy of all their data. The current export (`exportAllAsJson`) captures only the local Dexie snapshot — it misses server-truth rows that haven't synced locally and all media stored in Supabase Storage. The new Edge Function must produce an authoritative ZIP from the server side, iterating the registry so future table additions are automatically included without code changes.

## Requirements Trace

- R1. Edge Function streams ZIP: `data.json` (38 tables), `media/<bucket>/…` (4 buckets), `README.md` (AC-1)
- R2. README includes export timestamp, notice version, schema version, per-table row counts, per-bucket object counts, contact email (AC-2)
- R3. Abort with `{ status: 'too-large', route: 'async' }` if streamed bytes would exceed 500 MB (AC-3)
- R4. JWT auth required; user ID from JWT is the sole data filter (AC-4)
- R5. Registry-driven iteration — no per-table hardcoding (AC-5)
- R6. `MyDataSummary.tsx` calls new endpoint; legacy `exportAllAsJson` preserved (AC-6)
- R7. E2E test: authenticated user downloads, unzips, sees own rows in `data.json` (AC-7)
- R8. Unit test: RLS error on any table causes fail-closed with explicit error (AC-8)

## Scope Boundaries

- Async export path for > 500 MB is out of scope (E119-S06 handles it)
- Consent-gated data categories are out of scope (E119-S08)
- Uploading the ZIP to Storage before streaming is out of scope — stream directly to the client
- The `exports/` Storage bucket creation mentioned in the story tasks is deferred — the Edge Function does not write to it

### Deferred to Separate Tasks

- Async / large-export fallback: separate story E119-S06
- Consent-scoped data categories: separate story E119-S08

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/tableRegistry.ts` — 38 entries with `supabaseTable`, `vaultFields`, `stripFields`, `conflictStrategy`. `ERASURE_TABLE_NAMES` already derives the table list; export should use the same source.
- `supabase/functions/delete-account/index.ts` — canonical JWT auth pattern: anon-client `getUser()` + service-role admin client for privileged ops. CORS headers. `json()` helper.
- `supabase/functions/_shared/hardDeleteUser.ts` — iterates tables and Storage buckets in a loop; non-fatal per-table errors collected and returned. Same iteration pattern applies to export.
- `src/lib/compliance/noticeVersion.ts` — `CURRENT_NOTICE_VERSION` constant. Edge Functions cannot import TS source; hardcode the value or pass as env var.
- `src/lib/exportService.ts` — `CURRENT_SCHEMA_VERSION = 14`, `exportAllAsJson` (Dexie-only). Must be preserved; E2E tests call it for non-GDPR scenarios.
- `src/app/components/settings/MyDataSummary.tsx` — currently calls `exportAllAsJson()` directly; must add a second code path for GDPR ZIP download via Edge Function.
- `tests/e2e/compliance/notice-acknowledgement.spec.ts` — reference E2E pattern: Supabase endpoints mocked via `page.route()`, deterministic dates via `page.clock`.
- `src/lib/fileDownload.ts` — existing `downloadJson` helper. ZIP download needs an analogous `downloadBlob` or inline blob-URL approach.

### Institutional Learnings

- Edge Functions cannot import from `src/` — any shared constant (notice version, schema version) must be duplicated or passed via env var.
- Vault fields (`password`, `apiKey`) must be stripped from export payloads — same policy as sync upload strip. Include a README note that credentials were omitted for security.
- `embeddings` is upload-only in sync but should still appear in the export (portability value for semantic search data).
- The `notificationPreferences` singleton (Dexie PK `'singleton'`, Supabase PK `user_id`) is filtered correctly by RLS; no special handling needed in the export loop.
- ZIP in Deno: `std/archive` only has tar. Use `fflate` (via `https://esm.sh/fflate`) which supports streaming ZIP and runs in Deno without Node shims.

### External References

- fflate streaming ZIP API: `Zip` + `ZipPassThrough` or `ZipDeflate` for streaming member-by-member output
- Supabase Edge Function streaming response: `new Response(readableStream, { headers: { 'Content-Type': 'application/zip' } })`
- Supabase Storage list API: `storage.from(bucket).list(prefix, { limit: 1000 })` — paginate if `data.length === 1000`

## Key Technical Decisions

- **fflate over std/archive**: Deno's `std/archive` module only supports tar; fflate supports ZIP with streaming, runs in Deno, and is already used widely in the Supabase Edge Function ecosystem.
- **Stream ZIP bytes via ReadableStream TransformStream**: Use a `TransformStream` to pipe fflate `Zip` output into a `Response` body — avoids buffering the entire ZIP in memory.
- **Fail-closed on RLS error (not empty)**: A Supabase query that returns `error` (not just `data: []`) aborts the export with HTTP 500 and explicit message. Empty result is fine (user has no data in that table).
- **500 MB guard via running byte count**: Accumulate bytes written to the ZIP stream; before appending a new file, check if threshold is exceeded and return `{ status: 'too-large', route: 'async' }` as a JSON response. Note: once streaming has started we can't change the HTTP status — the guard must fire before the first byte is written, or the function must buffer until safe to stream.
- **Vault fields stripped at export time**: Iterate `entry.vaultFields` from the registry entry and `delete row[field]` before adding to `data.json`. Add a per-table note in README when fields were stripped.
- **Notice version hardcoded in Edge Function**: `CURRENT_NOTICE_VERSION = '2026-04-23.1'` as a constant. A comment above it notes it must be bumped when `src/lib/compliance/noticeVersion.ts` changes.
- **`exportBundle.ts` as shared type definitions only**: The Edge Function logic lives in `supabase/functions/export-data/index.ts`. `src/lib/compliance/exportBundle.ts` provides TypeScript types (manifest shape, export response shape) consumed by the frontend caller in `MyDataSummary.tsx` — it does not contain runtime logic that would need to run in Deno.

## Output Structure

```
supabase/functions/export-data/
  index.ts                  ← Edge Function (Deno)

src/lib/compliance/
  exportBundle.ts           ← Frontend types: ExportManifest, ExportTooLargeResponse
  __tests__/
    exportBundle.test.ts    ← Unit tests (AC-8: RLS fail-closed)

tests/e2e/compliance/
  data-export.spec.ts       ← E2E test (AC-7)
```

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
POST /functions/v1/export-data
  │
  ├─ authenticate (JWT → userId)
  │
  ├─ Phase 0: size probe
  │   ├─ for each table in tableRegistry: COUNT rows WHERE user_id = userId
  │   ├─ for each bucket: sum object sizes from list()
  │   └─ if total > 500 MB → return { status: 'too-large', route: 'async' }
  │
  ├─ Phase 1: build manifest (row counts, bucket counts, timestamp, versions)
  │
  ├─ Phase 2: stream ZIP
  │   ├─ data.json: for each table in tableRegistry
  │   │   ├─ SELECT * FROM <supabaseTable> WHERE user_id = userId
  │   │   ├─ on error → abort with explicit message (AC-8)
  │   │   └─ strip vaultFields; tag rows with _origin: 'server'
  │   ├─ media/<bucket>/<key>: for each bucket
  │   │   └─ download + stream each object
  │   └─ README.md: manifest as markdown
  │
  └─ Response: application/zip  (streaming)
```

## Implementation Units

- [ ] **Unit 1: Edge Function `export-data` — core ZIP streaming**

**Goal:** Create the Deno Edge Function that authenticates, iterates the table registry to build `data.json`, streams media objects from 4 Storage buckets, appends `README.md`, and streams the result as a ZIP download.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** None (standalone Edge Function; registry table names copied from `hardDeleteUser.ts`)

**Files:**
- Create: `supabase/functions/export-data/index.ts`

**Approach:**
- Follow the JWT auth pattern from `delete-account/index.ts`: anon-client `getUser()`, service-role client for data queries.
- Table list: hardcode the 38 `supabaseTable` names (same array as `hardDeleteUser.ts`'s `TABLE_NAMES`) rather than importing from `src/`. Add a comment noting it must stay in sync with `tableRegistry.ts`.
- Size probe: run COUNT queries + Storage list calls before opening the ZIP stream. If estimated bytes > 500 MB, return JSON `{ status: 'too-large', route: 'async' }` before streaming starts.
- ZIP streaming: use fflate `Zip` class fed via a `TransformStream`. Pipe to `Response` body.
- For each table: `supabaseAdmin.from(table).select('*').eq('user_id', userId)`. On `error` (not null data): throw with message `RLS error on table ${table}: ${error.message}` — caught by outer try/catch → 500 with explicit body.
- Strip vault fields: each table entry in the hardcoded list should carry its vault fields. Simplest approach: inline a `VAULT_FIELDS` map `{ opds_catalogs: ['password'], audiobookshelf_servers: ['api_key'] }` and delete those keys from each row before appending.
- Media: `supabaseAdmin.storage.from(bucket).list(userId + '/', { limit: 1000 })`. For each object, `storage.from(bucket).download(userId + '/' + object.name)` → stream bytes into ZIP at path `media/<bucket>/<name>`.
- README.md: construct as a markdown string with manifest data; add as final entry in ZIP.
- CORS headers: same pattern as `delete-account` (APP_URL env var or localhost fallback). Methods: `GET, OPTIONS` (export is a GET).

**Patterns to follow:**
- `supabase/functions/delete-account/index.ts` — JWT auth, CORS, env validation, `json()` helper
- `supabase/functions/_shared/hardDeleteUser.ts` — table + bucket iteration, non-fatal error collection

**Test scenarios:**
- Happy path: authenticated GET → response Content-Type is `application/zip`, response body is non-empty
- Happy path: ZIP contains `data.json`, `README.md` entries
- Happy path: `data.json` contains keys for all 38 tables
- Edge case: table with no rows → key present in `data.json` with empty array `[]`
- Edge case: estimated size > 500 MB → returns JSON `{ status: 'too-large', route: 'async' }` before streaming
- Error path: unauthenticated request → 401
- Error path: non-GET method → 405
- Error path: Supabase returns an error (not empty) for a table query → 500 with explicit error message (AC-8)
- Error path: vault fields (`password`, `api_key`) absent from exported rows

**Verification:**
- `curl -H 'Authorization: Bearer <token>' /functions/v1/export-data` returns a valid ZIP
- Unzipped `data.json` contains all 38 table keys
- Vault field values are absent from the output

---

- [ ] **Unit 2: `src/lib/compliance/exportBundle.ts` — frontend types and manifest shape**

**Goal:** Define the TypeScript types for the export manifest and the `too-large` response that `MyDataSummary.tsx` and unit tests share. No runtime logic.

**Requirements:** R2, R6

**Dependencies:** None

**Files:**
- Create: `src/lib/compliance/exportBundle.ts`
- Create: `src/lib/compliance/__tests__/exportBundle.test.ts`

**Approach:**
- Export `ExportManifest` interface: `{ exportedAt: string; noticeVersion: string; schemaVersion: number; tables: Record<string, number>; buckets: Record<string, number>; contactEmail: string }`.
- Export `ExportTooLargeResponse` interface: `{ status: 'too-large'; route: 'async' }`.
- Export `ExportDataResponse = { zipBlob: Blob; manifest: ExportManifest } | ExportTooLargeResponse`.
- Export `callExportDataFunction(supabaseAccessToken: string): Promise<ExportDataResponse>` — fetches `/functions/v1/export-data`, returns blob on 200, parses JSON on non-200.
- Mirrors pattern of other compliance module exports (`noticeAck.ts`, `noticeVersion.ts`).

**Patterns to follow:**
- `src/lib/compliance/noticeAck.ts` — module structure, typed exports

**Test scenarios:**
- Happy path: `callExportDataFunction` with mocked 200 ZIP response → returns `{ zipBlob: Blob, ... }`
- Error path: mocked 413/too-large JSON response → returns `ExportTooLargeResponse`
- Error path: network failure → throws with descriptive message
- Unit: `ExportManifest` shape satisfies the type definition (TypeScript compile-time check via `satisfies`)

**Verification:**
- `npx tsc --noEmit` passes with the new types
- Unit tests pass

---

- [ ] **Unit 3: Update `MyDataSummary.tsx` to call the Edge Function**

**Goal:** Replace the existing local-Dexie `exportAllAsJson` GDPR export with a call to the new `export-data` Edge Function. Keep legacy `exportAllAsJson` for the non-GDPR backup path (separate Settings flow if one exists, or silent preservation for future use).

**Requirements:** R6

**Dependencies:** Unit 2 (needs `callExportDataFunction`)

**Files:**
- Modify: `src/app/components/settings/MyDataSummary.tsx`

**Approach:**
- Import `callExportDataFunction` from `@/lib/compliance/exportBundle`.
- Import `useAuth` (or the equivalent Supabase session hook already used in the app) to get `session.access_token`.
- In `handleExport`: call `callExportDataFunction(accessToken)`. If response is `ExportTooLargeResponse`, show an informative toast ("Your data is too large for instant export — we'll email you when it's ready"). If response is a blob, trigger download as `knowlune-gdpr-export-<date>.zip` using a blob URL (`URL.createObjectURL`).
- Keep the existing `exportAllAsJson` import — do not remove it. If it is currently only called from `handleExport`, replace that call; if called elsewhere, leave untouched.
- The export button label should change to "Export ZIP" to distinguish it from the old JSON export.

**Patterns to follow:**
- `src/app/components/settings/MyDataSummary.tsx` — existing button/loading state pattern
- `src/lib/fileDownload.ts` — existing blob download helpers

**Test scenarios:**
- Happy path: button click → loading spinner shown → ZIP blob downloaded → success toast
- Edge case: too-large response → informative toast shown, no download triggered
- Error path: Edge Function call throws → `toastError.saveFailed` displayed
- Accessibility: button aria-label updated to reflect ZIP download

**Verification:**
- Manual: Settings > Account > My Data → Export ZIP → browser downloads `.zip` file
- No TypeScript errors on modified component

---

- [ ] **Unit 4: Unit tests — RLS fail-closed (AC-8)**

**Goal:** Verify that an RLS error on any table causes the export to fail-closed with an explicit error message — not a silent empty-array gap.

**Requirements:** R8 (AC-8)

**Dependencies:** Unit 1 (Edge Function behaviour to test)

**Files:**
- Create: `src/lib/compliance/__tests__/exportBundle.test.ts` (already listed in Unit 2; add AC-8 scenarios here)

**Approach:**
- Unit tests use Vitest, mocking `fetch` to simulate Edge Function responses.
- Test the `callExportDataFunction` helper with a mocked 500 response containing `{ error: 'RLS error on table notes: ...' }` — verify the function throws (or returns an error object) rather than silently succeeding with missing data.
- A separate integration-style test can use a mock Supabase client to verify the Edge Function handler's per-table error branch: when `supabase.from(table).select(...)` returns `{ error: { message: 'permission denied' } }`, the handler returns HTTP 500 with an explicit error body.

**Patterns to follow:**
- `src/lib/compliance/__tests__/noticeAck.test.ts` — Vitest unit test pattern for compliance module
- `src/lib/sync/__tests__/syncEngine.test.ts` — mock Supabase client pattern

**Test scenarios:**
- Error path: Edge Function returns 500 with `{ error: 'RLS error on table X' }` → `callExportDataFunction` throws with message containing table name
- Error path: Edge Function returns 500 with `{ error: 'RLS error on table Y' }` → error message is explicit (not generic)
- Happy path: Edge Function returns 200 ZIP → `callExportDataFunction` resolves with blob
- Boundary: empty table (0 rows, no error) → resolves normally, table key present with `[]`

**Verification:**
- `npm run test:unit` passes all new scenarios
- Test output shows table name in error message

---

- [ ] **Unit 5: E2E test — data-export flow (AC-7)**

**Goal:** E2E test that a signed-in user can trigger the export, receive a ZIP, and verify `data.json` contains their own rows.

**Requirements:** R7 (AC-7)

**Dependencies:** Units 1, 3 (Edge Function + updated UI)

**Files:**
- Create: `tests/e2e/compliance/data-export.spec.ts`

**Approach:**
- Mock the `/functions/v1/export-data` endpoint via `page.route()` — return a minimal valid ZIP blob containing `data.json` with known row data for the mock user.
- Construct a minimal valid ZIP in the test using a small binary fixture or fflate in Node: `{ 'data.json': JSON.stringify({ notes: [{ id: 'note-1', userId: MOCK_USER_ID }] }), 'README.md': '...' }`.
- Seed mock auth session in localStorage/sessionStorage so the component renders in authenticated state.
- Navigate to `/settings`, find the GDPR export button (`data-testid="gdpr-export-button"`), click it.
- Intercept the download: use Playwright's `page.waitForEvent('download')` to capture the triggered download.
- Verify the downloaded file is a ZIP (Content-Disposition header or file extension `.zip`).
- Unzip in test using `fflate` (or Node `zlib`): parse `data.json`, assert it contains the mock user's row.
- Follow the mocking pattern from `notice-acknowledgement.spec.ts`: `page.route()` for Supabase endpoints, `page.clock` for deterministic dates.

**Patterns to follow:**
- `tests/e2e/compliance/notice-acknowledgement.spec.ts` — `page.route()` mocking, auth session seeding, MOCK_USER_ID pattern
- `tests/support/fixtures` — fixture and factory patterns
- Test rules: no `Date.now()`, no `waitForTimeout()`, use `expect().toBeVisible()` waits

**Test scenarios:**
- Happy path: authenticated user clicks "Export ZIP" → download is triggered → downloaded file has `.zip` extension → unzipped `data.json` contains mock user rows
- Happy path: success toast shown after download triggered
- Edge case: `too-large` mock response → no download triggered → informative toast shown
- Error path: Edge Function mock returns 500 → `toastError` shown, no download

**Verification:**
- `npx playwright test tests/e2e/compliance/data-export.spec.ts --project=chromium` passes
- No `waitForTimeout` calls, no `Date.now()` in test code

## System-Wide Impact

- **Interaction graph:** `MyDataSummary.tsx` gains a Supabase Edge Function dependency. The existing local `exportAllAsJson` call is replaced — any other callers (future CSV/Markdown export) are unaffected since the function remains exported.
- **Error propagation:** Edge Function errors surface as `toastError.saveFailed` in the UI. The `too-large` case surfaces as an informative toast (not an error). Network errors from `callExportDataFunction` bubble to the component's catch handler.
- **State lifecycle risks:** ZIP streaming is stateless on the server. Client-side: the existing `exporting` boolean guard prevents double-submission.
- **API surface parity:** No other components call `handleExport` — impact is contained to `MyDataSummary.tsx`.
- **Integration coverage:** E2E test (Unit 5) covers the full path: button click → Edge Function call → ZIP download → unzip → content assertion. Unit tests alone cannot prove the ZIP is valid or that the blob URL download works.
- **Unchanged invariants:** `exportAllAsJson` in `exportService.ts` is preserved. CSV export, Markdown export, and non-GDPR backup flows are unaffected. `CURRENT_SCHEMA_VERSION = 14` remains authoritative for the schema version constant.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| fflate streaming in Deno is untested in this codebase | Validate with a minimal Edge Function smoke test before full implementation; fall back to buffered ZIP if streaming is blocked by Deno constraints |
| Size probe (COUNT queries) may be slow for users with many rows | Probe runs sequentially per table; add a 10-second timeout on the probe phase. Alternatively, use a heuristic (row count × avg row size) rather than exact byte counts |
| 500 MB guard fires mid-stream if size probe is inaccurate | Implement probe before streaming starts (see Technical Design); if running total mid-stream exceeds threshold, close stream with an error frame rather than silently truncating |
| Edge Function CORS must allow the production app URL | Set `APP_URL` env var in Supabase dashboard for production deployment; local dev uses localhost:5173 fallback (same as `delete-account`) |
| Vault fields (`password`, `api_key`) must never appear in ZIP | Inline `VAULT_FIELDS` map in Edge Function is a hardcoded safety net; unit test asserts absence of these keys |
| `notificationPreferences` Dexie PK `'singleton'` vs Supabase `user_id` | Supabase RLS filters by `user_id` automatically; the row appears correctly. No special handling needed |

## Documentation / Operational Notes

- Deploy `supabase/functions/export-data` alongside other E119 functions in the same deployment batch.
- Set `APP_URL` env var in Supabase dashboard (already required by `delete-account`).
- The README.md inside the ZIP should include: `contactEmail: privacy@pedrolages.net` (or the configured contact email).
- The hardcoded table list in the Edge Function (`TABLE_NAMES`) must be kept in sync with `src/lib/sync/tableRegistry.ts`; add a comment cross-reference identical to the one in `hardDeleteUser.ts`.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-23-e119-s05-export-zip-requirements.md](../brainstorms/2026-04-23-e119-s05-export-zip-requirements.md)
- Related code: `src/lib/sync/tableRegistry.ts`, `supabase/functions/delete-account/index.ts`, `supabase/functions/_shared/hardDeleteUser.ts`
- Related plan: [docs/plans/2026-04-22-003-feat-e119-gdpr-full-compliance-plan.md](2026-04-22-003-feat-e119-gdpr-full-compliance-plan.md)
- fflate: https://github.com/101arrowz/fflate
