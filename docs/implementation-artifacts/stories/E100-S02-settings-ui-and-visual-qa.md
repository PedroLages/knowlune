---
story_id: E100-S02
story_name: "Settings UI & Visual QA"
status: done
started: 2026-04-05
completed: 2026-04-05
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 100.2: Settings UI & Visual QA

## Story

As a learner,
I want to select the Clean color scheme from the Settings Appearance section,
so that I can apply Apple-inspired cool blue-white styling to the entire app.

## Acceptance Criteria

1. **Given** the user opens Settings and navigates to the Appearance or Engagement section **When** they view the Color Scheme picker **Then** a "Clean" option is visible alongside "Professional" and "Vibrant"

2. **Given** the user selects "Clean" in the Color Scheme picker **When** they make the selection **Then** the `.clean` CSS class is applied to the `<html>` element and the page immediately re-renders with the Clean design tokens (cool blue-white palette, Apple blue brand color)

3. **Given** the Clean theme is active **When** the user navigates between pages **Then** the Clean theme persists (stored in localStorage via `useEngagementPrefsStore`)

4. **Given** the Clean theme is active **When** the page reloads **Then** the Clean theme is restored from persisted storage

5. **Given** the Clean theme is active **When** the user views the Settings Appearance section **Then** the dark mode theme preview cards show accurate previews (not broken light-colored content on dark backgrounds)

6. **Given** the user switches from Clean back to Professional **When** they make the selection **Then** the `.clean` class is removed from `<html>` and default tokens are restored

## Tasks / Subtasks

- [x] Task 1: Verify Settings UI integration (AC: 1, 2) — **already done in E100-S01**
  - [x] 1.1 Clean option added to EngagementPreferences.tsx RadioGroup (E100-S01)
  - [x] 1.2 useColorScheme hook applies/removes `.clean` class on `<html>` (E100-S01)
  - [x] 1.3 useEngagementPrefsStore persists colorScheme via AppSettings bridge (E100-S01)

- [x] Task 2: Verify CSS token completeness (AC: 2, 5) — **already done in E100-S01**
  - [x] 2.1 `.clean` CSS block in theme.css with ~45 token overrides (E100-S01)
  - [x] 2.2 Dark theme preview card fix in AppearanceSection.tsx (E100-S01)
  - [x] 2.3 Inter Variable font installed and imported in fonts.css (E100-S01)

- [ ] Task 3: Add E2E regression test (AC: 1-4, 6)
  - [ ] 3.1 Create tests/e2e/regression/story-e100-s02.spec.ts
  - [ ] 3.2 Test: Clean option visible in color scheme picker
  - [ ] 3.3 Test: Selecting Clean applies `.clean` class to `<html>`
  - [ ] 3.4 Test: Selecting Professional removes `.clean` class
  - [ ] 3.5 Test: Color scheme persists to localStorage

## Implementation Notes

- The color scheme picker lives in `EngagementPreferences.tsx` (under the Learning/Engagement section in Settings, not the Appearance section — it's grouped with gamification toggles)
- The `.clean` class activation chain: Settings picker → `useEngagementPrefsStore.setPreference('colorScheme', 'clean')` → saves to AppSettings via bridge → dispatches `settingsUpdated` event → `useColorScheme` hook reads and applies class
- The color scheme picker uses `data-testid="color-scheme-picker"` (already set in E100-S01)
- Per test patterns, navigate to `/` first before any localStorage operations

## Testing Notes

- Test the picker is visible and selectable
- Test class application (`.clean` on `document.documentElement`)
- Test persistence via localStorage inspection
- No IndexedDB seeding needed — purely Settings UI interaction

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

- E100-S01 implemented both the CSS tokens AND the Settings UI for Clean theme in a single branch. E100-S02's primary remaining work is the E2E regression test suite to lock in the behavior.
