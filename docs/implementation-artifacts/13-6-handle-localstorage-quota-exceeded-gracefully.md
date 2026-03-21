---
story_id: E13-S06
story_name: "Handle localStorage Quota Exceeded Gracefully"
status: in-progress
started: 2026-03-21
completed:
reviewed: false
review_started:
review_gates_passed: []
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

_To be filled during implementation._

## Testing Notes

_To be filled during implementation._

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

_Populated by /review-story._

## Code Review Feedback

_Populated by /review-story._

## Web Design Guidelines Review

_Populated by /review-story._

## Challenges and Lessons Learned

_To be filled during implementation._
