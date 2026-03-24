---
story_id: E18-S09
story_name: "Configure Quiz Preferences in Settings"
status: done
started: 2026-03-23
completed: 2026-03-23
reviewed: in-progress
review_started: 2026-03-24
review_gates_passed:
  - build
  - lint
  - type-check
  - format-check
  - unit-tests
  - e2e-tests
burn_in_validated: false
---

# Story 18.9: Configure Quiz Preferences in Settings

## Story

As a learner,
I want to configure my quiz preferences in the Settings page,
so that quizzes adapt to my preferred defaults without manual adjustment each time.

**FRs Fulfilled: QFR43, QFR59**

## Acceptance Criteria

**Given** I navigate to the Settings page
**When** the page loads
**Then** I see a "Quiz Preferences" section with configurable options:
  - Timer accommodation default (1x, 1.5x, 2x time multiplier)
  - Immediate feedback toggle (show correct/incorrect after each question)
  - Shuffle questions toggle (randomize question order)

**Given** I change a quiz preference
**When** I toggle or select a new value
**Then** the preference is persisted to localStorage
**And** a confirmation toast appears: "Quiz preferences saved"

**Given** I start a new quiz
**When** the quiz initializes
**Then** the quiz reads my saved preferences and applies them as defaults
**And** I can still override preferences per-quiz if the quiz UI allows it

**Given** I have not configured any preferences
**When** I start a quiz
**Then** defaults are used: 1x timer, feedback off, shuffle off

## Tasks / Subtasks

- [ ] Task 1: Create QuizPreferences type and defaults (AC: 4)
- [ ] Task 2: Create QuizPreferencesForm component (AC: 1)
- [ ] Task 3: Add Quiz Preferences section to Settings page (AC: 1)
- [ ] Task 4: Persist preferences to localStorage with toast feedback (AC: 2)
- [ ] Task 5: Integrate preferences into quiz initialization (AC: 3, 4)

## Design Guidance

[To be populated]

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story -- Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

- **Zod validation for preferences**: Used Zod schema (`quizPreferencesSchema`) to validate localStorage data on read, gracefully falling back to defaults when data is corrupted or missing. This prevents runtime errors from stale or malformed preference objects.
- **localStorage over IndexedDB**: Quiz preferences are simple key-value data that the quiz start screen reads synchronously. localStorage was the right choice over IndexedDB — no async overhead, no Dexie dependency, and preferences are available before the app's database initializes.
- **Timer accommodation as multiplier pattern**: Timer accommodation uses string-based multiplier keys (`'standard'`, `'150%'`, `'200%'`) rather than numeric values. This avoids floating-point ambiguity and makes the UI labels self-documenting. The conversion to numeric happens only at quiz initialization time.
- **Design review scripts use browser globals**: Playwright `page.evaluate()` scripts (design-review-*.mjs) use `getComputedStyle` which is a browser API. ESLint's `no-undef` rule doesn't know about browser context — requires `/* eslint-disable no-undef */` directive.
- **Shared IDB seeding helpers**: Initial E2E tests used a custom `seedQuizData()` with `setTimeout` delays. Replaced with shared `seedQuizzes()` helper from `tests/support/helpers/indexeddb-seed.ts` which uses frame-accurate `requestAnimationFrame` delays, reducing flakiness risk under load (Epic 16 retro finding).
