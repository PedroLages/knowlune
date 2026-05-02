---
title: "feat: E119-S08 Consent UI + Withdrawal Effects"
type: feat
status: active
date: 2026-04-23
origin: docs/brainstorms/2026-04-23-e119-s08-consent-ui-withdrawal-effects-requirements.md
---

# feat: E119-S08 Consent UI + Withdrawal Effects

## Overview

Add a Privacy settings section with per-purpose consent toggles backed by the E119-S07 `consentService` and Dexie `userConsents` table. Each toggle represents one of five GDPR Art. 6(1)(a) consent purposes; withdrawal triggers atomic cleanup effects (embedding deletion, telemetry deletion, abort of in-flight AI requests). All AI entry points acquire a `consentService.isGranted` guard so consent=off always means data stays local.

## Problem Frame

Knowlune processes personal data under five consent-based purposes. The consent schema and service are live (E119-S07) but there is no UI for users to grant or withdraw consent, and no code that applies withdrawal effects. Until this is in place, every AI call and embedding write is potentially unlawful.

See origin: `docs/brainstorms/2026-04-23-e119-s08-consent-ui-withdrawal-effects-requirements.md`

## Requirements Trace

- R1 (AC-1): `PrivacySection.tsx` renders per-purpose toggles.
- R2 (AC-2): Each toggle shows purpose name, data categories, withdrawal-effect copy.
- R3 (AC-3): Withdrawal opens a confirmation dialog listing what will be deleted/frozen.
- R4 (AC-4): Withdrawal effects are applied atomically with rollback on failure.
- R5 (AC-5): Effects per purpose: `ai_tutor` cancels in-flight; `ai_embeddings` deletes rows + freezes model; `voice_transcription` no-op (no queue); `analytics_telemetry` deletes events; `marketing_email` marks withdrawn.
- R6 (AC-6): Toggles default off; no pre-ticked; no bundled consents.
- R7 (AC-7): All AI calls guarded by `consentService.isGranted`; consent=off → user-visible rejection.
- R8 (AC-8): Consent rows synced via existing LWW pipeline (no extra work required).
- R9 (AC-9): Toggles are keyboard-navigable with ARIA labels (WCAG 2.1 AA).
- R10 (AC-10): E2E test: grant → use AI → withdraw → effects applied.

## Scope Boundaries

- No external Resend API call client-side — `marketing_email` sets `withdrawnAt` in Dexie; server webhook propagates to Resend.
- No audio job queue table exists — `voice_transcription` effect is documented as a no-op in the inventory (jobs are fire-and-forget).
- No automatic embedding regeneration on re-grant (consent-inventory already documents this).
- LWW sync for consent rows was wired in E119-S07 — no additional sync plumbing needed (R8 is free).

### Deferred to Separate Tasks

- AI provider re-consent flow (E119-S09 — depends on this story).
- Retention enforcement / scheduled deletion (E119-S11).
- Operator compliance artifacts (E119-S12).

## Context & Research

### Relevant Code and Patterns

- `src/lib/compliance/consentService.ts` — `isGranted`, `listForUser`, `isGrantedForProvider`. Fail-closed (unknown purpose → false).
- `src/data/types.ts` — `UserConsent`, `LearnerModel` interfaces. `LearnerModel` has no `frozenReason` field yet; must be added.
- `src/db/schema.ts` v58 — `db.userConsents`, `db.embeddings`, `db.aiUsageEvents`, `db.learnerModels`.
- `src/ai/vector-store.ts` — `VectorStorePersistence.removeEmbedding(noteId)` handles Dexie + sync queue entry. For bulk deletion, iterate `db.embeddings.where('userId')...` (note: embeddings table uses `noteId` PK, not userId directly — must join via notes or delete all).
- `src/ai/llm/factory.ts` — `getLLMClient(feature?)` and `withModelFallback(...)` are the canonical AI entry points. Guarding here covers all features.
- `src/ai/embeddingPipeline.ts` — `EmbeddingPipeline.indexNote()` and `indexNotesBatch()`. Guard at call site in `courseImport.ts` and note hooks rather than inside the class (class has no userId context).
- `src/app/components/settings/sections/SyncSection.tsx` — reference implementation: `useAuthStore(s => s.user)`, auth-gate via early `return null`, `Switch` + `Card` pattern, `Dialog` for confirmations.
- `src/app/components/settings/layout/SettingsLayout.tsx` — `SECTION_COMPONENTS` map; add `privacy: PrivacySection` entry.
- `src/app/components/settings/layout/settingsCategories.ts` — `SettingsCategorySlug` union; add `'privacy'`.
- `src/lib/compliance/noticeVersion.ts` — `CURRENT_NOTICE_VERSION` string for populating consent `noticeVersion` field on grant.
- `docs/compliance/consent-inventory.md` — purpose metadata (descriptions, data categories, withdrawal effects, provider registry). This is the canonical copy source for all UI copy.

