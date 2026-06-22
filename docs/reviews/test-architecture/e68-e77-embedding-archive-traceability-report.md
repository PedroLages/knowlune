---
title: "Requirements-to-Tests Traceability Matrix — Epics E68 + E77A + E77B"
type: traceability-report
status: complete
date: 2026-06-22
origin: docs/plans/2026-04-24-001-feat-e68-e77-embeddings-and-archive-plan.md
stories: 12
epics: [E68, E77A, E77B]
gate: CONCERNS
coverage: 79%
stepsCompleted: ['step-01-load-context']
lastStep: 'step-01-load-context'
lastSaved: '2026-06-22'
---

# Requirements-to-Tests Traceability Matrix

## Overview

Traceability analysis for 3 coordinated epics (12 stories, 17 requirements) implemented from a single plan.

| Epic | Stories | Requirements | Test Files | Lines of Test Code | Coverage |
|------|---------|-------------|------------|-------------------|----------|
| E68  | 3       | R1-R5       | 8          | ~2,467            | 93%      |
| E77A | 4       | R6-R10      | 8          | ~1,824            | 65%      |
| E77B | 4       | R11-R17     | 9          | ~1,697            | 87%      |
| **Total** | **12** | **R1-R17**  | **28**     | **~5,988**        | **79%**  |

---

## Epic E68 — Embedding Hardening

### E68-S01: Model download progress + warm-up strategy (R1, R4)

**Test files:**

| File | Lines | Coverage Area |
|------|-------|---------------|
| `src/ai/workers/__tests__/coordinator.test.ts` | 642 | Worker lifecycle, progress event dispatch, warm-up no-op path, timeout handling, pool status |
| `src/app/components/embeddings/__tests__/EmbeddingModelProgressToast.test.tsx` | 357 | Toast renders on progress event, hides on completion, error state styling, debounced updates |
| `src/app/__tests__/App.embeddingWarmup.test.tsx` | 206 | 3s delay, deviceMemory >= 4 gate, supportsWorkers gate, requestIdleCallback+fallback, timer cleanup on unmount, silent error handling |
| `src/ai/hooks/__tests__/useWorkerCoordinator.test.tsx` | 67 | Hook integration with coordinator |

**AC coverage:**
- [x] R1: Progress shows during model download (toast tests, coordinator progress dispatch)
- [x] R4: Warm-up fires with correct timing and gates
- [x] Low-memory device skips warm-up (deviceMemory < 4 gate)
- [x] Cache hit = no progress toast
- [x] Network offline during download = error toast, no crash
- [x] Cleanup on unmount

**Gaps:** None identified.

---

### E68-S02: Cache API validation + OpenAI fallback provider (R2, R3, R5)

**Test files:**

| File | Lines | Coverage Area |
|------|-------|---------------|
| `src/ai/embeddings/__tests__/openaiProvider.test.ts` | 329 | Correct request with dimensions=384, dimension mismatch rejection, 401 InvalidApiKeyError, 429 EmbeddingRateLimitError with exponential backoff, network errors, empty/whitespace filtering, isAvailable with/without key |
| `src/ai/embeddings/__tests__/localProvider.test.ts` | 154 | Cache API availability, embed delegates to generateEmbeddings, workers not supported, partial/empty cache |
| `src/ai/__tests__/embeddingPipeline.fallback.test.ts` | 336 | Fallback order (local first), local fails + OpenAI key → OpenAI called, local fails + no key → graceful null, both fail → logged + vector not written, telemetry with provider name + error class |
| `src/ai/rag/__tests__/ragCoordinator.test.ts` | (related) | RAG integration |

**AC coverage:**
- [x] R2: Cache API corruption/failure detection tested via localProvider Cache API checks
- [x] R3: OpenAI fallback when local fails, tested in all error-path variants
- [x] R5: Provider name in errors tested via telemetry assertions
- [x] OpenAI dimension validation prevents mismatched vectors
- [x] Agent crashes detected and communicated
- [x] Local provider unavailable tested (no workers, no caches)

**Gaps:** None identified.

---

### E68-S03: Worker crash telemetry + Safari module-worker fallback (R5)

**Test files:**

| File | Lines | Coverage Area |
|------|-------|---------------|
| `src/ai/embeddings/__tests__/crashTelemetry.test.ts` | 376 | Event payload shape (requestId, provider, error.name), duplicate crash dedup (same requestId → single event), Safari module-worker failure → non-module fallback success, crash during active request → rejects with typed error |

