# Traceability Report: Epic 21 — Engagement & Adaptive Experience

**Generated:** 2026-03-24
**Scope:** E21-S03 through E21-S07 (5 stories, 27 acceptance criteria)
**Coverage:** 85% (23/27 ACs covered)
**Gate Decision:** CONCERNS

---

## Summary

| Story | ACs | Covered | Gaps | Coverage |
|-------|-----|---------|------|----------|
| E21-S03: Pomodoro Focus Timer | 7 | 7 | 0 | 100% |
| E21-S04: Visual Energy Boost | 4 | 3 | 1 | 75% |
| E21-S05: Engagement Preference Controls | 5 | 5 | 0 | 100% |
| E21-S06: Smart Dashboard Reordering | 6 | 4 | 2 | 67% |
| E21-S07: Age-Appropriate Defaults & Font Scaling | 6 | 4 | 2 | 67% |
| **Total** | **27** | **23** | **4** | **85%** |

---

## E21-S03: Pomodoro Focus Timer

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Timer button in lesson header, popover shows 25:00 | `AC1: timer button is visible and opens popover with default 25:00` | `returns idle phase with default 25-minute focus duration` | COVERED |
| AC2 | Focus countdown to 00:00, switches to break | `AC2: start transitions to focus phase`, `AC2: pause freezes countdown, resume continues`, `AC2: reset returns to idle state`, `AC2: skip advances from focus to break` | `focus -> break transition fires onFocusComplete and auto-starts break`, `countdown decrements after 1 second`, `pause freezes the countdown`, `resume continues countdown` | COVERED |
| AC3 | Break countdown to 00:00, session counter increments | `AC3: session counter increments after full cycle` | `break -> idle transition increments session counter` | COVERED |
| AC4 | Session counter display | `AC3: session counter increments after full cycle` (checks "0 sessions" then "1 session") | `break -> idle transition increments session counter` | COVERED |
| AC5 | Start/pause/resume/reset controls | `AC2: start transitions...`, `AC2: pause freezes...`, `AC2: reset returns...` | `start transitions to focus/running`, `pause freezes`, `resume continues`, `reset returns to idle` | COVERED |
| AC6 | Preferences persistence (localStorage) | `AC4: preferences persist across page reloads` | N/A (E2E validates end-to-end) | COVERED |
| AC7 | Audio notification on phase completion | `AC5: audio notification fires via AudioContext` | N/A | COVERED |

**Additional coverage:** Accessibility test (ARIA attributes), preferences toggle test (auto-start break).

---

## E21-S04: Visual Energy Boost

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Vibrant colors +15% saturation, WCAG AA compliance | `vibrant brand foreground on brand background meets 4.5:1`, `dark vibrant brand foreground on brand background meets 4.5:1`, `vibrant mode overrides --brand with OKLCH value` | N/A | COVERED |
| AC2 | Noticeably saturated vs Professional, interactive elements distinguishable | `vibrant mode overrides --brand`, `--success token`, `momentum tier tokens` | N/A | COVERED |
| AC3 | Professional mode unchanged, no regression | `does not apply .vibrant class by default`, `professional mode uses standard brand color token`, `explicitly set professional mode does not add .vibrant class`, `legacy settings without colorScheme default to professional` | N/A | COVERED |
| AC4 | `prefers-reduced-motion` instant color transition | N/A | N/A | **GAP** |

**Gap detail:**
- **AC4 (prefers-reduced-motion):** No test verifies that color transitions are instant when `prefers-reduced-motion` is enabled. A test should emulate the media query via `page.emulateMedia({ reducedMotion: 'reduce' })` and verify no CSS transition is applied during scheme switching.

---

## E21-S05: User Engagement Preference Controls

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Engagement Preferences section with toggles | `should display all four feature toggles and color scheme picker` | N/A | COVERED |
| AC2 | Toggles control feature visibility (streaks, achievements, badges, animations) | `should hide study streak calendar when streaks toggle is OFF`, `should show study streak calendar when streaks toggle is ON`, `should hide achievement banner when achievements toggle is OFF`, `should hide momentum badges when badges toggle is OFF`, `should store animations preference as OFF`, `should toggle animations OFF via Settings and verify persistence` | N/A | COVERED |
| AC3 | Color scheme picker (Professional/Vibrant) | `should show Professional as selected by default`, `should show Vibrant option as disabled` | N/A | COVERED |
| AC4 | localStorage persistence | `should preserve toggle state after page reload`, `should persist OFF state and keep streak section hidden after reload` | N/A | COVERED |
| AC5 | Default state for new users | `should default all toggles to ON and color scheme to Professional` | N/A | COVERED |

**Note:** AC3 shows Vibrant as "coming soon" (disabled) which is correct per implementation notes — E21-S04 vibrant palette is available but the picker defers full integration.

---

## E21-S06: Smart Dashboard Reordering

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Track section interactions (scroll, click, hover >2s) | N/A (IntersectionObserver tracking is tested indirectly via AC2 auto-reorder) | N/A | **GAP** |
| AC2 | Auto-reorder by relevance (frequency x recency x duration, 7-day data) | `AC2: should auto-reorder sections based on seeded relevance stats` | N/A | COVERED |
| AC3 | Manual drag-and-drop override | `AC3: should render sections in manually-specified order from localStorage` | N/A | COVERED (partial) |
| AC4 | Pin to top | `should pin a section to the top`, `should unpin a previously pinned section` | N/A | COVERED |
| AC5 | Reset to default | `should reset to default order`, `should show reset button only when manually ordered` | N/A | COVERED |
| AC6 | Keyboard accessibility (Space + Arrow keys for drag) | `customizer panel should be keyboard accessible` (ARIA attributes only) | N/A | **GAP** |

