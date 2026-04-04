---
story_id: E65-S05
story_name: "Settings Integration and First-Time Discovery"
status: done
started: 2026-04-04
completed: 2026-04-04
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 65.5: Settings Integration and First-Time Discovery

## Story

As a learner,
I want to configure reading and focus mode defaults in Settings,
so that the modes start with my preferred configuration every time.

## Acceptance Criteria

**Given** I navigate to Settings > Display & Accessibility
**When** the section loads
**Then** I see a new "Reading & Focus Modes" subsection after "Motion Preference"
**And** it contains: Reading Mode Defaults (font size, line height, theme dropdowns) and Focus Mode (auto-activate toggles)

**Given** I change the Reading Mode default font size to 1.5x
**When** I next enter reading mode
**Then** the floating toolbar starts at 1.5x font size
**And** the content displays at 1.5x

**Given** I toggle "Auto-activate for quizzes" OFF
**When** I start a quiz
**Then** focus mode does NOT auto-activate

**Given** I click "Reset display settings to defaults"
**When** the reset dialog is confirmed
**Then** reading mode defaults reset to: font size 1x, line height 1.5, theme auto
**And** focus mode auto-activation resets to: quizzes ON, flashcards ON

**Given** I am a new user who has never used reading mode
**When** I visit a lesson page for the first time
**Then** a one-time tooltip appears near the reading mode button: "Try Reading Mode for distraction-free studying (Cmd+Shift+R)"
**And** the tooltip dismisses on click or after 8 seconds
**And** it does not appear again (localStorage flag `reading-mode-tooltip-dismissed`)

**Given** I am on mobile and visit a lesson page
**When** reading mode is active
**Then** a floating TOC button appears in the status bar
**And** tapping it opens a slide-up sheet with lesson section navigation

## Tasks / Subtasks

- [ ] Task 1: Extend `AppSettings` type with reading/focus mode defaults (AC: 1, 2, 4)
  - [ ] 1.1 Add to `AppSettings` in `src/lib/settings.ts`:
    - `readingFontSize?: '1x' | '1.25x' | '1.5x' | '2x'` (default: '1x')
    - `readingLineHeight?: 1.5 | 1.75 | 2.0` (default: 1.5)
    - `readingTheme?: 'auto' | 'sepia' | 'high-contrast'` (default: 'auto')
    - `focusAutoQuiz?: boolean` (default: true) — may already exist from E65-S04
    - `focusAutoFlashcard?: boolean` (default: true) — may already exist from E65-S04
  - [ ] 1.2 Add to `DISPLAY_DEFAULTS`: `readingFontSize: '1x'`, `readingLineHeight: 1.5`, `readingTheme: 'auto'`, `focusAutoQuiz: true`, `focusAutoFlashcard: true`

- [ ] Task 2: Create Settings UI section (AC: 1)
  - [ ] 2.1 Create `src/app/components/settings/ReadingFocusModesSection.tsx`
  - [ ] 2.2 Section heading: "Reading & Focus Modes" with BookOpen icon
  - [ ] 2.3 Reading Mode Defaults group:
    - Font size: `Select` dropdown with options 1x, 1.25x, 1.5x, 2x
    - Line height: `Select` dropdown with options 1.5, 1.75, 2.0
    - Theme: `Select` dropdown with options Auto, Sepia, High Contrast
  - [ ] 2.4 Focus Mode group:
    - "Auto-activate for quizzes" — `Switch` toggle
    - "Auto-activate for flashcards" — `Switch` toggle
  - [ ] 2.5 Follow layout pattern of existing `DisplayAccessibilitySection.tsx`
  - [ ] 2.6 Each control updates settings via `saveSettings()` and dispatches `settingsUpdated` event

- [ ] Task 3: Integrate section into Settings page (AC: 1)
  - [ ] 3.1 Import `ReadingFocusModesSection` in Settings page or DisplayAccessibilitySection
  - [ ] 3.2 Place after "Motion Preference" section
  - [ ] 3.3 Verify section renders correctly on desktop, tablet, and mobile

