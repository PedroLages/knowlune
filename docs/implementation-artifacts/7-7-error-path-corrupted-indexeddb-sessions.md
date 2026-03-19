---
story_id: E07-S07
story_name: "Error Path — Corrupted IndexedDB Sessions"
status: in-progress
started: 2026-03-19
completed:
reviewed: true
review_started: 2026-03-19
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 7.7: Error Path — Corrupted IndexedDB Sessions

## Story

As a learner,
I want the app to handle corrupted IndexedDB session data gracefully,
so that my learning experience isn't interrupted by data corruption issues.

## Acceptance Criteria

**Given** IndexedDB contains corrupted session data (malformed JSON, invalid timestamps, etc.)
**When** I navigate to the Courses page
**Then** momentum badges display "Cold" for affected courses
**And** no console errors or app crashes occur
**And** valid sessions still calculate correctly

**Given** a mix of valid and corrupted sessions exist in IndexedDB
**When** the momentum calculation runs
**Then** corrupted sessions are skipped (score falls back to 0 / "Cold")
**And** valid sessions contribute to momentum as normal

**Given** corrupted session data exists
**When** I navigate between pages (Overview, My Class, Courses, etc.)
**Then** navigation works correctly without errors

## Tasks / Subtasks

- [ ] Task 1: Add validation/error handling in momentum calculation (AC: 1, 2)
  - [ ] 1.1 Add try/catch around session parsing in `src/lib/momentum.ts`
  - [ ] 1.2 Add session schema validation (required fields, types, ranges)
  - [ ] 1.3 Skip invalid sessions with console warning (not error)
- [ ] Task 2: Add validation in Dexie session queries (AC: 1, 3)
  - [ ] 2.1 Add defensive checks in session data access paths
  - [ ] 2.2 Ensure invalid data doesn't propagate to UI components
- [ ] Task 3: Promote analysis tests to regression suite (AC: 1, 2, 3)
  - [ ] 3.1 Move/adapt `tests/analysis/error-path-corrupted-sessions.spec.ts` to regression
  - [ ] 3.2 Verify all test scenarios pass with defensive code
- [ ] Task 4: Verify no regressions in existing momentum/session tests

## Implementation Plan

See [plan](plans/e07-s07-corrupted-indexeddb-sessions.md) for implementation approach.

## Implementation Notes

**Validation strategy:** Added an `isValidSession()` guard in `src/lib/momentum.ts` that checks `courseId` (string + non-empty), `startTime` (parseable date), and `duration` (finite non-negative number). Corrupted sessions are filtered before any date/math operations, with a `console.warn` for observability.

**Defense in depth:** Added upstream filters in `Courses.tsx` (filter before grouping) and `StudyScheduleWidget.tsx` (type-check `courseId` before comparison) so corrupted data never reaches momentum calculations.

**Test approach:** Promoted analysis tests to `tests/e2e/regression/story-e07-s07.spec.ts`. Uses manual IndexedDB seeding (intentional — shared helpers enforce valid schemas, but we need to inject malformed data). Tests cover missing fields, wrong types, malformed timestamps, NaN/Infinity durations, and mixed valid+corrupted scenarios.

## Testing Notes

Existing analysis tests at `tests/analysis/error-path-corrupted-sessions.spec.ts` cover:
- Missing required fields
- Invalid data types (string duration, numeric courseId)
- Malformed timestamps
- Negative/NaN/Infinity duration values
- Invalid sessionType values
- Mixed valid + corrupted sessions
- Navigation with corrupted data

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

No blockers. Momentum badges render correctly at all viewports (375/768/1440px). One pre-existing MEDIUM: MomentumBadge tooltip not keyboard-triggerable (aria-label compensates). See [design-review-2026-03-19-e07-s07.md](../reviews/design/design-review-2026-03-19-e07-s07.md).

## Code Review Feedback

0 blockers, 3 high, 4 medium, 2 nits. Key findings: (1) NaN/Infinity don't survive Playwright serialization — tests pass for wrong reason, (2) isValidSession lacks null/object guard, (3) 5 other toArray() call sites unguarded (follow-up story). See [code-review-2026-03-19-e07-s07.md](../reviews/code/code-review-2026-03-19-e07-s07.md) and [code-review-testing-2026-03-19-e07-s07.md](../reviews/code/code-review-testing-2026-03-19-e07-s07.md).

## Web Design Guidelines Review

No issues — changes are purely data-filtering logic with zero visual/layout/accessibility impact. See [web-design-guidelines-2026-03-19-e07-s07.md](../reviews/code/web-design-guidelines-2026-03-19-e07-s07.md).

## Challenges and Lessons Learned

1. **Manual IDB seeding is unavoidable for corruption tests.** The shared `seedStudySessions()` helper enforces valid schemas by design — you can't use it to inject malformed data. The test pattern validator flags this as MEDIUM, but it's a deliberate choice for error-path testing. Added `seedCorruptedSessions()` as a local test helper.

2. **Guard placement matters.** Initial approach was to only validate in `momentum.ts`, but corrupted `courseId` values (e.g., numeric instead of string) caused silent failures in upstream `.filter(s => s.courseId === course.id)` comparisons. Adding type guards at each data access point (Courses.tsx, StudyScheduleWidget.tsx) provides defense in depth.

3. **`isFinite()` catches more than `!isNaN()`.** For duration validation, `isFinite(s.duration)` rejects both `NaN` and `Infinity`/`-Infinity` in a single check, which is cleaner than `!isNaN(s.duration) && s.duration !== Infinity`.