### In-Flight Cancellation Decision

AbortControllers in Knowlune are component-local (`useTutor`, `useAISuggestions`, etc.) — there is no global registry. For `ai_tutor` withdrawal effect: expose a module-level `abortAllInFlightAIRequests()` function in a new `src/ai/lib/inFlightRegistry.ts` that hooks call to register/deregister their controllers. The withdrawal effect calls this function. This is the least-invasive approach; hooks only need a two-line registration change.

### Institutional Learnings

- Dexie operations inside effects must be wrapped in a try/catch with rollback — the LWW sync engine does not compensate for partial writes (see `src/lib/compliance/__tests__/consentSync.test.ts` for sync patterns).
- `syncableWrite` is the correct write path for any record that should sync to Supabase. Direct `db.table.put()` skips the sync queue.

## Key Technical Decisions

- **Guard point for AC-7**: `getLLMClient()` in `src/ai/llm/factory.ts` is the single best injection point — all AI features go through it. One guard covers quiz generation, tutor, note organizer, video summary, learning path, and course tagger. Embedding paths (`embeddingPipeline`, `courseEmbeddingService`) use a separate guard since they call the embedding worker directly, not `getLLMClient`.
- **Atomicity strategy**: Write `withdrawnAt` to Dexie first via `syncableWrite` (persists intent), then run effects. If any effect fails, re-set `withdrawnAt = null` (rollback the consent row). This satisfies AC-4's "never leave consent=off with effects=incomplete" invariant. The `LearnerModel.frozenReason` update is a best-effort step; failure logs a warning but does not block rollback.
- **Privacy as a new settings category**: Add `'privacy'` to `SettingsCategorySlug` and `SETTINGS_CATEGORIES` (between `sync` and the end). Wire `PrivacySection` into `SettingsLayout.SECTION_COMPONENTS`. This is the cleanest approach and follows the established pattern.
- **`ConsentToggles` as a sub-component**: `PrivacySection` handles auth-gating and data loading; `ConsentToggles` is a pure-ish component that receives `consents: UserConsent[]` and handlers. This makes `ConsentToggles` unit-testable in isolation.
- **Purpose metadata in a static map**: Define `CONSENT_PURPOSE_META` in `consentEffects.ts` (or a co-located `purposeMeta.ts`) mapping each `ConsentPurpose` to `{ label, dataCategories, withdrawalCopy }`. Sourced from `consent-inventory.md`. This map drives both the UI copy and the effect dispatcher.
- **`voice_transcription` withdrawal**: No audio job queue table exists; the effect is a documented no-op. Update `consent-inventory.md` to clarify.
- **`LearnerModel.frozenReason`**: Add optional field to the TypeScript interface and update the Dexie schema with a migration that adds the column as `undefined` (no-op for existing rows). The field is set to `'consent_withdrawn'` on `ai_embeddings` withdrawal.

## Open Questions

### Resolved During Planning

- **Which Dexie table holds vector embeddings?** `db.embeddings`, keyed by `noteId`. Bulk delete by loading all embedding IDs via `db.notes.where('userId').equals(userId)` then deleting matched embedding rows, or simpler: `db.embeddings.filter(e => noteIds.has(e.noteId)).delete()` after collecting the user's note IDs.
- **Does a learner model snapshot table exist?** `db.learnerModels` exists (keyed by `courseId`). `frozenReason` must be added as an optional field to `LearnerModel` and the Dexie schema migration bumped.
- **Audio job queue?** No table exists; `voice_transcription` effect is a no-op. Documented.
- **`noticeVersion` on grant**: use `CURRENT_NOTICE_VERSION` from `src/lib/compliance/noticeVersion.ts`.
- **In-flight AI abort**: introduce `src/ai/lib/inFlightRegistry.ts` as a global abort registry. AI hooks register/deregister controllers. Withdrawal calls `abortAllInFlightAIRequests()`.

