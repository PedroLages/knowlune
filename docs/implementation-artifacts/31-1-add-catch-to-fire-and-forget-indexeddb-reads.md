---
story_id: E31-S01
story_name: "Add .catch() to Fire-and-Forget IndexedDB Reads"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 31.1: Add .catch() to Fire-and-Forget IndexedDB Reads

## Story

As a user,
I want pages to show an error state instead of loading forever when IndexedDB reads fail,
so that I can understand what went wrong and take action.

## Acceptance Criteria

**Given** `ImportedLessonPlayer.tsx` loads lesson data from IndexedDB
**When** the Dexie read fails (e.g., database corruption, quota exceeded)
**Then** a `.catch()` handler sets an error state
**And** the UI shows "Failed to load lesson" with a retry button

**Given** `YouTubeLessonPlayer.tsx` loads video data from IndexedDB
**When** the Dexie read fails
**Then** a `.catch()` handler sets an error state
**And** the UI shows an error message (not infinite spinner)

**Given** `LessonPlayer.tsx` loads course/lesson data from IndexedDB
**When** either of the two Dexie reads (lines 234, 245) fails
**Then** a `.catch()` handler sets an error state
**And** the UI shows an appropriate error message

## Tasks / Subtasks

- [ ] Task 1: Add error state and `.catch()` to ImportedLessonPlayer.tsx (AC: 1)
  - [ ] 1.1 Add `const [error, setError] = useState<string | null>(null)` state
  - [ ] 1.2 Add `.catch(err => { setError(err.message); toast.error("Failed to load lesson") })` to the Dexie read at line 42
  - [ ] 1.3 Add error UI branch: when `error` is set, render "Failed to load lesson" message with a retry button
  - [ ] 1.4 Implement retry by clearing `error` and re-triggering the Dexie read

- [ ] Task 2: Add error state and `.catch()` to YouTubeLessonPlayer.tsx (AC: 2)
  - [ ] 2.1 Add `const [error, setError] = useState<string | null>(null)` state
  - [ ] 2.2 Add `.catch(err => { setError(err.message); toast.error("Failed to load video data") })` to the Dexie read at line 89
  - [ ] 2.3 Add error UI branch: when `error` is set, render error message instead of spinner
  - [ ] 2.4 Implement retry button

- [ ] Task 3: Add error state and `.catch()` to LessonPlayer.tsx (AC: 3)
  - [ ] 3.1 Add `const [error, setError] = useState<string | null>(null)` state
  - [ ] 3.2 Add `.catch()` to both Dexie reads at lines 234 and 245
  - [ ] 3.3 Pattern: `.catch(err => { setError(err.message); toast.error("Failed to load lesson data") })`
  - [ ] 3.4 Add error UI branch with retry button
  - [ ] 3.5 Ensure both reads handle errors independently (one failing shouldn't prevent the other from displaying)

- [ ] Task 4: Write E2E tests for error states
  - [ ] 4.1 Test that when IndexedDB read fails, error message is displayed (not infinite spinner)
  - [ ] 4.2 Test that retry button re-triggers the read
  - [ ] 4.3 Test that toast.error is shown on failure

## Implementation Notes

- **Audit finding:** H2 (confidence 90%)
- **Files:** `ImportedLessonPlayer.tsx:42`, `YouTubeLessonPlayer.tsx:89`, `LessonPlayer.tsx:234,245`
- **Pattern:** Add `.catch(err => { setError(err.message); toast.error("Failed to load") })` to each promise chain
- **Error state pattern:** Each component needs a `useState<string | null>(null)` for error tracking
- **Retry pattern:** Clear error state and re-invoke the Dexie read function
- **Important:** Do NOT swallow errors — every `.catch()` must both log and surface the error to the user
- **ESLint:** The `error-handling/no-silent-catch` rule will flag any empty catch blocks

## Testing Notes

- **Error simulation:** Mock Dexie reads to reject with a controlled error message
- **Spinner verification:** Assert that the loading spinner is NOT shown when error state is active
- **Retry verification:** After clicking retry, assert that the Dexie read is called again
- **Toast verification:** Assert `toast.error()` is called with a user-friendly message
- **Edge case:** Test what happens when the retry also fails (should show error again, not crash)
- **Edge case:** Test rapid retry clicks (debounce or disable button during retry)

## Pre-Review Checklist

Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- **Tiered error handling**: Primary data reads (lesson/video) get full error UI + retry button; supplementary data reads (notes/bookmarks) get toast-only since the player still works
- **useCallback for retry**: Extracted loadVideo as useCallback so the Retry button can re-invoke the same loading logic
- **4 reads across 3 files**: ImportedLessonPlayer (1), YouTubeLessonPlayer (1), LessonPlayer (2 — notes + bookmarks)