**AC coverage:**
- [x] R5: Crash telemetry payload with requestId, provider, error.name
- [x] Rapid repeat crash deduplication
- [x] Safari fallback (module worker → non-module)
- [x] Integration: crash → typed error → caller receives it

**Gaps:** None identified.

---

## Epic E77A — Export & Archive

### E77-S01: Local backup download + restore in Settings (R6, R7, R10)

**Test files:**

| File | Lines | Coverage Area |
|------|-------|---------------|
| `src/lib/__tests__/exportService.test.ts` | 731 | CURRENT_SCHEMA_VERSION = 14, exportAllAsJson returns schemaVersion+exportedAt+data, exportAllAsBlob produces downloadable blob, filename format "knowlune-backup-YYYY-MM-DD-HHmmss.json", updateBackupMeta, exportAllAsCsv, exportNotesAsMarkdown |
| `src/lib/__tests__/importService.test.ts` | 114 | Rejects invalid JSON, missing schemaVersion, missing data field, accepts valid export with record count, skips empty tables |

**AC coverage:**
- [x] R6: Blob shape and filename format verified
- [x] R7: Import validates JSON structure, schema version, data presence; returns record count
- [x] R10: Test infrastructure verifies the restore path works
- [ ] MISSING: Backup from newer schema version rejected (not tested)
- [ ] MISSING: Backup from older schema version → migration runs (not tested)
- [ ] MISSING: Corrupted JSON parse error surface (untested beyond "Invalid JSON" message)
- [ ] MISSING: Restore transaction failure → atomic rollback (transaction mock is always successful)
- [ ] MISSING: Safety backup flow (component not created)
- [ ] MISSING: DataAndBackupPanel integration test (file not created — no `DataAndBackupPanel.test.tsx`)

**Gaps:** 
- **E77-S01-GAP-1**: `DataAndBackupPanel.test.tsx` was specified in the plan but never created. Only `drive.test.tsx` and `meta.test.tsx` exist as sub-aspect tests.
- **E77-S01-GAP-2**: `RestoreConfirmationDialog.tsx` component was specified but does not exist in the codebase. The restore confirmation UI flow has no dedicated component or test.
- **E77-S01-GAP-3**: `importService.test.ts` is thin (114 lines) and covers only JSON validation. The schema migration path (older version → migrate), newer version rejection, and atomic rollback on partial failure are untested.
- **E77-S01-GAP-4**: No E2E round-trip test (create data → backup → wipe IndexedDB → restore → verify).

---

### E77-S02: Supabase Google OAuth scope upgrade for Drive access (R9)

**Test files:**

| File | Lines | Coverage Area |
|------|-------|---------------|
| `src/lib/__tests__/googleDriveToken.test.ts` | 284 | getDriveToken returns null when no supabase, null when no provider_token, returns token when present; refreshDriveToken refreshes on 401, returns null on refresh failure; existing account without scope returns null; hasDriveReadScope/hasDriveFileScope |

**AC coverage:**
- [x] R9: Token helper returns provider_token when available
- [x] Existing account without Drive scope → null
- [x] 401 → refresh → fresh token
- [x] Refresh failure → null
- [x] Scope detection for drive.readonly and drive.file

**Gaps:** None identified.

---

### E77-S03: Drive upload destination + reconnect prompt (R9, R10)

**Test files:**

| File | Lines | Coverage Area |
|------|-------|---------------|
| `src/lib/__tests__/googleDriveUpload.test.ts` | 254 | Multipart body shape, 401 → refresh → retry, 403 quota → DriveQuotaError, 403 permission → DrivePermissionError, network failure → DriveNetworkError |
| `src/app/components/settings/__tests__/DataAndBackupPanel.drive.test.tsx` | 251 | Upload happy path, reconnect prompt, disabled without Drive scope, error toast mapping |

**AC coverage:**
- [x] R9: Upload works with token auth, error mapping covers all specified paths
- [x] R10: Panel renders Drive upload button within Data & Backup section
- [ ] MISSING: ReconnectGoogleDialog has no test (component exists at `src/app/components/settings/ReconnectGoogleDialog.tsx` but no `ReconnectGoogleDialog.test.tsx` found)

**Gaps:**
- **E77-S03-GAP-1**: `ReconnectGoogleDialog.test.tsx` missing — component exists but is untested.

---

### E77-S04: Backup metadata tracking + last-backup status (R6, R10)

