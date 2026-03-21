# E13-S06: Handle localStorage Quota Exceeded Gracefully

## Context

The quiz store (`useQuizStore`) uses Zustand's `persist` middleware to save quiz progress to localStorage. If localStorage reaches its ~5-10MB quota limit, writes silently fail or throw `QuotaExceededError`, causing quiz progress to be lost without user notification. This story adds a resilient fallback to sessionStorage with user-facing warnings, ensuring quizzes continue working regardless of storage state.

**Two storage write points** need quota handling:
1. Zustand persist middleware (automatic on every state update) — key: `levelup-quiz-store`
2. Per-quiz backup subscriber (lines 298-321) — key: `quiz-progress-{quizId}`

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/quotaResilientStorage.ts` | **NEW** — Custom Zustand storage adapter with localStorage → sessionStorage fallback |
| `src/stores/useQuizStore.ts` | Wire up quota-resilient storage adapter + update subscriber |
| `src/lib/toastHelpers.ts` | Add `toastWarning.storageQuota()` variant |
| `src/stores/__tests__/useQuizStore.test.ts` | Unit tests for quota handling |
| `src/lib/__tests__/quotaResilientStorage.test.ts` | **NEW** — Unit tests for storage adapter |

## Implementation Plan

### Task 1: Create quota-resilient storage adapter

**File:** `src/lib/quotaResilientStorage.ts`

Create a custom Zustand-compatible `StateStorage` adapter:

```
getItem(name):
  1. Try localStorage.getItem(name)
  2. Fallback: sessionStorage.getItem(name)
  3. Catch: return null

setItem(name, value):
  1. Try localStorage.setItem(name, value)
  2. Catch QuotaExceededError or NS_ERROR_DOM_QUOTA_REACHED:
     a. Try clearing stale quiz-progress-* keys (orphaned backups)
     b. Retry localStorage.setItem
     c. If still fails: sessionStorage.setItem(name, value)
     d. Show warning toast (throttled — max once per 30s to avoid spam)
  3. Catch other errors: log and continue

removeItem(name):
  1. Try both localStorage.removeItem AND sessionStorage.removeItem
```

**Key design decisions:**
- **Throttle toast warnings** — Zustand persist triggers on every state update; without throttling, rapid-fire toasts would appear
- **Try cleanup first** — Clear orphaned `quiz-progress-*` keys before falling back (keys from previous quizzes that weren't cleaned up)
- **Separate module** — Reusable by `useSuggestionStore` or future persist stores

### Task 2: Add toast warning variant

**File:** `src/lib/toastHelpers.ts`

Add a new `toastWarning` export following existing patterns. Uses `toast.warning` with LONG duration (8s). Non-blocking, non-modal.

### Task 3: Wire storage adapter into useQuizStore

**File:** `src/stores/useQuizStore.ts`

1. Import `quotaResilientStorage` and `createJSONStorage` from zustand/middleware
2. Add `storage: createJSONStorage(() => quotaResilientStorage)` to persist config
3. Update per-quiz backup subscriber with sessionStorage fallback + toast warning

### Task 4: Unit tests

**Storage adapter tests** (`src/lib/__tests__/quotaResilientStorage.test.ts`):
- getItem reads localStorage, falls back to sessionStorage
- setItem succeeds normally via localStorage
- setItem catches QuotaExceededError → cleans stale keys → retries
- setItem falls back to sessionStorage when retry fails
- Toast warning fires on fallback (throttled)
- removeItem cleans both storages
- Firefox NS_ERROR_DOM_QUOTA_REACHED variant handled

**Quiz store integration** (`src/stores/__tests__/useQuizStore.test.ts`):
- Quiz submission still saves to Dexie when localStorage is full

## Verification

1. Unit tests: `npm run test:unit -- --testPathPattern="quotaResilientStorage|useQuizStore"`
2. Build: `npm run build`
3. Lint: `npm run lint`
4. Smoke E2E: `npx playwright test --project=chromium tests/e2e/navigation.spec.ts tests/e2e/overview.spec.ts tests/e2e/courses.spec.ts`