- [ ] Task 4: Wire settings to reading mode toolbar (AC: 2)
  - [ ] 4.1 Modify `ReadingToolbar` (E65-S02) to read initial values from `AppSettings` instead of only localStorage
  - [ ] 4.2 On reading mode activation: load defaults from `getSettings()`, then override with any session-level localStorage customization
  - [ ] 4.3 Priority: session localStorage > AppSettings defaults (user can customize per-session)

- [ ] Task 5: Wire settings to focus mode auto-activation (AC: 3)
  - [ ] 5.1 Verify Quiz/Flashcard components (E65-S04) read `focusAutoQuiz`/`focusAutoFlashcard` from `getSettings()`
  - [ ] 5.2 Toggle OFF in settings should immediately affect next quiz/flashcard start
  - [ ] 5.3 Dispatch `settingsUpdated` event so running components pick up changes

- [ ] Task 6: Extend reset dialog to include new settings (AC: 4)
  - [ ] 6.1 Find existing "Reset display settings to defaults" handler
  - [ ] 6.2 Add reading mode and focus mode fields to the reset logic
  - [ ] 6.3 Reset: readingFontSize='1x', readingLineHeight=1.5, readingTheme='auto', focusAutoQuiz=true, focusAutoFlashcard=true
  - [ ] 6.4 Also clear localStorage key `reading-mode-settings` (session toolbar preferences)

- [ ] Task 7: Implement first-time discovery tooltip for reading mode (AC: 5)
  - [ ] 7.1 Create `ReadingModeDiscoveryTooltip` component or use Sonner toast
  - [ ] 7.2 Check `localStorage.getItem('reading-mode-tooltip-dismissed')` on LessonPlayer mount
  - [ ] 7.3 If not dismissed: show tooltip near the reading mode toggle button
  - [ ] 7.4 Text: "Try Reading Mode for distraction-free studying (Cmd+Shift+R)"
  - [ ] 7.5 Dismiss on click or after 8 seconds
  - [ ] 7.6 On dismiss: `localStorage.setItem('reading-mode-tooltip-dismissed', 'true')`
  - [ ] 7.7 Use `Popover` from shadcn/ui anchored to the BookOpen button, or Sonner toast

- [ ] Task 8: Implement mobile reading mode TOC (AC: 6)
  - [ ] 8.1 Create `src/app/components/figma/ReadingModeTOC.tsx`
  - [ ] 8.2 Floating button in status bar (List icon from lucide-react)
  - [ ] 8.3 On tap: open `Sheet` from bottom with lesson section headings
  - [ ] 8.4 Each heading is a link that scrolls to the section and closes the sheet
  - [ ] 8.5 Only render on mobile (`useIsMobile()`) when reading mode is active
  - [ ] 8.6 Extract section headings from lesson content DOM (query `h2`, `h3` elements)

## Design Guidance

**Layout approach:** New settings section follows existing `DisplayAccessibilitySection` pattern. TOC is a Sheet component triggered by a floating button.

**Component structure:**
- `ReadingFocusModesSection` — settings panel with dropdowns and toggles
- `ReadingModeDiscoveryTooltip` — one-time Popover or toast
- `ReadingModeTOC` — mobile-only Sheet with section navigation

**Design system usage:**
- Settings: `Select` (shadcn/ui), `Switch` (shadcn/ui), `Label`, `Card` layout
- Section heading: `BookOpen` icon + "Reading & Focus Modes" text
- TOC Sheet: `Sheet` + `SheetContent` with `side="bottom"`
- TOC trigger: `Button variant="ghost" size="icon"` with `List` icon
- All colors: design tokens only (`text-foreground`, `text-muted-foreground`, `bg-card`)

**Responsive strategy:**
- Settings section: responsive grid (2 columns on desktop, 1 on mobile)
- TOC: mobile only — not shown on tablet/desktop
- Discovery tooltip: positioned relative to BookOpen button on all breakpoints

