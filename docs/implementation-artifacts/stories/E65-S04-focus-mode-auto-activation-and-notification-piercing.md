---
story_id: E65-S04
story_name: "Focus Mode Auto-Activation and Notification Piercing"
status: in-progress
started: 2026-04-04
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 65.4: Focus Mode Auto-Activation and Notification Piercing

## Story

As a learner,
I want focus mode to automatically activate when I start a quiz or flashcard review,
so that I enter a focused state without manually toggling.

## Acceptance Criteria

**Given** auto-activation for quizzes is enabled in Settings (default: ON)
**When** I start a quiz (click "Start Quiz" or similar action)
**Then** the quiz component emits a `focus-request` custom event
**And** focus mode activates automatically with the quiz as the focused component

**Given** auto-activation for flashcards is enabled in Settings (default: ON)
**When** I start a flashcard review session
**Then** the flashcard component emits a `focus-request` custom event
**And** focus mode activates automatically

**Given** I complete a quiz or flashcard session
**When** the component emits a `focus-release` custom event
**Then** focus mode deactivates automatically
**And** the quiz results or session summary is visible in the normal view

**Given** auto-activation is disabled in Settings
**When** I start a quiz or flashcard session
**Then** focus mode does NOT activate automatically
**And** I can still manually activate it with Cmd+Shift+F

**Given** focus mode is active
**When** a critical notification occurs (timer warning, connection loss, session expiry)
**Then** the notification pierces the focus overlay and is visible above it
**And** focus mode remains active (notification does not exit focus mode)

**Given** focus mode is active
**When** a non-critical notification occurs (study reminder, course update)
**Then** the notification is suppressed until focus mode exits
**And** notifications are queued and shown after exit

**Given** this is my first time seeing focus mode auto-activate
**When** focus mode activates automatically
**Then** a brief dismissible tooltip appears: "Focus mode activated automatically. You can disable this in Settings."
**And** this tooltip does not appear again (localStorage flag)

## Tasks / Subtasks

- [ ] Task 1: Implement `focus-request` and `focus-release` custom events (AC: 1, 2, 3)
  - [ ] 1.1 Define event types: `FocusRequestEvent` with payload `{ targetId: string, componentType: 'quiz' | 'flashcard' | 'interleaved-review' }`
  - [ ] 1.2 Define `FocusReleaseEvent` with no payload
  - [ ] 1.3 Create helper functions: `dispatchFocusRequest(targetId, type)` and `dispatchFocusRelease()` in a shared module `src/lib/focusModeEvents.ts`
  - [ ] 1.4 Use `CustomEvent` on `window` object for cross-component communication

- [ ] Task 2: Emit events from Quiz component (AC: 1, 3)
  - [ ] 2.1 In `src/app/pages/Quiz.tsx`: dispatch `focus-request` when quiz starts (after "Start Quiz" click)
  - [ ] 2.2 Dispatch `focus-release` when quiz completes (results shown)
  - [ ] 2.3 Check auto-activation setting before dispatching: read `focusAutoQuiz` from `AppSettings`
  - [ ] 2.4 If auto-activation disabled, skip dispatching `focus-request`

- [ ] Task 3: Emit events from Flashcards component (AC: 2, 3)
  - [ ] 3.1 In `src/app/pages/Flashcards.tsx`: dispatch `focus-request` when review session starts
  - [ ] 3.2 Dispatch `focus-release` when session ends or user exits
  - [ ] 3.3 Check `focusAutoFlashcard` setting before dispatching
  - [ ] 3.4 Apply same pattern to `src/app/pages/InterleavedReview.tsx`

- [ ] Task 4: Listen for custom events in `useFocusMode()` (AC: 1, 2, 3, 4)
  - [ ] 4.1 Add `useEffect` listener for `focus-request` event on `window`
  - [ ] 4.2 On `focus-request`: find element with matching `data-focus-target`, activate focus mode
  - [ ] 4.3 Add `useEffect` listener for `focus-release` event on `window`
  - [ ] 4.4 On `focus-release`: deactivate focus mode, restore UI

- [ ] Task 5: Add auto-activation settings to `AppSettings` (AC: 4)
  - [ ] 5.1 Add `focusAutoQuiz?: boolean` to `AppSettings` interface in `src/lib/settings.ts` (default: true)
  - [ ] 5.2 Add `focusAutoFlashcard?: boolean` to `AppSettings` interface (default: true)
  - [ ] 5.3 Add defaults to `DISPLAY_DEFAULTS`: `focusAutoQuiz: true`, `focusAutoFlashcard: true`
  - [ ] 5.4 Quiz/Flashcard components read these settings via `getSettings()`

- [ ] Task 6: Implement notification piercing for critical notifications (AC: 5)
  - [ ] 6.1 In `NotificationService` (`src/services/NotificationService.ts`), add priority levels if not already present
  - [ ] 6.2 Critical notifications (timer warning, connection loss, session expiry): render with z-index above focus overlay (z-60)
  - [ ] 6.3 Use Sonner toast positioning: critical toasts use `className` with elevated z-index
  - [ ] 6.4 Focus overlay is z-40; critical notifications must be z-50+

