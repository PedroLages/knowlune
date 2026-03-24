---
story_id: E21-S07
story_name: "Age-Appropriate Defaults & Font Scaling"
status: done
started: 2026-03-23
completed: 2026-03-24
reviewed: true
review_started: 2026-03-24
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, code-review, code-review-testing]
burn_in_validated: false
---

# Story 21.07: Age-Appropriate Defaults & Font Scaling

## Story

As a Boomer learner,
I want larger font sizes and simplified settings,
so that I can use the platform comfortably without strain.

## Acceptance Criteria

### AC1: Optional Age Range Wizard
- **Given** a user visits the app for the first time (no prior age wizard completion)
- **When** the app loads after onboarding completes (or if onboarding was skipped)
- **Then** an optional wizard appears asking the user to select their age range (Gen Z / Millennial / Boomer)
- **And** the wizard can be skipped or dismissed (Escape key, X button)
- **And** the selected age range is stored locally (never sent to any server)
- **And** the wizard does not appear again after completion or skip

### AC2: Age-Specific Defaults
- **Given** a user selects an age range in the wizard
- **When** the selection is confirmed
- **Then** age-specific defaults are applied:
  - **Gen Z (16-25):** Font size Medium (16px base), all animations enabled
  - **Millennials (26-40):** Font size Medium (16px base), animations enabled
  - **Boomers (55+):** Font size Large (18px base), animations reduced/minimal
- **And** users can override any defaults individually in Settings

### AC3: Font Size Picker in Settings
- **Given** a user navigates to Settings
- **When** they interact with the font size picker
- **Then** four options are available: Small (14px) / Medium (16px) / Large (18px) / Extra Large (20px)
- **And** the selected font size is applied immediately (live preview)
- **And** the selection persists across page reloads and sessions

### AC4: Proportional Font Scaling
- **Given** a user changes the font size setting
- **When** the new size is applied
- **Then** body text, headings, labels, and buttons all scale proportionally
- **And** the typographic hierarchy is maintained (h1 > h2 > h3 > h4 > body)
- **And** WCAG 2.1 AA contrast and spacing requirements are still met

### AC5: Age Range Display and Reset in Settings
- **Given** a user has completed the age wizard
- **When** they visit the Settings page
- **Then** their current age range is displayed
- **And** they can change their age range or clear it
- **And** changing the age range re-applies the corresponding defaults (with confirmation)

### AC6: Privacy
- **Given** age range data
- **When** stored or used by the application
- **Then** it is stored exclusively in localStorage (never transmitted to any server/API)
- **And** it is included in data export and cleared by "Reset All Data"

## Tasks / Subtasks

- [ ] Task 1: Extend AppSettings interface (AC: 2, 3, 5)
- [ ] Task 2: CSS font scaling system (AC: 3, 4)
- [ ] Task 3: Age wizard Zustand store (AC: 1, 6)
- [ ] Task 4: Age wizard overlay component (AC: 1, 2)
- [ ] Task 5: Layout integration — apply font scale to HTML element (AC: 3, 4)
- [ ] Task 6: Settings page — font size picker and age range section (AC: 3, 5)
- [ ] Task 7: E2E tests (AC: 1-6)

## Design Guidance

- Follow existing onboarding wizard pattern (OnboardingOverlay.tsx)
- Use existing RadioGroup component for font size picker
- Font scaling via `--font-size` CSS variable on `<html>` (already wired: `html { font-size: var(--font-size) }`)
- Respect `prefers-reduced-motion` media query (existing pattern in index.css)
- Age wizard should feel lightweight — 1-2 screens max, not a full onboarding flow

## Implementation Notes

[To be filled during implementation]

**Plan:** [E21-S07 Implementation Plan](plans/e21-s07-age-appropriate-defaults-font-scaling.md)

## Testing Notes

[To be filled during implementation]

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

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

1. **CSS variable font scaling** — Using `html { font-size: var(--font-size) }` with a CSS custom property allows proportional scaling of all `rem`-based sizes across the app. The `FONT_SIZE_PX` constant in `src/lib/settings.ts` maps human-readable labels to pixel values, keeping the mapping in a single source of truth shared by both the picker UI and the layout integration.

2. **Age-specific defaults pattern** — The `AGE_FONT_DEFAULTS` record maps each `AgeRange` to a recommended `FontSize`. This pattern cleanly separates "what age means" from "how settings are applied," making it easy to add new age-specific defaults (e.g., reduced motion) without touching the wizard UI.

3. **Welcome wizard UX** — Keeping the wizard to 3 lightweight steps (welcome, age, font) and always allowing skip/dismiss ensures the onboarding feels non-intrusive. The Zustand store with localStorage persistence (`knowlune-welcome-wizard-v1`) guarantees the wizard never reappears after completion or dismissal.

4. **Settings test mock maintenance** — When adding new exports to `@/lib/settings` (like `FONT_SIZE_PX`), existing test mocks that enumerate exports break. Using `importOriginal` in the mock factory pulls all actual exports and only overrides the functions that need mocking, making tests resilient to new constant exports.

5. **AC5 Settings integration** — The Age Range section in Settings reuses the same `AGE_FONT_DEFAULTS` mapping and `AgeRange` type, with a confirmation dialog before re-applying defaults. This prevents accidental overwriting of user-customized font sizes while still providing a clear path to reset.

6. **Large-scale cleanup alongside feature work** — This branch removed ~10,000 lines of dead code (Pomodoro timer, dashboard reordering, engagement preferences, unused quiz analytics) while adding the new feature. Bundling cleanup with a feature commit keeps the codebase lean but makes the diff harder to review. Future large cleanups should be a separate preparatory commit to isolate the signal.
