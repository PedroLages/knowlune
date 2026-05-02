---
title: "feat: E119-S09 AI Provider Change Re-consent"
type: feat
status: active
date: 2026-04-23
origin: docs/brainstorms/2026-04-23-e119-s09-ai-provider-reconsent-requirements.md
---

# feat: E119-S09 AI Provider Change Re-consent

## Overview

Extend the AI routing layer to block requests when the configured provider identity differs from the one captured in the user's consent record. Surface a `ProviderReconsentModal` that lets users accept (writes a new consent row recording `evidence.provider_id`) or decline (AI feature shows an inline disabled state). Handle the edge case where a notice update and a provider change happen simultaneously by composing a single combined flow.

## Problem Frame

GDPR Art. 13/14 and the sub-processor transparency obligation require that data only flows to a processor the user has explicitly agreed to. `consentService.isGrantedForProvider()` was stubbed in E119-S07 and the provider registry is already in `docs/compliance/consent-inventory.md`. This story wires the runtime enforcement: the factory check, the UI for re-consent, the combined notice+provider flow, and the decline path. (See origin: `docs/brainstorms/2026-04-23-e119-s09-ai-provider-reconsent-requirements.md`)

## Requirements Trace

- R1 (AC-1): `getLLMClient` calls `isGrantedForProvider` before routing; throws `ProviderReconsentError` if not granted
- R2 (AC-2): `ProviderReconsentModal` shows provider name, data categories, notice link; Accept or Decline actions
- R3 (AC-3): Accept writes a new consent row with `evidence.provider_id` via `consentEffects.grantConsent`
- R4 (AC-4): Provider version bump within same identity does NOT trigger re-consent
- R5 (AC-5): Simultaneous notice update + provider change shows a single combined modal
- R6 (AC-6): Decline renders inline disabled state; no other features affected
- R7 (AC-7): E2E test verifies reconsent modal appears, accept path proceeds, decline path blocks

## Scope Boundaries

- No retention enforcement (E119-S11)
- No operator-facing compliance documents (E119-S12)
- No annual review cycle (E119-S13)
- Provider identity is defined by `provider_id` key (legal entity), not model version

## Context & Research

### Relevant Code and Patterns

- `src/ai/llm/factory.ts` — existing consent guard (`isGranted`) in `getLLMClient`; extend with `isGrantedForProvider` check
- `src/ai/lib/ConsentError.ts` — pattern for typed errors from AI entry points
- `src/lib/compliance/consentService.ts` — `isGrantedForProvider` already implemented (E119-S07)
- `src/lib/compliance/consentEffects.ts` — `grantConsent` / `withdrawConsent` with atomic Dexie writes
- `src/app/components/settings/ConsentToggles.tsx` — existing shadcn Dialog/AlertDialog pattern for consent UI
- `src/app/components/ui/dialog.tsx` — base Dialog primitive to compose the modal
- `docs/compliance/consent-inventory.md` — provider registry (provider_id → legal entity + data categories)

### Institutional Learnings

- Consent writes must go through `syncableWrite` (via `consentEffects.grantConsent`) to ensure bidirectional sync
- Fail-closed: any error in consent check → block the request, never open by default
- Combined flows must not create two independent modal renders (GDPR bundling prohibition applies in reverse — a single flow is compliant; two separate sequential modals would be confusing and error-prone)

## Key Technical Decisions

- **Extend `getLLMClient` rather than create a new router file**: The factory is the single choke point. Adding the `isGrantedForProvider` check here ensures all current and future callers (quiz generation, tutor, embedding pipeline) are covered without requiring each to call a separate router.
- **New `ProviderReconsentError` error class**: Mirrors `ConsentError` but carries `providerId` and `purpose` so the catch handler knows which provider to show in the modal. The modal is surfaced by the calling UI component — the factory throws, callers catch.
- **Provider metadata sourced from `CONSENT_PURPOSE_META` + a new `PROVIDER_META` constant**: Avoids duplicating prose from `consent-inventory.md` into the modal component. The constant is the single runtime source of truth for provider display name and data categories.
- **Combined notice+provider modal via a single component with two modes**: `ProviderReconsentModal` accepts an optional `noticeUpdatePending` flag. When true, the modal copy and the Accept action also calls `writeNoticeAck`. This reuses the existing dialog pattern and avoids two simultaneous modal renders.
- **Decline path via `ProviderReconsentError` re-throw in a React `useState` guard**: The calling hook/component catches `ProviderReconsentError`, sets `reconsentRequired` state, renders the modal. If the user declines, the feature renders the inline disabled message without unmounting the rest of the page.

