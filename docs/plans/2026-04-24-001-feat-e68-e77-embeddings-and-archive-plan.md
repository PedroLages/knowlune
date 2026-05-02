---
title: "E68 Embedding Hardening + E77A Export & Archive + E77B Google Drive Course Source"
type: feat
status: active
date: 2026-04-24
origin: docs/implementation-artifacts/sprint-status.yaml
---

## E68 Embedding Hardening + E77 (split: Archive + Drive Course Source)

## Overview

Three interrelated concerns, two backlog epics. Planning reveals E77 should be split into two distinct features:

- **E68 → gap-fill only**: ship the three user-facing gaps (download progress, Cache API resilience, OpenAI fallback with minimal provider seam) and the warm-up strategy. Defer the `@huggingface/transformers` v3 migration and the full `EmbeddingProvider` abstraction refactor.
- **E77A → "Export & Archive"**: disaster-recovery focused. Local `.knowlune.json` download + restore is the MVP. Google Drive becomes an optional *destination* for the backup JSON only, auth'd via Supabase's existing Google OAuth.
- **E77B → "Google Drive as Remote Course Source"**: the user's actual new intent — import course folders directly from Google Drive, stream files when online, cache to OPFS for offline. This fills the critical gap left by E92–E97: Supabase sync restores *metadata* across devices, but actual course files (videos, PDFs, EPUBs) don't travel with the user when away from their home LAN.

**E77A and E77B are independent.** E77A is small and should ship first. E77B is a medium-sized feature — conceptually identical to the Audiobookshelf source pattern (E101), with Google Drive as the transport layer instead of ABS's API.

Target: ship all as bounded additions that compose with existing infrastructure. No parallel systems, no refactor-for-refactor's-sake.

## Problem Frame

**E68 drift.** The 7 story specs (S01–S07) describe a greenfield `src/ai/embeddings/` abstraction layer that doesn't exist. The working code lives in `src/ai/workers/`, `src/ai/embeddingPipeline.ts`, `src/ai/vector-store.ts`, `src/lib/vectorSearch.ts`, `src/ai/courseEmbeddingService.ts`, and `src/ai/tutor/transcriptEmbedder.ts` — grown organically across E9, E57, E62. Real user-facing gaps are narrower: silent 23MB model download, no cloud fallback for weak devices, sluggish first-embed cold start.

**E77 framing collapse.** With E92–E97 shipped, Supabase sync handles cross-device metadata continuity for 30+ tables. But a critical gap remains: **actual course files don't sync**. A user who imports a video course on Device A, signs into Knowlune on Device B (or takes their laptop to a café), gets all their progress and notes — but can't play the videos. The course files live only in OPFS on Device A.

**Two separate E77 problems emerged from user intent:**

1. *Disaster recovery*: "What if my Supabase account is gone?" → E77A (local archive, Drive optional destination)
2. *Remote file access*: "I have my courses in Google Drive, I want to watch them anywhere" → E77B (Drive as course file source)

**Related E119 overlap (E77A).** E119-S05/S06 shipped GDPR Article 20 export. E77A reuses `exportService.ts` but keeps a separate "backup now" flow emphasizing restore, not compliance.

