# E119-S08: Consent UI + Withdrawal Effects — Requirements

**Date**: 2026-04-23
**Story**: E119-S08
**Branch**: feature/e119-s08-consent-ui

---

## Problem Statement

Knowlune processes personal data for five optional AI/analytics purposes under GDPR Art. 6(1)(a) (consent). The consent schema and `consentService` are live (E119-S07), but there is no user-facing UI to grant or withdraw consent, and no code to apply withdrawal effects atomically. Without this, the app cannot lawfully process consent-based data — every AI call, embedding generation, and telemetry event is potentially unlawful until the user has been offered meaningful consent.

The core pain: users have no visibility into what data flows where, no mechanism to say "stop," and no guarantee that saying "stop" actually stops anything.

---

## Acceptance Criteria

All criteria carry over verbatim from the story file:

- **AC-1**: `src/app/components/settings/sections/PrivacySection.tsx` renders per-purpose toggles from the consent inventory.
- **AC-2**: Each toggle shows: purpose name, data categories affected, "what happens if you withdraw" copy.
- **AC-3**: Withdrawal requires a confirmation dialog listing exactly what will be deleted/frozen before executing.
- **AC-4**: Withdrawal effects are applied atomically (or rolled back on failure — never leave consent=off with effects=incomplete).
- **AC-5**: Effects per purpose:
  - `ai_tutor`: cancel in-flight AI requests; no data deletion.
  - `ai_embeddings`: delete embedding rows; mark learner model snapshot `frozen_reason: 'consent_withdrawn'`.
  - `voice_transcription`: delete pending audio jobs; retain past transcripts.
  - `analytics_telemetry`: delete telemetry records.
  - `marketing_email`: unsubscribe (mark withdrawn in Dexie; no external API call needed client-side).
- **AC-6**: Toggles default to off for non-core purposes; no pre-ticked; no bundled consents (GDPR Art 7(2)).
- **AC-7**: All AI calls are wrapped with `consentService.isGranted` guard; consent=off → request rejected with user-visible message.
- **AC-8**: Consent row synced to Dexie + Supabase; other devices reflect the change on next sync.
- **AC-9**: Toggles are keyboard-navigable with ARIA labels describing purpose and current state (WCAG 2.1 AA).
- **AC-10**: E2E: grant → use AI → withdraw → effects applied.

---

## Technical Context

### Existing Infrastructure (from S07)
- **`consentService`** (`src/lib/compliance/consentService.ts`): `isGranted(userId, purpose)`, `listForUser(userId)`, `isGrantedForProvider(userId, purpose, providerId)`. All fail-closed.
- **`UserConsent` type** (`src/data/types.ts`): `{ id, userId, purpose, grantedAt, withdrawnAt, noticeVersion, evidence, createdAt, updatedAt }`.
- **Dexie `userConsents` table** (`src/db/schema.ts` v58): indexed on `[userId+purpose]`. LWW sync with Supabase.
- **`CONSENT_PURPOSES`** enum: `ai_tutor`, `ai_embeddings`, `voice_transcription`, `analytics_telemetry`, `marketing_email`.
- **`docs/compliance/consent-inventory.md`**: canonical purpose metadata (descriptions, data categories, withdrawal effects, provider registry).

### Settings Architecture
- Settings sections live in `src/app/components/settings/sections/`. Pattern: named export `XxxSection()`.
- `settingsCategories.ts` defines `SettingsCategorySlug` union — needs `'privacy'` added.
- User ID: `useAuthStore(s => s.user)` → `user?.id`.
- `Switch` component available at `src/app/components/ui/switch.tsx`.
- `Dialog` component at `src/app/components/ui/dialog.tsx`.
- Auth-gated sections return `null` when user is absent (see `SyncSection` pattern).

### AI Entry Points to Guard (AC-7)
- **`src/ai/llm/factory.ts`** → `getLLMClient()` / `withModelFallback()`: used by all AI features (summary, quiz, note organizer, etc.). This is the single best injection point.
- **`src/ai/embeddingPipeline.ts`** → `EmbeddingPipeline.indexNote()`: calls `generateEmbeddings`. Guard with `ai_embeddings`.
- **`src/ai/courseEmbeddingService.ts`**: called from `courseImport.ts`. Guard with `ai_embeddings`.
- **`src/ai/workers/coordinator.ts`**: `generateEmbeddings()` — underlying worker call.

### Withdrawal Effect Implementation
- `ai_tutor`: abort in-flight requests via `AbortController` (LLM clients already accept signals).
- `ai_embeddings`: delete from `db.noteEmbeddings` (or equivalent vector table) + set `frozen_reason` on learner model snapshot.
- `voice_transcription`: delete pending audio jobs from queue.
- `analytics_telemetry`: delete from `db.aiUsageEvents`.
- `marketing_email`: set `withdrawnAt` in Dexie consent row; sync engine propagates.

### Sync (AC-8)
- Consent rows are in `userConsents` table — already wired to LWW sync (E119-S07 AC-7). Writing to Dexie is sufficient; sync engine handles Supabase propagation automatically.

### Test Files to Create
- `src/app/components/settings/sections/__tests__/PrivacySection.test.tsx` — unit tests for toggle rendering, grant/withdraw flows.
- `src/lib/compliance/__tests__/consentEffects.test.ts` — unit tests for atomicity + rollback.
- `tests/e2e/compliance/consent-withdrawal.spec.ts` — E2E: grant → use AI → withdraw → effects applied.

---

## Out of Scope

- AI provider change re-consent (S09 — depends on this story).
- Retention enforcement / scheduled deletion (S11).
- Operator compliance artifacts (S12).
- External Resend API call for `marketing_email` unsubscribe — Dexie consent row + sync to Supabase is sufficient; Supabase webhook handles Resend.

---

## Open Questions

1. **Which Dexie table holds vector embeddings?** `src/ai/vector-store.ts` — need to confirm table name to implement `ai_embeddings` deletion.
2. **Does a learner model snapshot table exist?** If not, `frozen_reason` can be stored in a new `modelSnapshots` Dexie table or skipped as a no-op (document in consent-inventory).
3. **`analytics_telemetry` table name**: confirmed as `ai_usage_events` via `src/lib/sync/tableRegistry.ts`.
4. **Pending audio jobs**: need to locate the audio job queue table (likely in Dexie schema) to implement `voice_transcription` effect.
5. **`noticeVersion`**: when granting consent, use current privacy notice version from `src/lib/compliance/noticeVersion.ts`.