- [ ] Task 7: Implement notification suppression for non-critical notifications (AC: 6)
  - [ ] 7.1 When focus mode is active, intercept non-critical notification dispatches
  - [ ] 7.2 Queue suppressed notifications in an array
  - [ ] 7.3 On focus mode deactivate: flush the queue — show all suppressed notifications sequentially
  - [ ] 7.4 Expose `isFocusMode` state globally (context or event) so NotificationService can check

- [ ] Task 8: Implement first-time auto-activation tooltip (AC: 7)
  - [ ] 8.1 Check `localStorage.getItem('focus-auto-tooltip-dismissed')`
  - [ ] 8.2 If not dismissed and focus mode auto-activates: show tooltip
  - [ ] 8.3 Tooltip text: "Focus mode activated automatically. You can disable this in Settings."
  - [ ] 8.4 Tooltip dismisses on click or after 8 seconds
  - [ ] 8.5 On dismiss: set `localStorage.setItem('focus-auto-tooltip-dismissed', 'true')`
  - [ ] 8.6 Use Sonner toast with `duration: 8000` and `action` button linking to Settings

## Design Guidance

**Layout approach:** Event-driven architecture using `CustomEvent` on `window`. Quiz and Flashcard components emit events; `useFocusMode()` listens and reacts. Notification piercing uses z-index layering.

**Component structure:**
- `src/lib/focusModeEvents.ts` — event dispatch helpers (shared between components)
- Modified `useFocusMode()` — add event listeners for auto-activation
- Modified `Quiz.tsx`, `Flashcards.tsx`, `InterleavedReview.tsx` — emit events
- Modified `NotificationService.ts` — priority-based rendering

**Design system usage:**
- Tooltip: Sonner `toast.info()` with `duration: 8000` for first-time message
- No new UI components — this story is primarily logic/event wiring
- Critical notification z-index: above focus overlay (z-50+)

**Accessibility:**
- Auto-activation tooltip is aria-live (Sonner toasts have this by default)
- Critical notifications remain accessible in focus mode
- Non-critical suppression does not cause lost notifications — all queued and shown on exit

## Implementation Notes

**Dependency on E65-S03:** Requires `useFocusMode()` hook with `activateFocusMode()` and `deactivateFocusMode()`. The event listener integration extends the existing hook.

**Existing patterns to follow:**
- Custom events pattern already used: `settingsUpdated` event in `useContentDensity` at `src/hooks/useContentDensity.ts`
- `NotificationService` at `src/services/NotificationService.ts` — extend with priority levels
- `getSettings()` from `src/lib/settings.ts` — read auto-activation preferences
- `eventBus` at `src/lib/eventBus.ts` — check if this should be used instead of raw CustomEvent (prefer consistency with existing patterns)
- Sonner toast at `src/app/components/Layout.tsx` — existing toast configuration

**Key files to create:**
- `src/lib/focusModeEvents.ts` — NEW (event helpers)

**Key files to modify:**
- `src/hooks/useFocusMode.ts` — add event listeners for `focus-request`/`focus-release`
- `src/app/pages/Quiz.tsx` — emit focus events on start/complete
- `src/app/pages/Flashcards.tsx` — emit focus events on start/complete
- `src/app/pages/InterleavedReview.tsx` — emit focus events on start/complete
- `src/lib/settings.ts` — add `focusAutoQuiz`, `focusAutoFlashcard` to `AppSettings`
- `src/services/NotificationService.ts` — add priority levels, focus mode suppression

**Libraries:** No new dependencies.

**Event bus vs CustomEvent:** Check `src/lib/eventBus.ts` — if the project uses a typed event bus, prefer that over raw `CustomEvent` for type safety and consistency. If eventBus is just a thin wrapper around CustomEvent, either approach works.

**Notification priority classification:**
- Critical (pierces focus): timer warnings, connection loss, session expiry, auth errors
- Non-critical (suppressed): study reminders, course updates, achievement unlocks, streak notifications

**Queue flush strategy:** On focus mode exit, show queued notifications with 500ms delay between each to avoid overwhelming the user. If more than 5 queued, show a summary toast instead.

## Testing Notes

- E2E: Test quiz start auto-activates focus mode
- E2E: Test flashcard review auto-activates focus mode
- E2E: Test quiz completion auto-deactivates focus mode
- E2E: Test auto-activation disabled in settings prevents auto-focus
- E2E: Test critical notification appears above focus overlay
- E2E: Test non-critical notification suppressed during focus mode
- E2E: Test suppressed notifications appear after focus mode exits
- E2E: Test first-time tooltip appears on first auto-activation
- E2E: Test first-time tooltip does not reappear after dismissal
- Unit: Test event dispatch helpers — `dispatchFocusRequest`, `dispatchFocusRelease`
- Unit: Test notification queue — add, suppress, flush
- Unit: Test settings read for auto-activation preferences

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