**Gap details:**
- **AC1 (Interaction tracking):** No direct test verifies that scrolling a section into view or clicking it records an interaction event in localStorage. The auto-reorder test (AC2) seeds pre-computed stats but doesn't validate the tracking mechanism itself.
- **AC6 (Keyboard drag reordering):** The test verifies ARIA attributes (`aria-expanded`, `role="region"`) but does not test the actual keyboard drag flow (focus handle, press Space, use Arrow keys to move section, verify `aria-live` announcement). This is a functional gap.
- **AC3 note:** Tested via localStorage seeding (deterministic) rather than actual drag simulation. This validates the rendering code path but not the drag-and-drop interaction itself. Acceptable per the story's testing notes.

---

## E21-S07: Age-Appropriate Defaults & Font Scaling

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Optional age range wizard (first visit, skip/dismiss, stored locally, no repeat) | `shows wizard on first visit and closes on skip`, `does not show wizard on subsequent visits`, `completes full wizard flow: age selection -> font size -> finish` | N/A | COVERED |
| AC2 | Age-specific defaults (Gen Z: Medium/animations, Millennials: Medium/animations, Boomers: Large/reduced) | `completes full wizard flow` (verifies Boomer -> Large 18px) | N/A | COVERED (partial) |
| AC3 | Font size picker (Small/Medium/Large/XL, live preview, persistence) | `font size picker changes root font-size`, `font size persists across page navigation` | N/A | COVERED |
| AC4 | Proportional font scaling (headings scale, hierarchy maintained) | `heading hierarchy is maintained at different font sizes` | N/A | COVERED |
| AC5 | Age range display and reset in Settings | N/A | N/A | **GAP** |
| AC6 | Privacy (localStorage only, data export, reset all data) | N/A | N/A | **GAP** |

**Gap details:**
- **AC5 (Age range in Settings):** No test verifies that the Settings page displays the user's age range, allows changing it, or re-applies defaults with confirmation dialog.
- **AC6 (Privacy):** No test verifies that age data is never transmitted to a server, is included in data export, or is cleared by "Reset All Data." The localStorage-only storage is implicitly validated by other tests but the export/reset flows are untested.
- **AC2 note:** Only Boomer defaults are tested (Large/18px). Gen Z and Millennial age-specific defaults (Medium/16px, animations enabled) are not explicitly verified. This is a minor gap since the mapping logic is straightforward.

---

## Test File Inventory

| File | Type | Story | Tests |
|------|------|-------|-------|
| `tests/e2e/regression/e21-s03-pomodoro-timer.spec.ts` | E2E | E21-S03 | 10 |
| `src/hooks/__tests__/usePomodoroTimer.test.ts` | Unit | E21-S03 | 14 |
| `tests/e2e/regression/story-e21-s04.spec.ts` | E2E | E21-S04 | 12 |
| `tests/e2e/regression/story-e21-s05.spec.ts` | E2E | E21-S05 | 11 |
| `tests/e2e/dashboard-reordering.spec.ts` | E2E | E21-S06 | 12 |
| `tests/e2e/regression/story-e21-s07.spec.ts` | E2E | E21-S07 | 5 |
| **Total** | | | **64** |

---

## Gaps Summary

| # | Story | AC | Gap | Severity | Recommendation |
|---|-------|-----|-----|----------|----------------|
| 1 | E21-S04 | AC4 | `prefers-reduced-motion` not tested | MEDIUM | Add test with `page.emulateMedia({ reducedMotion: 'reduce' })` |
| 2 | E21-S06 | AC1 | Interaction tracking mechanism untested | LOW | Add test that scrolls section into view and verifies localStorage entry |
| 3 | E21-S06 | AC6 | Keyboard drag reorder flow untested (ARIA only) | MEDIUM | Add test: focus handle -> Space -> ArrowDown -> verify order change + aria-live |
| 4 | E21-S07 | AC5 | Age range display/change in Settings untested | MEDIUM | Add test navigating to Settings, verifying age display, changing age range |
| 5 | E21-S07 | AC6 | Privacy guarantees (export, reset) untested | LOW | Add test for "Reset All Data" clearing age range from localStorage |

---

## Gate Decision: CONCERNS

**Rationale:** Overall coverage is 85% (23/27 ACs) which is above the typical 80% threshold for PASS. However, three MEDIUM-severity gaps exist across two stories:

1. **E21-S04 AC4** — `prefers-reduced-motion` is an accessibility requirement with no test validation
2. **E21-S06 AC6** — Keyboard accessibility for drag reordering is only partially tested (ARIA attributes but not functional flow)
3. **E21-S07 AC5** — Age range settings page integration is completely untested

These gaps represent functional requirements that could regress silently. The decision is CONCERNS rather than FAIL because:
- The core feature paths are well-tested (timer lifecycle, color scheme switching, preference toggles, section reordering, wizard flow, font scaling)
- Unit test coverage for usePomodoroTimer is thorough (14 tests)
- WCAG contrast ratio validation in E21-S04 is exemplary (programmatic verification)
- The gaps are additive tests on existing features, not missing coverage of critical paths