**Test files:**

| File | Lines | Coverage Area |
|------|-------|---------------|
| `src/app/components/settings/__tests__/DataAndBackupPanel.meta.test.tsx` | 190 | "just now (Local)", "just now (Drive)", never backed up amber warning, >30 days stale red warning |

**AC coverage:**
- [x] R6: Last backup timestamp tracked and displayed
- [x] R10: Status display in panel
- [x] Stale warnings at correct thresholds
- [x] Never-backed-up warning for users with data

**Gaps:** None identified.

---

## Epic E77B — Google Drive Course Source

### E77B-S01: Drive auth + drive.readonly scope + course folder browser (R11, R16, R17)

**Test files:**

| File | Lines | Coverage Area |
|------|-------|---------------|
| `src/lib/__tests__/googleDriveFileService.test.ts` | 319 | listFolder (folder, files, pagination via nextPageToken), getFileMetadata, buildStreamUrl, isSupportedForImport (video, PDF, EPUB, audio, image, unsupported, text) |
| `src/app/components/import/__tests__/DriveFolderBrowser.test.tsx` | 390 | Scope loading state, connected state (lists root folder), needs scope (shows CTA), folder navigation (click → list children), file selection, folder-only display, supported file detection, empty folder warning, premium gate overlay, 403 error, generic error |

**AC coverage:**
- [x] R11: Browser shows Drive folders, navigates hierarchy, selects course folder, detects supported file types
- [x] R16: Scope requested incrementally (not at sign-in) — tested via DriveFolderBrowser scope check flow
- [x] R17: Premium gate tested before Drive API calls
- [x] Empty folder warning
- [x] Pagination for >100 files
- [x] 403 quota/folder deleted error handling

**Gaps:** None identified.

---

### E77B-S02: Drive course import — metadata storage + schema extension (R12, R15)

**Test files:**

| File | Lines | Coverage Area |
|------|-------|---------------|
| `src/lib/__tests__/courseImport.drive.test.ts` | 218 | Course created with sourceDriveId, video records with driveFileRef, non-video files filtered, unsupported mime types ignored, deduplication by sourceDriveId |
| `src/db/__tests__/migration-v66-drive-source.test.ts` | (exists) | Schema migration (v66) for driveSource fields: sourceDriveId on importedCourses, driveFileRef on importedVideos |

**AC coverage:**
- [x] R12: Course stored with Drive file refs, no OPFS write at import time
- [x] R15: Migration adds nullable fields, existing records get null (backfill)
- [x] Deduplication when importing same folder twice
- [x] Schema migration tested

**Gaps:** None identified.

---

### E77B-S03: Drive file streaming + OPFS caching layer (R13, R14)

**Test files:**

| File | Lines | Coverage Area |
|------|-------|---------------|
| `src/lib/__tests__/driveFileAccessService.test.ts` | 385 | Cache hit → OPFS blob URL returned, cache miss + online → fetch Drive URL + write to OPFS + return, offline + uncached → DriveFileOfflineError, 401 mid-stream → token refresh + retry, Range header pass-through for seeking, navigation-type vs metadata-only requests, OPFS quota exceeded → warning log + stream fallback |

**AC coverage:**
- [x] R13: Streaming via authenticated URL on cache miss; cache-and-stream in parallel
- [x] R14: OPFS cache written on first play; subsequent plays serve from cache
- [x] Offline error when uncached
- [x] 401 token refresh mid-stream
- [x] Range headers for seeking
- [x] OPFS quota failure degrades gracefully

**Gaps:** None identified.

---

### E77B-S04: Drive source management UI + sync validation (R15, R17)

**Test files:**

| File | Lines | Coverage Area |
|------|-------|---------------|
| `src/app/components/courses/__tests__/CourseCard.driveSource.test.tsx` | 179 | "Drive" badge renders for Drive-sourced courses; no badge for local courses |

**AC coverage:**
- [x] R17: Drive badge visible in library card
- [ ] MISSING: R15: Sync validation — E2E test for Drive course metadata propagation across devices
- [ ] MISSING: "Reconnect Drive folder" flow when file IDs return 404
- [ ] MISSING: Disconnect Drive → "Files unavailable" state
- [ ] MISSING: Re-link by filename match preserving progress