**Accessibility:**
- Settings controls: proper `Label` associations with `htmlFor`
- `Switch` toggles: `aria-label` for each ("Auto-activate focus mode for quizzes")
- TOC Sheet: `SheetTitle` for screen reader context
- Discovery tooltip: `role="tooltip"` or toast with aria-live

## Implementation Notes

**Dependencies:** Requires E65-S01 (reading mode toggle button), E65-S02 (toolbar settings), E65-S03 (focus mode), E65-S04 (auto-activation settings). This is the integration story that ties everything together in Settings.

**Existing patterns to follow:**
- `DisplayAccessibilitySection` at `src/app/components/settings/DisplayAccessibilitySection.tsx` — exact layout pattern to follow for the new section
- `saveSettings()` + `settingsUpdated` custom event pattern at `src/lib/settings.ts`
- `Sheet` with `side="bottom"` for mobile overlays — used throughout the app
- `Select` component at `src/app/components/ui/select.tsx`
- `Switch` component at `src/app/components/ui/switch.tsx`
- `Popover` at `src/app/components/ui/popover.tsx` — for discovery tooltip
- `useProgressiveDisclosure` at `src/app/hooks/useProgressiveDisclosure.ts` — may be useful for tooltip timing

**Key files to create:**
- `src/app/components/settings/ReadingFocusModesSection.tsx` — NEW
- `src/app/components/figma/ReadingModeTOC.tsx` — NEW

**Key files to modify:**
- `src/lib/settings.ts` — extend `AppSettings` and `DISPLAY_DEFAULTS`
- `src/app/pages/Settings.tsx` — import and render new section
- `src/app/components/figma/ReadingToolbar.tsx` — read initial values from AppSettings
- `src/app/pages/LessonPlayer.tsx` — add discovery tooltip and TOC button

**Libraries:** No new dependencies. Uses existing shadcn/ui Select, Switch, Sheet, Popover, Label.

**Settings priority chain:** AppSettings (persisted defaults) -> localStorage `reading-mode-settings` (session customization) -> toolbar controls (live changes). The toolbar saves to localStorage on change. AppSettings provides the initial defaults when no session customization exists.

**TOC heading extraction:** Use `document.querySelectorAll('h2, h3')` within the lesson content container. Map to `{ id, text, level }` for rendering. Each heading should have an `id` attribute for scroll-to targeting (verify LessonPlayer generates these).

## Testing Notes

- E2E: Verify "Reading & Focus Modes" section appears in Settings after Motion Preference
- E2E: Test changing reading font size default affects next reading mode activation
- E2E: Test toggling auto-activate for quizzes OFF prevents auto-focus
- E2E: Test reset button resets all reading/focus settings to defaults
- E2E: Test first-time tooltip appears on first lesson page visit
- E2E: Test tooltip does not reappear after dismissal
- E2E: Test mobile TOC button appears in reading mode
- E2E: Test TOC sheet opens and scrolls to selected heading
- Unit: Test settings persistence — save and read reading mode defaults
- Unit: Test settings priority chain — AppSettings vs localStorage vs live
- Accessibility: Verify Select/Switch label associations, Sheet title

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

**useCallback ordering matters for hooks exhaustive-deps:** The `dismiss` callback was defined *after* the `useEffect` that called it, requiring an eslint-disable comment to suppress the missing-dependency warning. Moving `useCallback` declarations before any `useEffect` that references them eliminates the need for eslint-disable and ensures the dependency array is correct (`[visible, dismiss]`). This is the correct pattern: define callbacks first, then effects that depend on them.

**Settings section testid visibility:** The `ReadingFocusModesSection` wraps its content in a `CardContent` with `data-testid="reading-focus-modes-section"`. E2E tests can assert both the testid presence and text content (e.g., `toContainText('Reading & Focus Modes')`) to confirm the section rendered correctly without relying on heading hierarchy.

**Focus mode toggles use `role="switch"`:** shadcn/ui `<Switch>` renders with `role="switch"`, not `role="checkbox"`. Playwright selectors should use `getByRole('switch', { name: '...' })` with the `aria-label` value to target toggles reliably across themes and viewport sizes.
