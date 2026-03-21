---
story_id: E13-S06
story_name: "Handle localStorage Quota Exceeded Gracefully"
status: in-progress
started: 2026-03-21
completed:
reviewed: true
review_started: 2026-03-21
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 13.6: Handle localStorage Quota Exceeded Gracefully

## Story

As a learner,
I want the quiz to continue working even if localStorage is full,
So that I don't lose progress due to storage limitations.

## Acceptance Criteria

**Given** localStorage is near or at quota limit
**When** the quiz attempts to save progress
**Then** it catches `QuotaExceededError` exceptions
**And** it attempts to free space by clearing old data (if possible)
**Or** it falls back to sessionStorage (temporary, page-session only)
**And** it displays a non-blocking warning toast: "Storage limit reached. Quiz progress will be saved for this session only."

**Given** localStorage quota is exceeded
**When** I complete and submit the quiz
**Then** the attempt is still saved to IndexedDB (Dexie)
**And** only the `currentProgress` state is affected (attempt history intact)
**And** I can still complete the quiz successfully

**Given** I am using sessionStorage fallback
**When** I close the browser tab
**Then** I lose in-progress state (expected behavior for sessionStorage)
**And** submitted attempts remain in IndexedDB (permanent storage)

**Given** the quota exceeded warning
**When** displayed to the user
**Then** it suggests clearing browser data or using a different browser
**And** it does NOT block quiz functionality (non-modal toast)

## Tasks / Subtasks

- [ ] Task 1: Add quota-resilient storage adapter for Zustand persist middleware (AC: 1, 2)
  - [ ] 1.1 Create custom storage adapter with localStorage -> sessionStorage fallback
  - [ ] 1.2 Catch QuotaExceededError in setItem
  - [ ] 1.3 Attempt to clear stale data before falling back
- [ ] Task 2: Display non-blocking toast warning on quota exceeded (AC: 1, 4)
  - [ ] 2.1 Show warning toast with clear message
  - [ ] 2.2 Suggest clearing browser data
- [ ] Task 3: Ensure quiz submission still works via Dexie (AC: 2, 3)
  - [ ] 3.1 Verify attempt history persists to IndexedDB regardless of storage fallback
- [ ] Task 4: Unit tests for quota handling (AC: all)
  - [ ] 4.1 QuotaExceededError caught and handled
  - [ ] 4.2 Fallback to sessionStorage
  - [ ] 4.3 Toast warning displayed

## Implementation Plan

See [plan](plans/e13-s06-handle-localstorage-quota-exceeded-gracefully.md) for implementation approach.

## Implementation Notes

### Architecture
- Created a standalone `quotaResilientStorage` adapter (`src/lib/quotaResilientStorage.ts`) implementing Zustand's `StateStorage` interface. This keeps the fallback logic decoupled from the quiz store — any Zustand persist store can reuse it.
- The adapter follows a three-phase strategy on write failure: (1) detect quota error, (2) clear stale `quiz-progress-*` keys and retry localStorage, (3) fall back to sessionStorage with a throttled warning toast.

### Key Design Decisions
- **30-second toast throttle**: Zustand persist calls `setItem` on every state change. Without throttling, quota failures during rapid interactions (e.g., answering multiple questions quickly) would flood the user with toasts.
- **Dual-storage cleanup in `removeItem`**: Removes from both localStorage and sessionStorage because data may have been written to either during the adapter's lifetime.
- **Per-quiz backup subscriber**: The existing `useQuizStore` subscriber (line 304) also needed quota-aware error handling, independent of the Zustand persist middleware, since it writes to its own `quiz-progress-{id}` keys.
- **`loadSavedProgress` reads both storages**: `Quiz.tsx` now checks sessionStorage as a fallback when loading saved progress, ensuring continuity after a quota-triggered fallback.

## Testing Notes

### Unit Tests (`src/lib/__tests__/quotaResilientStorage.test.ts`)
- 14 test cases covering all adapter methods and error paths
- Uses `Storage.prototype` overrides to simulate per-storage behavior (jsdom shares a single backing Map for localStorage and sessionStorage)
- `_resetWarningThrottle()` test helper exported to control the 30s throttle in tests
- Tests verify: normal read/write, sessionStorage fallback, stale key cleanup, toast throttling, Firefox error variant, and non-quota error logging

### No E2E Spec
- This story is infrastructure-level (storage adapter) with no new UI routes or visible components. Unit tests provide full coverage of the acceptance criteria. Smoke E2E specs validate the app still functions correctly.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

**2026-03-21**: PASS — No blockers. Toast contrast 7.94:1 (WCAG AA+), 8s duration adequate, screen reader live region correct. 1 medium (stale "localStorage" in console.warn), 2 nits. See [design-review-2026-03-21-e13-s06.md](../reviews/design/design-review-2026-03-21-e13-s06.md).

## Code Review Feedback

**2026-03-21**: 0 blockers, 4 high, 2 medium, 3 nits. Key findings: (1) subscriber toast not throttled, (2) duplicated isQuotaExceeded logic, (3) clearStaleQuizKeys deletes active quiz backup, (4) empty catch in beforeunload. See [code-review-2026-03-21-e13-s06.md](../reviews/code/code-review-2026-03-21-e13-s06.md) and [code-review-testing-2026-03-21-e13-s06.md](../reviews/code/code-review-testing-2026-03-21-e13-s06.md).

## Web Design Guidelines Review

**2026-03-21**: PASS — No issues found. Toast uses design tokens, WCAG-compliant duration, clean fallback chain, no layout changes.

## Challenges and Lessons Learned

### 1. Zustand Persist Triggers on Every State Change
Zustand's persist middleware calls `setItem` on every `set()` call, not just on meaningful data changes. When localStorage is full, this means the quota error fires on every keystroke or answer selection. The 30-second toast throttle was essential to prevent UX degradation — without it, the warning toast would appear dozens of times during a single quiz session.

### 2. jsdom Shares a Single Storage Backing Map
In Vitest's jsdom environment, `localStorage` and `sessionStorage` share the same underlying `Map`. This means `localStorage.setItem('key', 'val')` is visible via `sessionStorage.getItem('key')`. To test the fallback behavior accurately, tests override `Storage.prototype.getItem` and `setItem` to simulate per-storage isolation. The `origSetItem`/`origGetItem` pattern in the test file preserves the real implementations for restoration in `afterEach`.

### 3. Firefox Uses a Non-Standard Error Name
Firefox throws `DOMException` with `name: 'NS_ERROR_DOM_QUOTA_REACHED'` instead of the standard `'QuotaExceededError'`. The `isQuotaExceeded()` helper checks both variants. This was discovered during research — without it, Firefox users would see silent failures (the non-quota error path logs to console but doesn't fall back).

### 4. Two Independent Write Paths Need Quota Handling
The Zustand persist middleware and the per-quiz backup subscriber (`useQuizStore` line 304) are independent write paths to localStorage. Both needed quota-aware error handling. The adapter handles the persist middleware path; the subscriber needed its own try/catch with the same `isQuotaExceeded` logic and sessionStorage fallback.

### 5. Stale Key Cleanup as a Recovery Strategy
Before falling back to sessionStorage, the adapter attempts to reclaim space by clearing orphaned `quiz-progress-*` keys from abandoned quizzes. This iterates localStorage keys in reverse (to avoid index shifting during removal). In many real-world scenarios, this cleanup alone frees enough space to avoid the sessionStorage fallback entirely.