## Open Questions

### Resolved During Planning

- **Q1 (existing AI call sites)**: `getLLMClient` is the canonical entry point — extending it covers all existing callers automatically.
- **Q2 (combined flow)**: Compose a single `ProviderReconsentModal` with a `noticeUpdatePending` prop rather than creating a new combined component from scratch.
- **Provider version vs identity**: The `isGrantedForProvider` check uses `evidence.provider_id` (e.g., `'openai'`) — model version is not part of the key. This rule is already documented in `consent-inventory.md`.

### Deferred to Implementation

- Exact wording of inline declined message (implement as a named constant; copy can be tuned later)
- Whether `useAISuggestions.ts` / `useTutor.ts` / `useChatQA.ts` hooks need direct `ProviderReconsentError` catch blocks, or whether the error naturally propagates to a shared error boundary — assess during implementation

## Implementation Units

- [ ] **Unit 1: `ProviderReconsentError` error class**

**Goal:** Typed error class that the factory throws when provider consent is missing or mismatched; carries enough context for the modal.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Create: `src/ai/lib/ProviderReconsentError.ts`
- Test: `src/ai/lib/__tests__/ProviderReconsentError.test.ts`

**Approach:**
- Extend `Error`; fields: `purpose: ConsentPurpose`, `providerId: string`
- Message: `Consent required for provider "${providerId}" on purpose "${purpose}".`
- Mirror pattern of `src/ai/lib/ConsentError.ts`

**Patterns to follow:**
- `src/ai/lib/ConsentError.ts`

**Test scenarios:**
- Happy path: `new ProviderReconsentError('ai_tutor', 'openai')` — `instanceof ProviderReconsentError` is true, `.purpose === 'ai_tutor'`, `.providerId === 'openai'`, `.name === 'ProviderReconsentError'`
- Edge case: `instanceof Error` is also true (prototype chain correct)
- Edge case: `message` string contains both provider and purpose

**Verification:**
- Test file passes. Class is importable and type-checks.

---

- [ ] **Unit 2: Provider consent check in `getLLMClient`**

**Goal:** After the existing `isGranted` check, add an `isGrantedForProvider` check that throws `ProviderReconsentError` when the resolved provider is not the one captured in the user's consent evidence.