### Deferred to Implementation

- Exact Dexie version number for the `frozenReason` schema migration (determine at runtime by incrementing the current max).
- Whether embedding bulk-delete should use `vectorStorePersistence.removeEmbedding()` per-note (enqueues sync entries) or a direct `db.embeddings.clear()` + manual sync queue batch (more efficient). Implementer decides based on note count concerns.
- Whether `settingsSearchIndex.ts` needs new entries for Privacy — implementer adds if the existing search infrastructure supports it.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
User toggles off "AI Tutor" in PrivacySection
  → PrivacySection calls withdrawConsent(userId, 'ai_tutor')
    → consentEffects.withdrawConsent():
        1. syncableWrite: set userConsents[userId, 'ai_tutor'].withdrawnAt = now
        2. dispatch effect: abortAllInFlightAIRequests()
        3. if any step throws: rollback (set withdrawnAt = null via syncableWrite)
  → sync engine propagates to Supabase
  → other devices see withdrawnAt set on next sync

User calls getLLMClient('videoSummary') while ai_tutor consent=off
  → guard checks consentService.isGranted(userId, 'ai_tutor')
  → false → throw ConsentError('ai_tutor')
  → UI shows toast: "AI features require your consent. Enable in Settings → Privacy."
```

## Implementation Units

- [ ] **Unit 1: Add `frozenReason` to `LearnerModel` + Dexie schema migration**

**Goal:** Extend the `LearnerModel` type with an optional `frozenReason` field and increment the Dexie schema version to persist it.

**Requirements:** R5 (ai_embeddings withdrawal effect)

**Dependencies:** None

**Files:**
- Modify: `src/data/types.ts` — add `frozenReason?: string` to `LearnerModel`
- Modify: `src/db/schema.ts` — bump schema version, add `frozenReason` to `learnerModels` index if needed (likely no index needed since it's a filter field), add migration comment
- Modify: `src/db/checkpoint.ts` — mirror schema version bump (kept in sync with schema.ts)

**Approach:**
- `frozenReason` is optional (`string | undefined`). Default is `undefined` (not frozen).
- Existing rows need no data migration — Dexie treats new optional fields as `undefined`.
- Schema version bump is the only required change; no `upgrade()` callback needed for a new optional field.

**Patterns to follow:**
- `src/db/schema.ts` v58 migration comment pattern for E119-S07 `userConsents`.

**Test scenarios:**
- Test expectation: none — this unit is a type and schema change only; no behavioral logic to unit-test. The schema checkpoint test (`src/db/__tests__/schema-checkpoint.test.ts`) exercises the version bump.

**Verification:**
- TypeScript compilation passes with `frozenReason?: string` on `LearnerModel`.
- Dexie schema version incremented by 1 without errors on app startup.

---

- [ ] **Unit 2: `consentEffects.ts` — atomic withdrawal effects module**

**Goal:** Implement the `withdrawConsent` and `grantConsent` functions with atomic Dexie writes and per-purpose effect handlers.

**Requirements:** R4, R5, R8

**Dependencies:** Unit 1 (for `frozenReason` on `LearnerModel`)

**Files:**
- Create: `src/lib/compliance/consentEffects.ts`
- Create: `src/lib/compliance/__tests__/consentEffects.test.ts`

**Approach:**
- Export `CONSENT_PURPOSE_META`: a map from `ConsentPurpose` to `{ label, dataCategories, withdrawalCopy, effectDescription }`. Sourced from `consent-inventory.md`.
- Export `withdrawConsent(userId, purpose)`: 
  1. Call `syncableWrite` to set `withdrawnAt = new Date().toISOString()` on the userConsents row.
  2. Run the purpose-specific effect (see below).
  3. On any throw: call `syncableWrite` to clear `withdrawnAt = null` (rollback).
  4. Return `{ success: boolean, error?: string }`.
- Export `grantConsent(userId, purpose)`:
  1. Call `syncableWrite` to upsert a `userConsents` row with `grantedAt = now`, `withdrawnAt = null`, `noticeVersion = CURRENT_NOTICE_VERSION`, `evidence = {}`.
  2. Return `{ success: boolean, error?: string }`.
- Per-purpose effects (called inside `withdrawConsent`):
  - `ai_tutor`: call `abortAllInFlightAIRequests()` from the registry module (Unit 3).
  - `ai_embeddings`: bulk-delete `db.embeddings` rows for the user's notes; set `frozenReason = 'consent_withdrawn'` on all `db.learnerModels` for the user.
  - `voice_transcription`: no-op (no audio queue table exists); log info.
  - `analytics_telemetry`: delete all `db.aiUsageEvents` rows (no userId filter needed if the table is per-device — implementer verifies).
  - `marketing_email`: no additional Dexie writes needed beyond the consent row itself.
- `frozenReason` update on `LearnerModel` is best-effort: catch and log if it fails, do not trigger rollback.

**Patterns to follow:**
- `src/lib/compliance/consentService.ts` — fail-closed, structured error logging.
- `src/lib/sync/syncableWrite.ts` — for all Dexie writes that must sync.

**Test scenarios:**
- Happy path: `withdrawConsent(userId, 'ai_tutor')` → returns `{ success: true }`, consent row has `withdrawnAt` set in Dexie.
- Happy path: `grantConsent(userId, 'analytics_telemetry')` → returns `{ success: true }`, row has `grantedAt` set, `withdrawnAt = null`, `noticeVersion = CURRENT_NOTICE_VERSION`.
- Atomicity: if the `ai_embeddings` effect throws, `withdrawnAt` is rolled back to `null` in Dexie.
- `ai_embeddings` effect: verifies `db.embeddings` rows for user's notes are deleted and `db.learnerModels` entries have `frozenReason = 'consent_withdrawn'`.
- `analytics_telemetry` effect: verifies `db.aiUsageEvents` rows are deleted.
- Edge case: `withdrawConsent` on an already-withdrawn purpose → updates `withdrawnAt` timestamp (idempotent, does not error).
- Edge case: `grantConsent` on already-granted → updates `grantedAt` and clears `withdrawnAt` (idempotent).
- Error path: Dexie write throws → function returns `{ success: false, error: '...' }` and does not leave partial state.

**Verification:**
- All test scenarios pass. No partial writes visible in Dexie after effect failure. `consentService.isGranted` returns `false` after `withdrawConsent`.

---

- [ ] **Unit 3: In-flight AI abort registry**

**Goal:** Provide a module-level registry so the `ai_tutor` withdrawal effect can abort all active AI requests without coupling to React component state.

**Requirements:** R5 (ai_tutor effect), R7

**Dependencies:** None

**Files:**
- Create: `src/ai/lib/inFlightRegistry.ts`
- Modify: `src/ai/hooks/useTutor.ts` — register/deregister controller
- Modify: `src/ai/hooks/useAISuggestions.ts` — register/deregister controller
- Modify: `src/ai/hooks/useAISuggestions.ts` (and any other hook using AbortController for AI calls)

**Approach:**
- `inFlightRegistry.ts` exports a `Set<AbortController>` (`_registry`) and three functions:
  - `registerAIRequest(controller)`: adds to the set.
  - `unregisterAIRequest(controller)`: removes from the set.
  - `abortAllInFlightAIRequests()`: calls `abort()` on all controllers, then clears the set.
- Each AI hook that creates an `AbortController` calls `registerAIRequest(controller)` on creation and `unregisterAIRequest(controller)` in its cleanup / finally block.
- Hooks to update: `useTutor`, `useAISuggestions`, `usePathPlacementSuggestion`, `src/ai/quizGenerationService.ts`, `src/ai/learningPath/suggestPlacement.ts`, `src/ai/learningPath/suggestOrder.ts`.

**Patterns to follow:**
- `src/ai/hooks/useTutor.ts` — existing `abortRef` pattern.

**Test scenarios:**
- Happy path: registering two controllers, calling `abortAllInFlightAIRequests()` → both controllers have `signal.aborted === true`; registry is empty afterwards.
- Edge case: calling `abortAllInFlightAIRequests()` on empty registry → no error.
- Edge case: `unregisterAIRequest` called with an unknown controller → no error.

**Verification:**
- All in-flight AI hooks include register/unregister calls. Unit tests pass.

---

- [ ] **Unit 4: Consent guard in `getLLMClient` and embedding entry points**

**Goal:** Wrap all AI entry points so that consent=off rejects the request with a typed error, satisfying AC-7.

**Requirements:** R7

**Dependencies:** Unit 2 (for `consentService` usage pattern — consentService itself already exists)

**Files:**
- Modify: `src/ai/llm/factory.ts` — add consent guard to `getLLMClient(feature?)`
- Modify: `src/ai/embeddingPipeline.ts` — add `ai_embeddings` guard to `indexNote()`
- Modify: `src/ai/courseEmbeddingService.ts` — add `ai_embeddings` guard before embedding call
- Create: `src/ai/lib/ConsentError.ts` — typed error class for consent rejections
- Modify: `src/app/components/figma/AISummaryPanel.tsx` — catch `ConsentError`, show user-visible message (or use existing error state)

**Approach:**
- `ConsentError` extends `Error` with `purpose: ConsentPurpose`. Callers can `instanceof ConsentError` to show appropriate UI.
- `getLLMClient(feature?)`: before building the client, call `consentService.isGranted(userId, purposeForFeature(feature))`. If false, throw `ConsentError`. Need a `featureToPurpose` map: all LLM features → `'ai_tutor'`; embedding features → `'ai_embeddings'`. This map lives in the factory or a co-located constants file.
- The guard requires `userId`. Use `useAuthStore.getState().user?.id`. If no user, the guard is skipped (no userId → no consent record → consentService already returns false → fail-closed).
- `EmbeddingPipeline.indexNote()`: add a guard at the top; if consent not granted, silently return (log info, do not throw — embedding failures are already non-blocking by design).
- UI components that display AI results should catch `ConsentError` and show a message like "AI features require your consent. Enable in Settings → Privacy." — not an error toast, but an inline informational state.

**Patterns to follow:**
- Existing `LLMError` class in `src/ai/llm/types.ts` — follow the same error class pattern.
- `src/app/components/figma/AISummaryPanel.tsx` error handling.

**Test scenarios:**
- Happy path: `getLLMClient('videoSummary')` when `ai_tutor` consent is granted → returns client (no change from current behavior).
- Error path: `getLLMClient('videoSummary')` when `ai_tutor` consent is not granted → throws `ConsentError` with `purpose = 'ai_tutor'`.
- Error path: `EmbeddingPipeline.indexNote()` when `ai_embeddings` not granted → returns without calling `generateEmbeddings`.
- Edge case: no authenticated user → guard skips (userId is undefined), `consentService.isGranted` returns false → `getLLMClient` throws `ConsentError` (fail-closed maintained).
- Integration: granting consent then calling `getLLMClient` → no `ConsentError` thrown.

**Verification:**
- AI features are blocked when consent is off. Consent errors are distinguishable from infrastructure errors. No silent failures.

---

- [ ] **Unit 5: `PrivacySection.tsx` and `ConsentToggles.tsx` UI**

**Goal:** Implement the Privacy settings section with per-purpose toggles, grant/withdraw flows, and the withdrawal confirmation dialog.

**Requirements:** R1, R2, R3, R6, R9

**Dependencies:** Unit 2 (for `withdrawConsent`, `grantConsent`, `CONSENT_PURPOSE_META`), Unit 4 (for consent guard)

**Files:**
- Create: `src/app/components/settings/sections/PrivacySection.tsx`
- Create: `src/app/components/settings/ConsentToggles.tsx`
- Create: `src/app/components/settings/sections/__tests__/PrivacySection.test.tsx`
- Modify: `src/app/components/settings/layout/settingsCategories.ts` — add `'privacy'` to `SettingsCategorySlug` and `SETTINGS_CATEGORIES` array
- Modify: `src/app/components/settings/layout/SettingsLayout.tsx` — add `privacy: PrivacySection` to `SECTION_COMPONENTS`

**Approach:**
- `PrivacySection`: auth-gated (returns `SignedOutPrivacyCard` when no user, mirroring `SyncSection`'s `SignedOutSyncCard`). Loads `consentService.listForUser(userId)` on mount into local state. Passes consent array to `ConsentToggles` along with `onGrant` and `onWithdraw` handlers.
- `ConsentToggles`: renders a `Card` per purpose from `CONSENT_PURPOSES` (order: ai_tutor, ai_embeddings, voice_transcription, analytics_telemetry, marketing_email). Each row: `Switch` (checked = consent is currently granted), purpose label, data categories, withdrawal-effect copy (from `CONSENT_PURPOSE_META`). 
- Withdrawal flow: clicking a granted toggle → open a `Dialog` (from shadcn `dialog.tsx`) showing purpose name + bullet list of what will be deleted/frozen → confirm → call `withdrawConsent` → update local state. Use `AlertDialog` variant for the destructive confirmation.
- Grant flow: clicking an off toggle → call `grantConsent` immediately (no confirmation needed for granting). Update local state optimistically.
- ARIA: each `Switch` has `aria-label="{purpose label}: {status}"` and `aria-describedby` pointing to the withdrawal-effect copy paragraph.
- No dark patterns: toggles are always enabled, copy is neutral, no nudge language.
- Add Privacy to `SETTINGS_CATEGORIES` with a `Lock` icon from lucide-react, positioned between `sync` and the end (or wherever makes semantic sense).

**Patterns to follow:**
- `src/app/components/settings/sections/SyncSection.tsx` — auth-gate pattern, Card/Switch layout.
- `src/app/components/settings/AccountDeletion.tsx` — AlertDialog confirmation pattern.

**Test scenarios:**
- Happy path: renders five toggles, all off by default (no consent rows → all switches unchecked).
- Happy path: when a user has granted `ai_tutor`, that toggle renders as checked.
- Withdraw flow: clicking a granted toggle opens a confirmation dialog with the correct purpose name and effect copy.
- Withdraw flow: confirming the dialog calls `withdrawConsent` and updates the switch to off.
- Withdraw flow: cancelling the dialog leaves the switch unchanged.
- Grant flow: clicking an off toggle calls `grantConsent` and updates the switch to on.
- Auth-gate: renders a signed-out card when no user.
- ARIA: each switch has a non-empty `aria-label` containing the purpose name.
- Edge case: `withdrawConsent` returns `{ success: false }` → toggle reverts to on, toast error shown.
- Keyboard: Tab navigates through all switches; Space toggles them.

**Verification:**
- All five purposes rendered. Toggle state matches Dexie consent rows. Confirmation dialog appears before withdrawal. ARIA labels present. Keyboard navigation works.

---

- [ ] **Unit 6: Wire Privacy into Settings navigation**

**Goal:** Ensure the Privacy section is reachable from the Settings sidebar and search.

**Requirements:** R1 (AC-1 implies the section exists in Settings)

**Dependencies:** Unit 5

**Files:**
- Modify: `src/app/components/settings/layout/settingsCategories.ts` — already covered in Unit 5; listed here for clarity
- Modify: `src/app/components/settings/layout/SettingsLayout.tsx` — already covered in Unit 5
- Modify: `src/app/components/settings/layout/settingsSearchIndex.ts` — add privacy/consent search entries

**Approach:**
- `settingsCategories.ts`: add `{ slug: 'privacy', label: 'Privacy & Consent', description: 'Manage your data processing consents', icon: Lock }` to `SETTINGS_CATEGORIES`.
- `SettingsLayout.tsx`: add `privacy: PrivacySection` to `SECTION_COMPONENTS` and update the `SECTION_COMPONENTS` type to include `'privacy'`.
- `settingsSearchIndex.ts`: add entries for each consent purpose (e.g., keywords: `['consent', 'privacy', 'gdpr', 'ai', 'tracking', 'data']`) pointing to the `privacy` section.

**Test scenarios:**
- Test expectation: none — this unit wires static config. The E2E test (Unit 7) navigates to the Privacy section and proves discoverability.

**Verification:**
- Privacy appears in the Settings sidebar. Clicking it renders `PrivacySection`. Search for "consent" or "privacy" routes to the Privacy section.

---

- [ ] **Unit 7: E2E test — grant → use AI → withdraw → effects applied**

**Goal:** Prove the full consent lifecycle in a real browser environment.

**Requirements:** R10 (AC-10)

**Dependencies:** Units 1–6 all complete

**Files:**
- Create: `tests/e2e/compliance/consent-withdrawal.spec.ts`

**Approach:**
- Seed a signed-in user with no consent rows (default state).
- Navigate to Settings → Privacy. Assert all toggles are off.
- Toggle on `ai_tutor`. Assert toggle is now on.
- Navigate to a course with AI Summary. Assert the AI Summary panel works (mock LLM client via `window.__mockLLMClient`).
- Return to Settings → Privacy. Toggle off `ai_tutor`. Confirm withdrawal dialog. Assert toggle is off.
- Navigate back to AI Summary. Assert the panel shows a consent-required message instead of a summary.
- Assert `db.userConsents` row for `ai_tutor` has `withdrawnAt` set (via `page.evaluate()`).
- For `analytics_telemetry`: toggle off, assert `db.aiUsageEvents` is empty after withdrawal (via `page.evaluate()`).
- Follow patterns in `tests/e2e/` for time determinism and IndexedDB seeding.

**Patterns to follow:**
- Existing E2E tests in `tests/e2e/` for IndexedDB evaluation and auth seeding.
- `window.__mockLLMClient` injection pattern (established in `src/ai/llm/factory.ts`).

**Test scenarios:**
- Full grant → use → withdraw → blocked cycle for `ai_tutor`.
- Withdrawal effect: `analytics_telemetry` events deleted from IndexedDB after withdrawal.
- Dialog cancel: withdrawal cancelled → toggle stays on → AI still works.
- Default state: all toggles off on first visit (no consent rows seeded).

**Verification:**
- E2E tests pass in Chromium with zero console errors related to consent. All withdrawal effects verified via IndexedDB assertions.

## System-Wide Impact

- **Interaction graph:** `SettingsLayout` → `PrivacySection` → `ConsentToggles` → `consentEffects.withdrawConsent` → `inFlightRegistry.abortAllInFlightAIRequests()` + Dexie bulk-delete + `consentService` guard. `getLLMClient` now has an async guard step for all callers.
- **Error propagation:** `ConsentError` propagates from `getLLMClient` through all AI feature hooks. Hooks must catch and display an inline consent-required state rather than a generic error toast.
- **State lifecycle risks:** Optimistic UI update on grant; pessimistic on withdraw (dialog-confirm-first). If `withdrawConsent` fails, the switch reverts. This prevents consent=off UI with effects=incomplete.
- **API surface parity:** `EmbeddingPipeline.indexNote()` and `courseEmbeddingService.ts` both need the same `ai_embeddings` guard — they are separate entry points not reached through `getLLMClient`.
- **Integration coverage:** The E2E test (Unit 7) proves the full path including Dexie writes, consent guard enforcement, and UI state update. Unit tests mock Dexie but prove the atomicity invariant.
- **Unchanged invariants:** `consentService.isGranted` continues to fail-closed for all unknown purposes. LWW sync for `userConsents` continues unchanged (E119-S07). All core purposes (`core_auth`, `core_sync`, etc.) remain non-withdrawable and have no UI toggles.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `getLLMClient` guard requires async userId lookup, adding latency to every AI call | `useAuthStore.getState()` is synchronous (Zustand); no network call. Latency is negligible. |
| Bulk embedding delete may be slow for users with many notes | Delete is fire-and-forget inside `withdrawConsent`; UI shows loading state. For very large datasets, implement batched deletion. |
| Schema version bump may conflict with concurrent epic branches | Coordinate version number at implementation time; increment sequentially from current max. |
| In-flight registry missed a hook, so some requests survive withdrawal | Risk is low (`ai_tutor` abort is best-effort per consent-inventory); all callers documented in Unit 3. |
| `ConsentError` not caught in a component → unhandled promise rejection | All AI-calling components must have error boundaries or local catch. Unit 5 reviews `AISummaryPanel`. |

## Documentation / Operational Notes

- Update `docs/compliance/consent-inventory.md` to document `voice_transcription` effect as a no-op (no audio queue table).
- Update `consent-inventory.md` to note `LearnerModel.frozenReason` field added in E119-S08 for `ai_embeddings` withdrawal.
- No server-side changes needed — consent row sync uses existing E119-S07 LWW pipeline.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-23-e119-s08-consent-ui-withdrawal-effects-requirements.md](docs/brainstorms/2026-04-23-e119-s08-consent-ui-withdrawal-effects-requirements.md)
- Related code: `src/lib/compliance/consentService.ts`, `src/ai/llm/factory.ts`, `src/ai/vector-store.ts`, `src/db/schema.ts`
- `docs/compliance/consent-inventory.md` — purpose metadata, provider registry
- GDPR Art. 6(1)(a), Art. 7(2) — lawful basis and consent independence requirements