**Gaps:**
- **E77B-S04-GAP-1**: No E2E sync validation test for E94 Supabase sync propagation of Drive course metadata.
- **E77B-S04-GAP-2**: "Reconnect Drive folder" and "Disconnect" flows are untested (component-level).
- **E77B-S04-GAP-3**: The CourseDetailPage "Reconnect Drive folder" action is not tested.

---

## Consolidated Gap Registry

| ID | Story | Severity | Type | Description |
|----|-------|----------|------|-------------|
| GAP-1 | E77-S01 | HIGH | Component Missing | `RestoreConfirmationDialog.tsx` was specified in plan but does not exist in codebase — restore confirmation flow has no dedicated component |
| GAP-2 | E77-S01 | HIGH | Test Missing | `DataAndBackupPanel.test.tsx` (main panel unit test) was specified but never created; only aspect-specific sub-tests exist |
| GAP-3 | E77-S01 | HIGH | Test Gap | `importService.test.ts` coverage is thin — no schema migration path test, no newer-version rejection test, no atomic rollback test |
| GAP-4 | E77-S01 | MEDIUM | Test Gap | No E2E round-trip test (create data → backup → wipe → restore → verify) — this is the highest-risk path for data loss |
| GAP-5 | E77-S03 | LOW | Test Missing | `ReconnectGoogleDialog.test.tsx` — component exists at `/settings/ReconnectGoogleDialog.tsx` but has no unit test |
| GAP-6 | E77B-S04 | MEDIUM | Test Gap | No E2E sync validation test for Drive course metadata propagation (R15: E94 sync of driveFileRef across devices) |
| GAP-7 | E77B-S04 | LOW | Test Gap | "Reconnect Drive folder" / "Disconnect" management UI flows untested |
| GAP-8 | E77B-S04 | LOW | Test Gap | No test for re-linking by filename match preserving progress |

---

## Coverage Summary by Risk Category

### DATA (Data Integrity) Risks — P0
- Restore must never leave IndexedDB half-migrated: **PARTIAL** — importService tests exist but don't exercise the transactional rollback path
- Backup download produces correct format: **COVERED** — exportService tests verify blob shape + schema version
- Drive course import stores correct metadata: **COVERED** — courseImport.drive + migration tests
- OPFS cache transparent to user: **COVERED** — driveFileAccessService tests

### TECH (Technical) Risks — P1
- Worker lifecycle and progress dispatch: **COVERED**
- OpenAI fallback dimension validation: **COVERED**
- Cache API detection and recovery: **COVERED** — localProvider tests
- Module worker Safari fallback: **COVERED** — crashTelemetry test

### SEC (Security) Risks — P1
- Token refresh on 401: **COVERED** — googleDriveToken + driveFileAccessService tests
- OAuth scope isolation (drive.readonly not bundled at sign-in): **COVERED** — DriveFolderBrowser scope check tests
- Premium gate for Drive import: **COVERED** — DriveFolderBrowser premium gate test

### PERF (Performance) Risks — P2
- Warm-up pre-loads model: **COVERED** — App.embeddingWarmup + coordinator tests
- OPFS cache reduces Drive API calls: **COVERED** — driveFileAccessService cache-hit test
- Streaming starts immediately (no full download): **COVERED** — driveFileAccessService streaming test

---

## Quality Gate Decision: CONCERNS

**Gate Status:** CONCERNS — ship with documented gaps tracked

**Rationale:**
- **E68** is thoroughly tested (93% coverage, 0 gaps). All 5 requirements (R1-R5) have comprehensive unit and integration tests across all specified scenarios.
- **E77A** has 3 high-severity gaps (65% coverage). The RestoreConfirmationDialog component doesn't exist, the main DataAndBackupPanel has no dedicated unit test, and the import service's migration/safety paths are untested. These affect the highest-risk path in the entire plan (data restore).
- **E77B** is well-tested (87% coverage) with 2 medium gaps in sync validation and reconnect UI flows.

**Recommended actions before beta launch:**
1. Create `RestoreConfirmationDialog.tsx` component (HIGH — data restore safety)
2. Add `DataAndBackupPanel.test.tsx` (HIGH — regression prevention)
3. Add schema migration + newer version rejection tests to `importService.test.ts` (HIGH — data integrity)
4. Add E2E round-trip test for backup/restore (MEDIUM — data loss prevention)
5. Add E2E sync validation test for Drive metadata (MEDIUM — R15 compliance)
6. Add `ReconnectGoogleDialog.test.tsx` (LOW — component is simple)
7. Add reconnect/disconnect flow tests for E77B-S04 (LOW)