**Requirements:** R1, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/ai/llm/factory.ts`
- Modify: `src/ai/llm/__tests__/factory-consent-guard.test.ts`

**Approach:**
- After `isGranted` passes, determine `resolvedProvider` (same logic already used to pick the client)
- Call `isGrantedForProvider(userId, CONSENT_PURPOSES.AI_TUTOR, resolvedProvider)`
- If false → throw `new ProviderReconsentError(CONSENT_PURPOSES.AI_TUTOR, resolvedProvider)`
- Apply to both the feature-aware path and the legacy global-provider path
- For `ai_embeddings` purpose, also guard in `embeddingPipeline.ts` using the same pattern

**Patterns to follow:**
- Existing `isGranted` guard block in `getLLMClient` (lines 57–68)

**Test scenarios:**
- Happy path: consent granted for `'openai'` + `resolvedProvider === 'openai'` → client returned
- Error path: consent granted for `'openai'` + `resolvedProvider === 'anthropic'` → `ProviderReconsentError` thrown with `providerId === 'anthropic'`
- Error path: no `evidence.provider_id` in consent row (legacy row) → `isGrantedForProvider` returns false → `ProviderReconsentError` thrown
- Edge case: `CONSENT_PURPOSES.AI_TUTOR` consent not granted at all → original `ConsentError` thrown (existing test, must still pass)
- Edge case: GPT-4 → GPT-5 model bump within `'openai'` provider → NO `ProviderReconsentError` (provider_id unchanged)

**Verification:**
- Existing factory-consent-guard tests still pass. New provider-mismatch scenarios covered.

---

- [ ] **Unit 3: Provider metadata constant**

**Goal:** Runtime source of truth for provider display name and data categories, used by the modal and the inline declined state.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Create: `src/lib/compliance/providerMeta.ts`
- Test: `src/lib/compliance/__tests__/providerMeta.test.ts`

**Approach:**
- Export `PROVIDER_META: Record<string, { displayName: string; dataCategories: string; legalEntity: string }>` 
- Keys match `provider_id` values in `consent-inventory.md`: `'openai'`, `'anthropic'`, `'ollama'`, `'speaches'`, plus a `'unknown'` fallback
- Data categories sourced verbatim from `consent-inventory.md` AI Provider Registry

**Patterns to follow:**
- `CONSENT_PURPOSE_META` in `src/lib/compliance/consentEffects.ts`

**Test scenarios:**
- Happy path: `PROVIDER_META['openai'].displayName` is non-empty string
- Happy path: all four registered provider IDs from `consent-inventory.md` are present as keys
- Edge case: `PROVIDER_META['unknown']` exists and has a safe fallback display name

**Verification:**
- Test passes. TypeScript confirms all keys present.

---

- [ ] **Unit 4: `ProviderReconsentModal` component**

**Goal:** Dialog modal that informs the user of the provider change, shows data categories, links to the privacy notice, and offers Accept / Decline actions. Supports a combined notice+provider flow via an optional prop.

**Requirements:** R2, R3, R5, R6

**Dependencies:** Units 1, 3

**Files:**
- Create: `src/app/components/compliance/ProviderReconsentModal.tsx`
- Test: `src/app/components/compliance/__tests__/ProviderReconsentModal.test.tsx`

**Approach:**
- Props: `{ open: boolean; providerId: string; purpose: ConsentPurpose; noticeUpdatePending?: boolean; noticeVersion?: string; onAccept: () => Promise<void>; onDecline: () => void }`
- Renders shadcn `Dialog` with `DialogContent`
- Body: provider display name from `PROVIDER_META`, data categories, link to `/legal/privacy`
- When `noticeUpdatePending === true`, add a section noting the privacy notice has been updated (include version)
- Accept action calls `onAccept()` (caller is responsible for writing the consent row and notice ack)
- Decline action calls `onDecline()`
- Loading state during async Accept (disable button, show spinner)
- WCAG: `DialogTitle` always present; focus trapped inside Dialog; Accept/Decline have clear accessible labels

**Patterns to follow:**
- `src/app/components/settings/ConsentToggles.tsx` for Dialog + loading state pattern
- `src/app/components/ui/dialog.tsx` primitives

**Test scenarios:**
- Happy path: renders with `open=true`, provider name visible, data categories visible, privacy notice link present
- Happy path: `onAccept` called when Accept button clicked; loading spinner shown during async; modal closes on success
- Happy path: `onDecline` called when Decline button clicked
- Happy path: `noticeUpdatePending=true` → notice-update copy section rendered
- Happy path: `noticeUpdatePending=false` (default) → notice-update copy section NOT rendered
- Edge case: unknown `providerId` → falls back to `PROVIDER_META['unknown']` display name, no crash
- Accessibility: `DialogTitle` present; Dialog has role="dialog"; buttons keyboard-reachable

**Verification:**
- Unit test suite passes. Modal renders at all three breakpoints without overflow.

---

- [ ] **Unit 5: `useProviderReconsent` hook**

**Goal:** React hook that wraps the `ProviderReconsentError` catch pattern; manages modal open state, accept/decline handlers, and the inline declined state for the calling component.

**Requirements:** R1, R3, R5, R6

**Dependencies:** Units 1, 3, 4

**Files:**
- Create: `src/ai/hooks/useProviderReconsent.ts`
- Test: `src/ai/hooks/__tests__/useProviderReconsent.test.ts`

**Approach:**
- Returns: `{ reconsentRequired: boolean; declinedProvider: string | null; ProviderReconsentModalProps; handleAIError: (err: unknown) => boolean }`
- `handleAIError` inspects the error: if `instanceof ProviderReconsentError`, sets `reconsentRequired = true`, `pendingProviderId`, and returns `true` (error was handled). Otherwise returns `false`.
- Accept handler calls `grantConsent(purpose, { provider_id: providerId })` via `consentEffects`, then retries (or calls a provided retry callback), then closes modal
- Decline handler sets `declinedProvider = providerId`, closes modal, keeps `reconsentRequired = false`
- Check `CURRENT_NOTICE_VERSION` vs last-acked version (from `noticeAck`) to set `noticeUpdatePending`
- All writes go through `consentEffects.grantConsent` to ensure sync-engine propagation

**Patterns to follow:**
- `src/ai/hooks/useChatQA.ts` for error handling in AI hooks
- `src/lib/compliance/consentEffects.ts` for `grantConsent`

**Test scenarios:**
- Happy path: `handleAIError(new ProviderReconsentError('ai_tutor', 'openai'))` → returns true, `reconsentRequired === true`
- Happy path: `handleAIError(new Error('network'))` → returns false, `reconsentRequired === false`
- Happy path: accept path calls `grantConsent` with correct `evidence.provider_id`, modal closes
- Happy path: decline path sets `declinedProvider`, modal closes, `reconsentRequired` remains false
- Integration: `noticeUpdatePending` is true when notice version has changed since last ack

**Verification:**
- Tests pass. Hook composes correctly with `ProviderReconsentModal` (manual smoke test).

---

- [ ] **Unit 6: Inline declined state helper**

**Goal:** Small presentational helper that renders the inline "AI features require consent for [Provider]" message when the user declines re-consent.

**Requirements:** R6

**Dependencies:** Unit 3

**Files:**
- Create: `src/app/components/compliance/AIConsentDeclinedBanner.tsx`
- Test: `src/app/components/compliance/__tests__/AIConsentDeclinedBanner.test.tsx`

**Approach:**
- Props: `{ providerId: string }`
- Renders a muted-foreground inline notice using design tokens (no hardcoded colors)
- Copy: `"AI features require consent for [Provider Display Name]. You can enable this in Settings → Privacy & Consent."`
- Link to Settings Privacy section

**Patterns to follow:**
- Token usage from `src/styles/theme.css` — `text-muted-foreground`, `bg-muted`

**Test scenarios:**
- Happy path: renders with `providerId='openai'` → "OpenAI" visible in message
- Edge case: unknown provider → fallback display name from `PROVIDER_META['unknown']`
- Accessibility: banner has role="status" or role="note"; link is keyboard accessible

**Verification:**
- Tests pass. No hardcoded colors flagged by ESLint.

---

- [ ] **Unit 7: E2E test**

**Goal:** Playwright spec verifying the full provider-change re-consent flow (modal appears, accept path proceeds, decline path blocks cleanly).

**Requirements:** R7

**Dependencies:** Units 1–6

**Files:**
- Create: `tests/e2e/compliance/provider-change.spec.ts`

**Approach:**
- Seed Dexie `userConsents` with a grant for `'ai_tutor'` with `evidence.provider_id = 'openai'`
- Use `window.__mockLLMClient` injection pattern (already supported in factory.ts) to simulate what would happen on provider switch — set `window.__testForceProvider = 'anthropic'` in test setup and add a test-only path in the factory
- Trigger an AI feature call; assert `ProviderReconsentModal` appears
- Accept path: click Accept, assert modal closes, AI call proceeds (mock resolves)
- Decline path: click Decline, assert modal closes, `AIConsentDeclinedBanner` visible, no AI call made

**Patterns to follow:**
- `tests/e2e/compliance/` directory for existing compliance E2E specs
- `window.__mockLLMClient` injection in `src/ai/llm/factory.ts` (line 50–55)

**Test scenarios:**
- Happy path: provider mismatch → modal appears with correct provider name
- Happy path: Accept → modal closes → AI request proceeds
- Happy path: Decline → modal closes → declined banner visible
- Edge case: simultaneous notice update pending → combined modal content visible (notice section + provider section)

**Verification:**
- Spec passes on Chromium. Console is clean.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
AI feature call (quiz, tutor, embedding…)
          │
          ▼
  getLLMClient(feature)
          │
    isGranted(userId, purpose)  ──── false ──► throw ConsentError  ──► ConsentError UI
          │
         true
          │
    isGrantedForProvider(userId, purpose, resolvedProvider)
          │                                         │
         true                                     false
          │                                         │
    return LLM client                    throw ProviderReconsentError
                                                   │
                                          Calling hook/component
                                          catches ProviderReconsentError
                                                   │
                                    ┌──── noticeUpdatePending? ────┐
                                   no                             yes
                                    │                              │
                            ProviderReconsentModal          ProviderReconsentModal
                           (provider change only)           (combined: notice + provider)
                                    │
                           ┌────────┴─────────┐
                         Accept            Decline
                           │                  │
                    grantConsent(...)    declinedProvider state
                    +noticeAck(v)         AIConsentDeclinedBanner
                    retry AI call
```