**ABS integration parallel (E77B).** E101–E102 (Audiobookshelf) established the pattern: remote library connection → library browse/sync → stream content → cache locally. E77B reuses this exact architecture, replacing the ABS HTTP API with Google Drive API v3 + OAuth. Key difference: Drive requires `drive.readonly` scope (user's existing files) or `drive.file` (app-created files only). For importing *user's existing Drive folders*, `drive.readonly` is required — which triggers Google's OAuth verification process if the app has >100 users. This is the highest-risk element of E77B and must be planned carefully.

## Requirements Trace

**E68 requirements:**
- R1. First-time users see download progress (visible % or indeterminate) when the 23MB embedding model initializes. No silent 30–60s waits.
- R2. Cache API corruption / partial downloads are detected and recovered without crashing the worker pool.
- R3. Users who configured an OpenAI key have a fallback when the on-device model can't load (low RAM, Cache API unavailable, ONNX backend failure).
- R4. Warm-up pre-loads the model after app-idle so the first real embedding request feels instant.
- R5. The worker crash path produces actionable telemetry (requestId, provider name, error class) — not opaque "worker died" logs.

**E77A — Export & Archive requirements:**
- R6. One-click "Download backup" produces a `.knowlune.json` file containing all syncable IndexedDB tables + localStorage settings, schema-versioned, restorable.
- R7. One-click "Restore from backup" reads a `.knowlune.json` file, runs schema migration if older, validates counts, commits atomically to IndexedDB, refreshes Zustand stores.
- R8. A pre-restore safety backup (auto-download) runs by default before any restore, with opt-out.
- R9. Optional "Send to Google Drive" pathway uses the existing Supabase auth session with `drive.file` scope — not a parallel GIS consent. Reuses `session.provider_token` + refresh flow.
- R10. The feature surfaces in Settings > Data & Backup (not a new top-level page).

**E77B — Google Drive Course Source requirements:**

- R11. User can connect Knowlune to their Google Drive account and browse course folders (video/PDF/EPUB collections) directly from the import wizard.
- R12. Importing a Drive course stores file references (Drive file IDs + metadata) in IndexedDB — not the files themselves on import. Files are fetched on demand.
- R13. When online, course content (video, PDF, EPUB) streams from Google Drive via authenticated range-requests. No full download required to start watching.
- R14. Files accessed at least once are cached in OPFS for offline playback. Cache is transparent — user just presses play.
- R15. Supabase sync (E94) propagates Drive-sourced course metadata (including Drive file IDs) to other devices, so the same stream-then-cache behaviour works on any signed-in device.
- R16. `drive.readonly` scope is requested only when user explicitly initiates Drive import — not at sign-in. Scope request is incremental (added to existing session via `signInWithOAuth` re-auth or Google prompt).
- R17. Premium gate: Drive course source is a premium feature (same guard as E35).

## Scope Boundaries

**In scope:**

- Gap-fill E68: download progress, Cache API validation, warm-up, OpenAI fallback with minimal provider interface
- E77A: local backup/restore (MVP) + optional Drive destination for the JSON bundle
- E77B: Drive course source — browse Drive folder, import course, stream + cache files, sync metadata via E94

**Explicit non-goals:**

- Migrate `@xenova/transformers` v2 → `@huggingface/transformers` v3 (breaking changes, WebGPU is a nice-to-have, beta stability priority)
- Refactor existing `src/ai/workers/` code into a new `src/ai/embeddings/` directory layout — the working code stays where it is; new code lives alongside it
- Selective/per-table backup (bundle is atomic — whole DB or nothing)
- Scheduled / periodic automatic Drive uploads for E77A (optional later iteration)
- Dropbox / OneDrive / S3 destinations
- Backup encryption-at-rest (user's Drive is already authenticated; user-side passphrase is a future iteration)
- xAPI / Notion / Readwise export (covered by E74/E75)

### Deferred to Separate Tasks

- **Transformers.js v3 migration**: Own epic post-beta. Blocking: breaking changes to `dtype` API, audio-pipeline quality regressions, WebGPU feature detection. Allocated as a Q3 2026 hardening epic.
- **Scheduled automatic Drive backups**: Requires Periodic Background Sync permission prompt UX + token refresh retry logic. Defer until manual flow validates demand.
- **Backup encryption passphrase**: Crypto UX is a standalone feature with recovery-word flow. Plan separately if users request.

## Context & Research

### Relevant Code and Patterns

**E68:**
- `src/ai/workers/embedding.worker.ts` — Transformers.js pipeline, lazy init, ONNX env config. Extend to emit progress events.
- `src/ai/workers/coordinator.ts` — 3-worker pool, requestId routing, idle termination. Add warm-up request type + provider-name in errors.
- `src/ai/workers/types.ts` — Message types. Extend with `ProgressMessage` and `WarmUpRequest`.
- `src/ai/embeddingPipeline.ts` — Consent-gated `indexNote/indexNotesBatch`. Integration point for fallback provider.
- `src/ai/vector-store.ts` — IndexedDB persistence singleton. No change expected.
- `src/lib/vectorSearch.ts` — Brute-force cosine. No change.
- `src/ai/tutor/transcriptEmbedder.ts` — Lazy transcript chunk embedding. Must also benefit from the warm-up and fallback.

**E77:**
- `src/lib/exportService.ts` — `exportAllAsJson()`, `KnowluneExport` interface, `CURRENT_SCHEMA_VERSION = 14`. Single source of truth for backup payload shape.
- `src/lib/importService.ts` — Already exists (found during audit). Confirm coverage for schema migrations, atomic Dexie transaction, post-migration validation.
- `src/lib/compliance/exportBundle.ts` — E119 GDPR export client (Edge Function). Reuse patterns (progress callback, zip streaming) where applicable but not the endpoint.
- `src/stores/useAuthStore.ts` (or equivalent) — Supabase session source; provides `session.provider_token`.
- `src/db/schema.ts` — Dexie schema v58, export schema v14. Restore logic must handle both version axes.

### Institutional Learnings

- `docs/solutions/` entries on Dexie v4 quirks (async upgrades can't read auth, `sortBy` returns Promise) apply to restore path — schema migration must happen inside a single transaction, not across awaits.
- `feedback_pr_merge_strategy.md`: Force-merge PRs post-creation, no CI wait. Test plan should validate locally before PR.
- `reference_supabase_unraid.md`: Self-hosted Supabase on Unraid. Drive OAuth config goes in that instance's dashboard — document the steps in the plan.
- `feedback_review_loop_max_rounds.md`: 3 review rounds max. Keep story scopes small to avoid blowing through that budget.

### External References

- **Google Identity Services + Supabase**: Supabase Google OAuth with `drive.file` additional scope returns `provider_token` + `provider_refresh_token` in session. Documented refresh via `supabase.auth.refreshSession()` or manual `provider_refresh_token` exchange.
- **Google Drive API v3**: `drive.file` scope (only files created by app) — no Google security review required. Multipart upload < 5MB, resumable upload ≥ 5MB.
- **Transformers.js v2.x (current)**: `@xenova/transformers` still works with `Xenova/all-MiniLM-L6-v2`, 384-dim, CPU/WASM. V3 migration deferred (see Deferred to Separate Tasks).
- **Cache API persistence**: Firefox private mode + Safari ITP can evict Cache API entries. Feature-detect and fail gracefully to OpenAI fallback.

## Key Technical Decisions

- **Do not create `src/ai/embeddings/` directory.** The original story specs assumed a greenfield abstraction; the working code lives in `src/ai/workers/` + `src/ai/*Service.ts`. Keep it. Add new files alongside, not in a parallel tree. Rationale: refactor has zero user value and high regression risk mid-beta.
- **Introduce only a minimal `EmbeddingProvider` interface at the point of fallback.** Two implementations: `LocalEmbeddingProvider` (wraps existing worker coordinator) and `OpenAIEmbeddingProvider` (new). No `FallbackProvider` class — `embeddingPipeline.ts` owns the "try local, fall back to OpenAI" logic directly. Rationale: one caller, one seam, no speculative abstraction.
- **Download progress via Transformers.js `progress_callback`.** The pipeline accepts a callback that fires with `{status, file, progress, loaded, total}`. Forward over `postMessage` to coordinator, which dispatches a `CustomEvent('embedding-model-download-progress')`. UI subscribes via a toast or inline banner. Rationale: uses library-native hook, not a reimplementation of fetch-with-progress.
- **Warm-up runs 3s after `window.load` + idle callback.** Skip if `navigator.deviceMemory < 4`. Silent failure — warm-up is a nice-to-have, not a correctness requirement.
- **E77 backup format = existing `KnowluneExport` JSON, unchanged.** `CURRENT_SCHEMA_VERSION = 14` is the portability contract. No new schema. Rationale: `exportService.ts` is battle-tested and used by GDPR Article 20.
- **Google Drive OAuth via Supabase `provider_token`.** At Supabase dashboard: add `https://www.googleapis.com/auth/drive.file` to Google provider additional scopes. Client requests it at sign-in via `scopes` option. Refresh via Supabase session refresh. Rationale: no parallel auth, no second consent, refresh tokens available.
- **Drive upload strategy: always multipart.** Backup JSON is typically 1–20MB; resumable is unnecessary complexity for this size range. Add resumable only if profiling shows >5MB common in practice.
- **Pre-restore safety backup: on by default, opt-out checkbox.** Safety backup is a local download, not a Drive upload — avoids double-upload failure modes.
- **Restore UI: file-picker only (local OR Drive).** No "browse my Drive backups" UI in MVP — user picks a file from Drive's own picker or from local disk. Rationale: Drive Picker API requires Picker token scope, extra consent, extra script tag. Not worth it for MVP.

## Open Questions

### Resolved During Planning

- **Is Supabase OAuth's `provider_token` sufficient for Drive uploads?** Yes. Supabase returns Google's access token as `session.provider_token` when the session was established with the Google provider. Refresh via `provider_refresh_token` or re-auth.
- **Do we need to support restoring from a backup taken with a newer schema?** No — reject with "This backup is from a newer version. Please update Knowlune and try again." (matches E77-S04 original plan).
- **Does the embedding pipeline need to block note-save when both providers fail?** No — existing behavior is fire-and-forget. Keep it. Semantic search gracefully degrades to keyword search; notes still save.
- **Does E77 share E119's export Edge Function?** No. E119 is compliance-shaped (audit trail, async queue, email delivery). E77 is instant user action. Different UX, different endpoint. Share code via `exportService.ts` only.

### Deferred to Implementation

- **Exact OpenAI model for fallback embeddings:** `text-embedding-3-small` with `dimensions: 384` is the spec-aligned choice, but confirm the API actually returns 384-dim via the `dimensions` parameter (documented but verify during S2 implementation).
- **Warm-up timing heuristic:** 3s delay is a starting point. Tune during S1 based on observed cold-start time on low-end devices.
- **Drive upload chunking threshold:** Multipart is fine for all current backup sizes. If a user report surfaces a >50MB backup, add resumable then.
- **Drive backup folder naming:** `Knowlune/backups/` vs just root. Decide during S5 based on picker UX.

## Implementation Units

### E68 track — embedding hardening (3 units)

- [ ] **E68-S01 (revised): Model download progress + warm-up strategy**

**Goal:** Surface model download progress in the UI and pre-warm the worker so first real embedding is instant.

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Modify: `src/ai/workers/embedding.worker.ts` — accept `progress_callback` in pipeline init, forward as `postMessage({type: 'progress', ...})`
- Modify: `src/ai/workers/coordinator.ts` — handle progress messages, dispatch `CustomEvent('embedding-model-download-progress')`; add `warmUp()` method that sends a no-op embed request
- Modify: `src/ai/workers/types.ts` — add `ProgressMessage`, `WarmUpRequest` types
- Modify: `src/ai/embeddingPipeline.ts` — expose `warmUp()` passthrough
- Create: `src/app/components/embeddings/EmbeddingModelProgressToast.tsx` — Sonner toast or inline banner subscribed to the custom event
- Modify: `src/app/App.tsx` (or layout) — mount the progress toast; trigger warm-up from a `requestIdleCallback` 3s after `window.load`, gated on `navigator.deviceMemory >= 4`
- Test: `src/ai/workers/__tests__/coordinator.test.ts` — progress event dispatch, warm-up no-op path
- Test: `src/app/components/embeddings/__tests__/EmbeddingModelProgressToast.test.tsx` — renders on event, hides on completion

**Approach:**
- Use Transformers.js `pipeline(task, model, { progress_callback })` hook. The library fires `{status: 'download'|'progress'|'done', file, loaded, total}`.
- Debounce progress events to ~500ms so toast doesn't thrash.
- Warm-up sends an embed request for the string `' '` (single space) — triggers model load without polluting vector store.

**Patterns to follow:**
- Event dispatch pattern already used for `worker-crash` and `vector-store-ready` in `src/ai/vector-store.ts`.
- Sonner toast pattern in existing `src/app/components/ui/sonner.tsx`.

**Test scenarios:**
- Happy path: First-use triggers progress toast with 0 → 100% updates, hides when done.
- Edge case: Low-memory device (`navigator.deviceMemory < 4`) skips warm-up — no pre-load fires.
- Edge case: Cache hit on second page load — no progress toast fires.
- Error path: Network offline during download — toast shows indefinite state, eventually error-styled "Semantic search unavailable"; does not crash the app.
- Integration: Warm-up completes before user types a note — first `indexNote()` call latency < 200ms (vs. 30s+ cold).

**Verification:**
- Manual: Clear Cache storage, reload, confirm toast renders with progress, confirm first note-save is fast.
- Unit tests cover progress-message routing and event dispatch.

---

- [ ] **E68-S02 (revised): Cache API validation + OpenAI fallback provider**

**Goal:** Detect Cache API failures (corruption, quota, unavailability) and route to an OpenAI embedding provider when configured.

**Requirements:** R2, R3, R5

**Dependencies:** E68-S01 (types + coordinator changes)

**Files:**
- Create: `src/ai/embeddings/EmbeddingProvider.ts` — minimal interface: `embed(texts: string[]): Promise<Float32Array[]>`, `isAvailable(): Promise<boolean>`, `name: string`
- Create: `src/ai/embeddings/localProvider.ts` — wraps existing `generateEmbeddings()` from `src/ai/workers/coordinator.ts`
- Create: `src/ai/embeddings/openaiProvider.ts` — calls `https://api.openai.com/v1/embeddings` with `text-embedding-3-small` + `dimensions: 384`, validates response, throws typed errors
- Modify: `src/ai/embeddingPipeline.ts` — inline try-local-then-openai fallback logic; no `FallbackProvider` class
- Modify: `src/ai/workers/coordinator.ts` — add Cache API self-check: on worker crash, probe `caches.has('transformers-cache')` and surface a "cacheUnavailable" flag via error
- Modify: `src/ai/workers/embedding.worker.ts` — try/catch around ONNX backend init, report `{reason: 'onnx-backend-failed'}` on failure
- Create: `src/ai/embeddings/__tests__/openaiProvider.test.ts`
- Create: `src/ai/embeddings/__tests__/localProvider.test.ts`
- Test: `src/ai/__tests__/embeddingPipeline.fallback.test.ts` — fallback order, typed error surface

**Approach:**
- `EmbeddingProvider` interface is *only* used at the pipeline seam. No factory, no registry. Two providers instantiated explicitly.
- OpenAI key source: existing `useSettingsStore` BYOK key. Provider's `isAvailable()` returns `!!key`.
- Fallback is per-request, not sticky. Rationale: user may configure OpenAI key after a previous failure; on-device may recover on next session.
- Errors surface with `provider` field so logs show `{ provider: 'openai', code: 'invalid_api_key' }` — actionable.

**Patterns to follow:**
- Existing consent-gate pattern in `src/ai/embeddingPipeline.ts` (E119-S08 guards).
- Existing BYOK key read pattern from `src/ai/lib/` LLM clients.

**Test scenarios:**
- Happy path: Local provider succeeds → OpenAI never called.
- Edge case: Local throws `ONNXBackendUnavailable` + OpenAI key present → OpenAI called, returns 384-dim vectors, pipeline completes.
- Edge case: Local throws + no OpenAI key → pipeline returns null (graceful), note saves without embedding, warning logged.
- Error path: OpenAI returns 401 → typed `InvalidApiKeyError`, surfaced to user via toast once (debounced), not on every request.
- Error path: OpenAI returns 429 → exponential backoff, max 3 retries, then fail to null.
- Error path: OpenAI returns embedding with wrong dimensions → dimension-mismatch error, do NOT write mismatched vectors into vector store.
- Integration: Note created → `embeddingPipeline.indexNote` called → local fails → OpenAI called → vector written to `vector-store.ts` → semantic search finds it.

**Verification:**
- Simulate Cache API failure via Safari private mode → OpenAI fallback kicks in.
- Unit tests cover all 6 branches above.

---

- [ ] **E68-S03 (revised): Worker crash telemetry + Safari module-worker fallback**

**Goal:** Crash paths produce actionable logs; Safari's lack of `type: 'module'` worker support doesn't break embeddings.

**Requirements:** R5

**Dependencies:** E68-S02 (provider field in errors)

**Files:**
- Modify: `src/ai/workers/coordinator.ts` — on worker crash, include `{requestId, provider: 'local', error: <class>, stack}` in the dispatched `CustomEvent('worker-crash')`; implement module-worker fallback: catch `SyntaxError` / `new Worker` failure and retry without `{type: 'module'}`
- Modify: `src/ai/vector-store.ts` — ensure `worker-crash` event subscribers don't double-dispatch on repeated crashes
- Create: `src/ai/embeddings/__tests__/crashTelemetry.test.ts` — assert event payload shape
- Modify: `src/app/App.tsx` (or telemetry module) — subscribe to `worker-crash` and log to Sentry / console with structured payload

**Approach:**
- No new UI. This is a telemetry + resilience pass.
- Safari fallback: try `new Worker(url, {type: 'module'})`. On TypeError, retry `new Worker(url)` with a compiled/bundled fallback script. Vite already emits a non-module build via `?worker` import.

**Patterns to follow:**
- Existing `worker-crash` event in `src/ai/workers/coordinator.ts`.

**Test scenarios:**
- Happy path: Worker crash event payload contains `requestId`, `provider`, `error.name`.
- Edge case: Rapid repeat crashes (same requestId) → dedupe, single event.
- Error path: Safari-style module worker failure → fallback succeeds, embedding request completes.
- Integration: Crash during active embed request → request rejects with typed error, caller falls back to OpenAI per S02.

**Verification:**
- Force-crash worker via injected throw; confirm telemetry payload.
- Manual check: load app in Safari Technology Preview with module-worker flag disabled.

---

### E77 track — Export & Archive (4 units)

- [ ] **E77-S01: Local backup download + restore in Settings**

**Goal:** Settings > Data & Backup panel with "Download backup" and "Restore from file" — the disaster-recovery MVP, no cloud.

**Requirements:** R6, R7, R10

**Dependencies:** None (reuses `src/lib/exportService.ts` and `src/lib/importService.ts`)

**Files:**
- Create: `src/app/components/settings/DataAndBackupPanel.tsx` — panel with two buttons + status rows (last backup date, current schema version)
- Create: `src/app/components/settings/RestoreConfirmationDialog.tsx` — confirm dialog with current data summary, safety-backup checkbox (default on), "This action cannot be undone" warning
- Modify: `src/app/pages/Settings.tsx` — mount `DataAndBackupPanel` under a new "Data & Backup" section
- Modify: `src/lib/exportService.ts` — add `exportAllAsBlob()` helper returning `{ blob, filename }` for direct download
- Modify: `src/lib/importService.ts` — verify atomic transaction, post-migration validation, return `ImportSummary { counts: Record<table, number>, schemaVersion: number }`
- Test: `src/app/components/settings/__tests__/DataAndBackupPanel.test.tsx`
- Test: `src/lib/__tests__/exportService.test.ts` — blob shape, filename format
- Test: `src/lib/__tests__/importService.test.ts` — migration path, rollback on partial failure

**Approach:**
- Filename: `knowlune-backup-YYYY-MM-DD-HHmmss.json` (sortable, matches existing E119 export naming where possible).
- Download uses `URL.createObjectURL(blob)` + anchor click trick — no library.
- Restore flow: pick file → parse JSON → show `RestoreConfirmationDialog` with preview counts → user confirms → create safety backup (if checkbox on) → run `importService` → refresh Zustand stores → success toast.
- Safety backup: always local download (not Drive). If user declines, warn inline.
- Restore uses the existing Dexie transaction + schema migration path in `importService.ts`. Do NOT duplicate migration logic.

**Patterns to follow:**
- Settings panel layout from `src/app/components/settings/` existing panels (E119 privacy panel, E90 model picker).
- Confirmation dialog pattern from `src/app/components/ui/alert-dialog.tsx`.
- Sonner toast for success / error per project conventions.

**Test scenarios:**
- Happy path: Click "Download backup" → `.knowlune.json` file downloads, filename matches pattern, schema version = 14.
- Happy path: Pick valid backup file → dialog shows correct counts → confirm → safety backup downloads first → restore succeeds → store counts match backup.
- Edge case: Backup file from newer schema version → reject with "Update Knowlune and try again" message; no data touched.
- Edge case: Backup file from older schema version → migration runs, post-validation passes, restore succeeds.
- Edge case: Corrupted JSON → parse error surfaced as "Backup file is invalid", no data touched.
- Error path: Restore transaction fails mid-write → Dexie rolls back atomically, Zustand reads stale-but-consistent data, safety backup remains on disk for user recovery.
- Integration: Restore a backup created on the same device 5 minutes earlier → all notes, flashcards, sessions, settings match exactly.

**Verification:**
- Full round-trip: create data → download → wipe IndexedDB → restore → verify all data present.
- Confirm safety backup exists in Downloads after restore.

---

- [ ] **E77-S02: Supabase Google OAuth scope upgrade for Drive access**

**Goal:** Configure Supabase Auth's Google provider to grant `drive.file` scope on sign-in; expose `provider_token` + refresh to the client.

**Requirements:** R9

**Dependencies:** None (infra change + client plumbing, no UI yet)

**Files:**
- Create: `docs/ops/supabase-google-drive-scope-setup.md` — runbook: Supabase dashboard → Auth → Providers → Google → Additional Scopes field → add `https://www.googleapis.com/auth/drive.file`. Include staging + production project IDs.
- Modify: `src/lib/supabase/auth.ts` (or wherever `signInWithOAuth` is called) — pass `{ scopes: 'email profile https://www.googleapis.com/auth/drive.file', queryParams: { access_type: 'offline', prompt: 'consent' } }`
- Create: `src/lib/googleDriveToken.ts` — helper that reads `session.provider_token` from `useAuthStore`, refreshes via `supabase.auth.refreshSession()` on 401, returns a valid token or `null` if user has never granted Drive scope
- Test: `src/lib/__tests__/googleDriveToken.test.ts` — token-fetch happy path, refresh-on-401 path, null when no session

**Approach:**
- `access_type=offline` + `prompt=consent` is required to receive a `provider_refresh_token` on first auth.
- Existing Knowlune users won't have Drive scope until they re-auth. Surface a "Reconnect Google to enable Drive backup" prompt in S03, not here.
- Token helper is the single place that knows about Drive auth. All Drive API callers go through it.

**Patterns to follow:**
- Existing `src/lib/supabase/` auth helpers.
- E19-S01 auth integration.

**Test scenarios:**
- Happy path: User signs in with Google, `session.provider_token` is present, token helper returns it.
- Edge case: User is an existing account without Drive scope → helper returns `null`, no exception.
- Error path: Provider token expired → helper calls `refreshSession()`, returns fresh token.
- Error path: Refresh fails (refresh token revoked) → helper returns `null`, caller shows "Reconnect Google" prompt.

**Verification:**
- Supabase dashboard shows `drive.file` in Google provider additional scopes (both projects).
- Manual test: fresh Google sign-in → `session.provider_token` populated.
- Runbook is complete enough for ops to re-apply after a Supabase project rebuild.

---

- [ ] **E77-S03: Drive upload destination + reconnect prompt**

**Goal:** "Send to Google Drive" button in Data & Backup panel uploads the current backup JSON; if user lacks Drive scope, show reconnect flow.

**Requirements:** R9, R10

**Dependencies:** E77-S01 (backup blob helper), E77-S02 (token helper)

**Files:**
- Create: `src/lib/googleDriveUpload.ts` — single function `uploadBackupToDrive(blob, filename): Promise<{fileId, webViewLink}>`. Multipart upload to `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`. Uses token helper from S02.
- Modify: `src/app/components/settings/DataAndBackupPanel.tsx` — add "Send to Drive" button; disabled state + "Reconnect Google" link when token helper returns null; progress indicator during upload
- Create: `src/app/components/settings/ReconnectGoogleDialog.tsx` — explains Drive scope needed, button triggers `signInWithOAuth` again
- Test: `src/lib/__tests__/googleDriveUpload.test.ts` — multipart body shape, error mapping (401, 403 quota, 403 permission)
- Test: `src/app/components/settings/__tests__/DataAndBackupPanel.drive.test.tsx` — reconnect state, upload happy path

**Approach:**
- Upload goes to Drive's `My Drive` root (no folder). User sees the file directly; avoids folder-lookup logic.
- `drive.file` scope limits visibility to app-created files — user can delete them freely in Drive UI.
- Response includes `webViewLink` — show in success toast: "Saved to Drive. View →"
- No post-upload verification read (integrity is Drive's job; validation was a scope item in original S03 but is low-value for atomic JSON).

**Patterns to follow:**
- `src/lib/supabase/storage.ts` upload pattern (signed URL + fetch body).
- Error-toast pattern from existing Settings panels.

**Test scenarios:**
- Happy path: User with Drive scope clicks "Send to Drive" → upload succeeds → toast shows "Saved to Drive. View →" with working link.
- Edge case: User without Drive scope → button is disabled, "Reconnect Google" link renders; click → `signInWithOAuth` flow completes → button becomes enabled.
- Error path: 401 mid-upload → token helper refreshes → retry once → success.
- Error path: 403 quota exceeded → typed `DriveQuotaError` → toast "Your Google Drive is full. Free up space and try again."
- Error path: 403 permission denied (scope revoked) → typed `DrivePermissionError` → "Reconnect Google" prompt.
- Error path: Network failure mid-upload → single retry with backoff → fail cleanly with "Upload failed. Try again?" toast; backup still exists as local download.

**Verification:**
- Manual: upload real backup, open file in Drive UI, confirm JSON opens correctly.
- Manual: revoke Drive scope in Google account settings → retry → confirm reconnect prompt.

---

- [ ] **E77-S04: Backup metadata tracking + last-backup status**

**Goal:** Track `lastBackupAt` (local or Drive) + `lastBackupDestination` in settings; surface in the Data & Backup panel so users know if they're at risk.

**Requirements:** R6, R10

**Dependencies:** E77-S01, E77-S03

**Files:**
- Modify: `src/stores/useSettingsStore.ts` — add `backupMeta: { lastLocalAt?: number, lastDriveAt?: number, lastDestination?: 'local' | 'drive' }`
- Modify: `src/app/components/settings/DataAndBackupPanel.tsx` — render "Last backup: 2 hours ago (Drive)" row; stale warning (red) if > 30 days; never-backed-up hint (amber) for users with data
- Modify: `src/lib/exportService.ts` and/or the panel — update meta on successful backup
- Test: `src/app/components/settings/__tests__/DataAndBackupPanel.meta.test.tsx`

**Approach:**
- Purely informational, no behavioral change. Lightweight unit.
- `backupMeta` is in existing settings store — will sync via E92 Supabase sync automatically (nice side effect: user knows their last-backup time across devices).
- Relative-time formatting uses existing `src/lib/time/` helpers or `date-fns`.

**Patterns to follow:**
- Existing settings store field patterns (E119 consent timestamps are the closest analog).

**Test scenarios:**
- Happy path: Local backup success → `lastLocalAt` updates → panel shows "just now (Local)".
- Happy path: Drive backup success → `lastDriveAt` + `lastDestination='drive'` update → panel shows "just now (Drive)".
- Edge case: Never backed up, user has ≥1 note → amber warning "You've never backed up your data".
- Edge case: Last backup > 30 days → red warning "Last backup was 45 days ago".
- Integration: Settings sync (E95) propagates `backupMeta` across devices.

**Verification:**
- Round-trip a backup on one device, sign in on another, confirm meta reflects correctly after sync.

---

### E77B track — Google Drive course source (4 units)

- [ ] **E77B-S01: Drive auth + `drive.readonly` scope + course folder browser**

**Goal:** Add `drive.readonly` scope to Supabase Google OAuth; build a Drive folder browser UI inside the import wizard so users can select a course folder from their Drive.

**Requirements:** R11, R16, R17

**Dependencies:** E77A-S02 (token helper, `src/lib/googleDriveToken.ts`) — extends it with `drive.readonly`

**Files:**

- Modify: `docs/ops/supabase-google-drive-scope-setup.md` — add `drive.readonly` scope steps alongside `drive.file` (note: triggers Google OAuth app verification if >100 users; document the verification process and timeline)
- Modify: `src/lib/googleDriveToken.ts` — extend to support both `drive.file` and `drive.readonly` scopes; `hasDriveReadScope(): boolean` check
- Create: `src/lib/googleDriveFileService.ts` — Drive API v3 wrapper: `listFolder(folderId)`, `getFileMetadata(fileId)`, `getFileMimeType(fileId)`, `buildStreamUrl(fileId)`. Detects video/PDF/EPUB by mimeType.
- Create: `src/app/components/import/DriveFolderBrowser.tsx` — folder picker: shows Drive root → user navigates into folders → selects a course folder → returns `{ folderId, folderName, files: DriveFile[] }`
- Modify: `src/app/components/import/ImportWizard.tsx` (or equivalent) — add "Import from Google Drive" entry point alongside existing local import; premium gate overlay (E35 pattern)
- Test: `src/lib/__tests__/googleDriveFileService.test.ts`
- Test: `src/app/components/import/__tests__/DriveFolderBrowser.test.tsx`

**Approach:**

- `drive.readonly` is requested incrementally via a second `signInWithOAuth` call scoped to Drive only — not bundled into the initial sign-in flow. This avoids permission-scope creep for users who never use Drive import.
- `listFolder` uses `q: "'${folderId}' in parents and trashed=false"`, `fields: 'files(id,name,mimeType,size,modifiedTime)'`, `pageSize: 100`.
- Browser shows only folders at top level, files when inside a folder — same mental model as the OS file picker.
- Supported mimeTypes for course files: `video/*`, `application/pdf`, `application/epub+zip`, `audio/*`.
- Premium gate: `assertPremium()` before any Drive API call (E35 pattern).

**Patterns to follow:**

- Local import wizard flow in `src/app/components/import/` (E24 patterns).
- E35 premium gate overlay.
- ABS library browsing (`src/app/components/audiobookshelf/`) for remote-source UX patterns.

**Test scenarios:**

- Happy path: User with `drive.readonly` scope opens browser → sees their Drive root → navigates into a course folder → folder contents list video + PDF files.
- Edge case: User without `drive.readonly` → browser shows "Connect Google Drive" CTA, no API calls fired.
- Edge case: Empty folder selected → import wizard warns "No supported files found in this folder".
- Edge case: Folder with >100 files → pagination loads all via `nextPageToken`.
- Error path: Drive API 403 (quota) during listing → error toast, browser stays open.
- Integration: Premium gate blocks free users before any API call.

**Verification:**

- Manual: Navigate Drive folder hierarchy, select a course folder with mixed files, confirm file list is correct.
- Manual: Free-tier user hits premium gate correctly.

---

- [ ] **E77B-S02: Drive course import — metadata storage + Dexie schema extension**

**Goal:** When user confirms a Drive folder as a course, store the course metadata + Drive file references in IndexedDB. No file download at import time.

**Requirements:** R12, R15

**Dependencies:** E77B-S01 (file list from Drive browser)

**Files:**

- Modify: `src/db/schema.ts` — add `driveFileRef?: { fileId: string, driveSource: 'google' }` field to the `Video` / `Lesson` types (or equivalent); add a new optional `sourceDriveId` field to `Course`. Increment schema version.
- Create: `src/db/migrations/v59-drive-source.ts` — migration: add nullable `driveSource` fields, backfill existing records with `null`.
- Modify: `src/lib/courseImport.ts` (or equivalent) — add `importCourseFromDrive(folderId, folderName, files: DriveFile[])` — creates Course + Lesson records with Drive file refs, no OPFS write.
- Modify: `src/stores/useCourseStore.ts` (or equivalent) — ensure Drive-sourced courses render correctly in library (same card UI, different source badge).
- Test: `src/db/migrations/__tests__/v59-drive-source.test.ts`
- Test: `src/lib/__tests__/courseImport.drive.test.ts`

**Approach:**

- Drive-sourced courses are first-class courses in Knowlune — same data model, same UX. Only the file-access path differs (Drive stream vs. OPFS).
- `driveSource: 'google'` is stored per file/lesson so future sources (Dropbox, OneDrive) can share the same field without schema change.
- E94 Supabase sync already syncs course metadata — `driveFileRef` fields travel to other devices automatically, enabling R15 with no extra sync work.
- Schema migration is additive (nullable fields only) — safe for existing users.

**Patterns to follow:**

- Existing course import in `src/lib/courseImport.ts` (E1, E24 patterns).
- Dexie migration pattern from `src/db/migrations/` (checkpoint v58 established in E32).

**Test scenarios:**

- Happy path: `importCourseFromDrive` with 3 video files → Course record + 3 Lesson records with `driveSource` set; no OPFS files created.
- Edge case: Import same Drive folder twice → deduplication by `sourceDriveId` (no duplicate course).
- Edge case: Migration v59 on existing DB → all existing records get `driveSource: null`; no data loss.
- Integration: Drive-imported course appears in library grid alongside local courses; source badge ("Drive") distinguishes it.

**Verification:**

- `importCourseFromDrive` + `listCourses` → Drive course present, OPFS file count unchanged.
- Migration test: upgrade from v58 → v59 on seeded DB, all rows intact.

---

- [ ] **E77B-S03: Drive file streaming + OPFS caching layer**

**Goal:** When user plays a Drive-sourced lesson, stream the file from Google Drive via an authenticated URL; cache to OPFS on first play so subsequent plays are offline.

**Requirements:** R13, R14

**Dependencies:** E77B-S02 (Drive file refs in DB), E77B-S01 (token helper)

**Files:**

- Create: `src/lib/driveFileAccessService.ts` — `resolveFileUrl(lesson): Promise<string>`. If OPFS cache hit → return `opfs://` blob URL. If miss + online → fetch Drive download URL (`https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`), stream to OPFS, return URL. If miss + offline → throw `DriveFileOfflineError`.
- Modify: `src/app/components/player/UnifiedLessonPlayer.tsx` (or video player hook) — before setting video `src`, call `resolveFileUrl`. For Drive-sourced lessons, swap local file resolution for this service.
- Create: `src/lib/__tests__/driveFileAccessService.test.ts` — cache hit, cache miss+stream, offline error
- Modify: `src/app/components/player/` — show "Downloading for offline…" progress indicator during first-play caching; show "Offline — connect to access" state for uncached Drive files.

**Approach:**

- Range-request streaming: Drive supports `Range` headers. Pass them through so the video element's native seeking works without downloading the full file first.
- OPFS cache key: `drive-{fileId}` — simple, collision-free.
- Cache write is a background operation that races with playback: start streaming immediately, write to OPFS simultaneously. If caching fails (OPFS quota), log warning but don't interrupt playback.
- `resolveFileUrl` is the single seam between players and file source. Local courses return OPFS paths today; Drive courses return Drive-streamed or OPFS-cached paths via this service. Future sources plug in here.
- Token refresh on 401 mid-stream: abort current request, refresh token, re-request from current byte offset.

**Patterns to follow:**

- ABS streaming in `src/app/components/audiobookshelf/` (E101-S04 streaming playback).
- OPFS write pattern from `src/services/opfsStorageService.ts` (E83-S01).

**Test scenarios:**

- Happy path (cache miss, online): `resolveFileUrl` called for uncached Drive lesson → Drive URL fetched with auth header → OPFS write begins → URL returned → player starts streaming immediately.
- Happy path (cache hit): Second play of same lesson → OPFS blob URL returned immediately, no Drive API call.
- Edge case: Video seeks mid-stream → Range header forwarded correctly → seek completes without re-downloading from byte 0.
- Edge case: OPFS quota exceeded during cache write → warning logged, playback continues from Drive stream.
- Error path: Offline + uncached → `DriveFileOfflineError` → player shows "Connect to access this lesson" state (not a crash).
- Error path: 401 mid-stream → token refresh → stream resumes from current offset.
- Integration: Local course `resolveFileUrl` returns OPFS path unchanged — Drive logic is unreachable for local courses.

**Verification:**

- Manual: Import Drive course, play video → streams. Close browser. Reopen offline → plays from OPFS cache.
- Manual: Airplane mode before first play → offline error state shown.

---

- [ ] **E77B-S04: Drive source management UI + sync validation**

**Goal:** Surface Drive-sourced courses in the library with a source badge; allow re-linking if Drive file IDs change; validate that E94 sync correctly propagates Drive refs to a second device.

**Requirements:** R15, R17

**Dependencies:** E77B-S02, E77B-S03

**Files:**

- Modify: `src/app/components/courses/CourseCard.tsx` — show "Drive" source badge for `driveSource: 'google'` courses (distinct from local / YouTube / ABS badges).
- Modify: `src/app/components/courses/CourseDetailPage.tsx` (unified) — "Reconnect Drive folder" action if Drive file IDs return 404 (folder moved/deleted); triggers re-browse via `DriveFolderBrowser`.
- Create: `src/app/components/courses/__tests__/CourseCard.driveSource.test.tsx`
- Modify: `src/app/pages/Settings.tsx` — "Google Drive" section: connected account display, `drive.readonly` scope status, disconnect action (revokes scope, marks Drive courses as "files unavailable").

**Approach:**

- "Reconnect Drive folder" maps new file IDs to existing Lesson records by filename match — preserves all notes, bookmarks, progress.
- Disconnect from Drive does NOT delete courses or metadata — it marks lessons as `driveSource: 'disconnected'` so user knows files are inaccessible but data is safe.
- Sync validation: write an E2E test that imports a Drive course on a simulated "Device A" (seeded DB), runs E94 sync upload, seeds "Device B" with the synced metadata, confirms Drive course appears with correct file refs.

**Patterns to follow:**

- Source badge pattern (YouTube badge in E28, ABS badge in E101).
- ABS reconnect pattern (`src/app/components/audiobookshelf/ServerConnectionSettings.tsx`).

**Test scenarios:**

- Happy path: Drive course in library shows "Drive" badge; local course shows no badge (unchanged).
- Edge case: Drive file IDs return 404 → "Reconnect" prompt shown on course card; user re-browses → new IDs stored → existing progress preserved.
- Edge case: User disconnects Drive → Drive lessons show "Files unavailable" state; notes/progress still readable.
- Integration (E94 sync): Drive course metadata (including `driveFileRef`) syncs to second device → second device can play the same file via Drive stream (different device, same Drive account).

**Verification:**

- Library renders Drive badge correctly.
- Sync round-trip: seeded Device A → sync → Device B shows Drive course with correct file refs.

## System-Wide Impact

- **Interaction graph:**
  - **E68**: New providers plug into `embeddingPipeline.ts`, which is called from `useNotesStore`, `transcriptEmbedder`, `courseEmbeddingService`, and tutor flows. All benefit automatically.
  - **E77**: Reuses `exportService.ts` (used by E119 GDPR export, E11 data export). Any schema change there ripples — but this plan doesn't change the schema.

- **Error propagation:**
  - **E68**: Embedding failures are already non-blocking. OpenAI errors must surface *once* (debounced toast), not on every note save. Crash telemetry goes to Sentry/console.
  - **E77**: Restore failures must never leave IndexedDB in a half-migrated state — enforced by the existing `importService.ts` atomic transaction. Drive errors never affect local backup availability.

- **State lifecycle risks:**
  - **E77 restore** wipes live Zustand state mid-transaction. Mitigation: run restore only from Settings (no background state to preserve), force full-page reload after successful restore, never partial-apply on failure.
  - **E68 warm-up** races with a user's first real embed request. Mitigation: warm-up uses the same requestId lane; the coordinator's existing queue serializes them.

- **API surface parity:**
  - **E68 OpenAI provider** must produce vectors indistinguishable from local (same 384 dims, same distance metric) — otherwise vector store mixes embeddings from different spaces and search degrades. Strict dimension validation enforces this; model choice (`text-embedding-3-small` with `dimensions: 384`) is spec-aligned but verify.

- **Integration coverage:**
  - **E77**: Full round-trip test (create data → backup → wipe → restore → verify) is the only test that catches drift between `exportService` and `importService`.
  - **E68**: Fallback integration test (local fails → OpenAI succeeds → vector store contains valid entry → semantic search returns it) is the only test that proves the seam works end-to-end.

- **Unchanged invariants:**
  - Vector store schema unchanged (384 dims, noteId PK).
  - Export schema version unchanged (v14). Restore handles older versions via existing migration chain.
  - Existing consent gates (E119-S08) stay in place — neither plan bypasses them.
  - Existing worker pool lifecycle (3 workers, 60s idle termination) unchanged.

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| **E77B** `drive.readonly` scope triggers Google OAuth app verification (required if >100 users) | High — Knowlune is post-beta with real users | High — blocks Drive import feature for all users until verified | Start verification process immediately on E77B-S01 completion. Verification takes 4–6 weeks. Gate the feature behind a feature flag; ship to beta testers (<100 users) while verification is pending. |
| **E77B** Drive file streaming adds CORS complexity — Drive API returns `Content-Type` without CORS headers for media | Medium | High — video element can't load Drive URL directly | Use a Supabase Edge Function as a thin authenticated proxy for media streams (already have the proxy pattern from E35). Adds latency but solves CORS cleanly. |
| **E68** OpenAI `dimensions: 384` parameter doesn't return 384-dim vectors | Low | High — dimension mismatch corrupts vector store | Dimension validation in provider throws before writing; unit test covers. Fall back to truncation + one-time re-embed migration if needed. |
| **E77A** Restore wipes user data on schema mismatch bug | Low | Critical — irreversible data loss | Safety backup default-on + confirmation dialog + `importService.ts` atomic Dexie transaction + round-trip integration test. Highest-risk path. |
| **E77B** Drive folder moved/renamed after import breaks file refs | Medium | Medium — lesson unplayable until reconnected | "Reconnect Drive folder" flow in E77B-S04 maps new IDs by filename match; user experience is graceful degradation not silent failure. |
| **E68** Cache API evicted mid-session (Safari ITP, Firefox private) | Medium | Low — semantic search degrades to keyword | OpenAI fallback from E68-S02 covers continuity. Telemetry from E68-S03 surfaces real-world frequency. |
| **E68** Transformers.js v2 unmaintained during beta | Low | Low — existing code still runs | Accepted. v3 migration is a deferred post-beta epic. |
| **E77A/B** Supabase `provider_token` rotation timing underdocumented | Medium | Medium — Drive calls fail silently | Token helper retries refresh on 401 once before surfacing error; runbook documents observed cadence after beta testing. |

## Documentation / Operational Notes

- **Supabase ops runbook** (`docs/ops/supabase-google-drive-scope-setup.md`) is a deliverable of E77-S02. Required for staging + production project config.
- **Known issues tracking:** If OpenAI fallback surfaces any truncation/dimension quirks, log to `docs/known-issues.yaml`.
- **User-facing docs:** Help article for "How backups work" — local vs Drive, safety backup, schema compat. Single page, linked from Data & Backup panel.
- **Post-beta decision:** After 4 weeks of E68-S02 telemetry, decide whether on-device failures justify a v3 migration epic.

## Sources & References

- **Sprint status (current epic definitions):** `docs/implementation-artifacts/sprint-status.yaml`
- **Supabase sync design (context for why E77 is reframed):** `docs/plans/2026-03-31-supabase-data-sync-design.md`
- **E119 export pattern (reuse inspiration):** `src/lib/compliance/exportBundle.ts`
- **Existing E68 code:** `src/ai/workers/`, `src/ai/embeddingPipeline.ts`, `src/ai/vector-store.ts`, `src/lib/vectorSearch.ts`
- **Existing E77 foundations:** `src/lib/exportService.ts`, `src/lib/importService.ts`
- **External:** Transformers.js v2 docs (still in use), Supabase Google OAuth provider scopes docs, Google Drive API v3 multipart upload docs