## System-Wide Impact

- **Interaction graph:** `getLLMClient` is called by `useChatQA`, `useTutor`, `useAISuggestions`, `embeddingPipeline`, `quizGenerationService`. All will now surface `ProviderReconsentError` in addition to `ConsentError` — catch sites must handle both.
- **Error propagation:** `ProviderReconsentError` is not an infrastructure error; callers must `instanceof` check and show the modal rather than an error toast. Existing generic error handlers must not swallow it silently.
- **State lifecycle risks:** If the user accepts reconsent mid-session, the consent write is async — the retry should happen only after `grantConsent` resolves to avoid a race.
- **API surface parity:** `embeddingPipeline.ts` uses `isGranted` for `AI_EMBEDDINGS` directly; add the same `isGrantedForProvider` check there.
- **Unchanged invariants:** `ConsentError` (purpose not granted at all) is unchanged. The new `ProviderReconsentError` is only thrown when base purpose consent exists but provider_id mismatches.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Legacy consent rows (no `evidence.provider_id`) trigger re-consent for all existing users on first run | Intentional by design; `isGrantedForProvider` already returns false for missing provider_id. Users will see the modal once on provider-aware consent adoption. Document this in migration notes. |
| Combined notice+provider modal growing complex | Keep `noticeUpdatePending` as a single boolean prop; modal renders a conditional section. No new component needed. |
| AI hooks not catching `ProviderReconsentError` → generic error toast | Audit all `getLLMClient` catch blocks during implementation; add `instanceof ProviderReconsentError` check. |
| E2E test fragility: simulating provider switch | Use `window.__testForceProvider` pattern (test-only env gate) rather than modifying real AI config, keeping test isolation clean. |

## Documentation / Operational Notes

- `docs/compliance/consent-inventory.md` already documents the provider version vs identity rule (AC-4). No new documentation needed.
- On deploy: all existing users will need to re-consent once (legacy rows lack `evidence.provider_id`). This is expected and GDPR-correct.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-23-e119-s09-ai-provider-reconsent-requirements.md](docs/brainstorms/2026-04-23-e119-s09-ai-provider-reconsent-requirements.md)
- Related code: `src/ai/llm/factory.ts`, `src/lib/compliance/consentService.ts`, `src/lib/compliance/consentEffects.ts`
- Related story: E119-S07 (consentService stub), E119-S08 (consent UI/withdrawal)
