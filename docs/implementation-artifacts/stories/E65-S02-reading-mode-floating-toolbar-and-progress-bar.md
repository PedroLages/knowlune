---
story_id: E65-S02
story_name: "Reading Mode Floating Toolbar and Progress Bar"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 65.2: Reading Mode Floating Toolbar and Progress Bar

## Story

As a learner in reading mode,
I want to adjust font size, line height, and reading theme via a floating toolbar,
so that I can customize the reading experience to my visual preferences.

## Acceptance Criteria

**Given** I am in reading mode
**When** reading mode activates
**Then** a floating toolbar appears at the bottom center of the viewport
**And** the toolbar contains: font size controls (A-/A+), line height controls, theme toggle, and preset selector

**Given** the floating toolbar is visible
**When** I click the font size A+ button
**Then** the content font size increases to the next level (1x -> 1.25x -> 1.5x -> 2x)
**And** the change is immediate and visible in the content

**Given** the floating toolbar is visible
**When** I click the line height increase button
**Then** the content line height increases to the next level (1.5 -> 1.75 -> 2.0)

**Given** the floating toolbar is visible
**When** I click the theme toggle
**Then** the reading theme cycles through: Auto (follows system) -> Sepia -> High Contrast
**And** the background and text colors update accordingly

**Given** the floating toolbar is visible
**When** I select a preset from the dropdown
**Then** the font size, line height, and font settings update to match the preset
**And** available presets are: Compact (1x/1.5), Comfortable (1.25x/1.75), Large Print (1.5x/2.0), Dyslexia-Friendly (1.25x/2.0 + accessibility font)

**Given** I have not interacted with the toolbar for 3 seconds
**When** the auto-hide timer expires
**Then** the toolbar fades out (150ms transition)
**And** moving the mouse or touching the screen brings it back

**Given** reduced motion preference is ON
**When** the auto-hide behavior would trigger
**Then** the toolbar remains always visible (auto-hide disabled)

**Given** I am using keyboard navigation in reading mode
**When** I Tab to the toolbar
**Then** the toolbar becomes visible regardless of the auto-hide timer
**And** I can navigate between controls with arrow keys

**Given** I am in reading mode
**When** I scroll through the content
**Then** a 2px progress bar at the top of the viewport updates to reflect my scroll position
**And** the progress bar has role="progressbar" with aria-valuenow and aria-label

**Given** I change font size or line height in reading mode
**When** I exit and re-enter reading mode later in the same session
**Then** my toolbar settings are preserved (stored in localStorage)

## Tasks / Subtasks

- [ ] Task 1: Create `useAutoHide(timeout)` generic hook (AC: 6, 7, 8)
  - [ ] 1.1 Create `src/hooks/useAutoHide.ts`
  - [ ] 1.2 Accept `timeout` param (default 3000ms) and `disabled` boolean
  - [ ] 1.3 Track `isVisible` state, reset timer on mouse move, touch, or keyboard focus
  - [ ] 1.4 When `disabled` is true (reduced motion ON), always return `isVisible: true`
  - [ ] 1.5 Expose `isVisible`, `show()`, `resetTimer()`, ref for the target element
  - [ ] 1.6 Listen for `focusin` on target element to show on keyboard navigation

- [ ] Task 2: Create `ReadingToolbar` component (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [ ] 2.1 Create `src/app/components/figma/ReadingToolbar.tsx`
  - [ ] 2.2 Fixed position at bottom center (`fixed bottom-4 left-1/2 -translate-x-1/2`)
  - [ ] 2.3 Design: `bg-card border border-border rounded-2xl shadow-lg p-2 flex items-center gap-2`
  - [ ] 2.4 Font size controls: A- / A+ buttons with current level indicator (1x, 1.25x, 1.5x, 2x)
  - [ ] 2.5 Line height controls: decrease/increase with current level indicator (1.5, 1.75, 2.0)
  - [ ] 2.6 Theme toggle button cycling: Auto -> Sepia -> High Contrast
  - [ ] 2.7 Preset dropdown using `DropdownMenu` from shadcn/ui
  - [ ] 2.8 Integrate `useAutoHide(3000)` for auto-fade; disable auto-hide when reduced motion ON
  - [ ] 2.9 Apply fade transition: `opacity` 0/1 with 150ms, or instant if reduced motion
  - [ ] 2.10 Buttons: `variant="ghost"` with `size="sm"`, all 44px min touch targets
  - [ ] 2.11 z-index above content but below dialogs (z-40)

- [ ] Task 3: Implement reading typography CSS variables (AC: 2, 3, 10)
  - [ ] 3.1 Add CSS variables to `theme.css`: `--reading-font-size`, `--reading-line-height`
  - [ ] 3.2 Add CSS: `html.reading-mode main { font-size: var(--reading-font-size, 1rem); line-height: var(--reading-line-height, 1.5); }`
  - [ ] 3.3 Set variables via `document.documentElement.style.setProperty()` from toolbar controls
  - [ ] 3.4 Font size levels: 1rem (1x), 1.25rem (1.25x), 1.5rem (1.5x), 2rem (2x)
  - [ ] 3.5 Line height levels: 1.5, 1.75, 2.0

- [ ] Task 4: Implement reading theme styles (AC: 4)
  - [ ] 4.1 Auto theme: no override (uses current app theme)
  - [ ] 4.2 Sepia theme: `html.reading-mode.reading-sepia { --background: oklch(0.95 0.02 80); --foreground: oklch(0.25 0.02 60); }`
  - [ ] 4.3 High Contrast theme: `html.reading-mode.reading-hc { --background: oklch(0 0 0); --foreground: oklch(1 0 0); }`
  - [ ] 4.4 Toggle adds/removes class on `<html>`: `reading-sepia` or `reading-hc`

- [ ] Task 5: Implement presets (AC: 5)
  - [ ] 5.1 Define preset objects: Compact {fontSize: '1x', lineHeight: 1.5}, Comfortable {fontSize: '1.25x', lineHeight: 1.75}, Large Print {fontSize: '1.5x', lineHeight: 2.0}, Dyslexia-Friendly {fontSize: '1.25x', lineHeight: 2.0, accessibilityFont: true}
  - [ ] 5.2 Dyslexia-Friendly preset: temporarily enable Atkinson Hyperlegible font via `.reading-mode.reading-dyslexia` class
  - [ ] 5.3 Selecting a preset updates font size, line height, and optionally font simultaneously

- [ ] Task 6: Create `ReadingProgressBar` component (AC: 9)
  - [ ] 6.1 Create `src/app/components/figma/ReadingProgressBar.tsx`
  - [ ] 6.2 Fixed at top of viewport, full width, height 2px
  - [ ] 6.3 Color: `bg-brand` for filled portion, `bg-transparent` for unfilled
  - [ ] 6.4 Calculate scroll percentage: `scrollY / (scrollHeight - clientHeight) * 100`
  - [ ] 6.5 Update on `scroll` event with `requestAnimationFrame` throttling
  - [ ] 6.6 Add `role="progressbar"`, `aria-valuenow={percent}`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="Reading progress"`
  - [ ] 6.7 z-index above status bar (z-50)

- [ ] Task 7: Persist toolbar settings to localStorage (AC: 10)
  - [ ] 7.1 Storage key: `reading-mode-settings`
  - [ ] 7.2 Save on change: `{ fontSize, lineHeight, theme, lastPreset }`
  - [ ] 7.3 Restore on reading mode activation
  - [ ] 7.4 Settings persist across sessions (unlike reading mode state itself which is session-level)

- [ ] Task 8: Mobile-specific toolbar layout (UX-DR5)
  - [ ] 8.1 On mobile: toolbar fixed to bottom, full-width with safe-area padding
  - [ ] 8.2 Replaces BottomNav (already hidden by `data-theater-hide` from E65-S01)
  - [ ] 8.3 Compact layout: fewer controls visible, expand button for full controls

## Design Guidance

**Layout approach:** Floating toolbar uses `position: fixed` at viewport bottom center. Progress bar uses `position: fixed` at viewport top. Both only render when reading mode is active.

**Component structure:**
- `ReadingToolbar` — floating controls panel with auto-hide
- `ReadingProgressBar` — thin scroll indicator
- `useAutoHide` — reusable hook for auto-hiding UI elements

**Design system usage:**
- Toolbar: `bg-card border-border rounded-2xl shadow-lg` (follows shadcn Card pattern)
- Buttons: `variant="ghost"` `size="sm"` from Button component
- Dropdown: `DropdownMenu` + `DropdownMenuContent` + `DropdownMenuItem` from shadcn/ui
- Progress bar: `bg-brand` (uses design token, not hardcoded color)
- All text: `text-foreground` / `text-muted-foreground`

**Responsive strategy:**
- Desktop: toolbar centered at bottom, 400-500px max width
- Tablet: same as desktop but slightly wider
- Mobile: toolbar full-width at bottom, compact controls, safe-area padding

**Accessibility:**
- Progress bar: `role="progressbar"`, `aria-valuenow`, `aria-label`
- Toolbar buttons: `aria-label` on each control (e.g., "Increase font size", "Decrease line height")
- Keyboard: Tab navigates toolbar controls, arrow keys for fine control
- Auto-hide disabled when reduced motion is ON (toolbar always visible)
- Auto-hide paused when toolbar has keyboard focus

## Implementation Notes

**Dependency on E65-S01:** This story requires the `useReadingMode()` hook and `.reading-mode` CSS class from E65-S01. The toolbar and progress bar only render when `isReadingMode === true`.

**Existing patterns to follow:**
- `useContentDensity` at `src/hooks/useContentDensity.ts` — CSS class toggle + `settingsUpdated` event listener
- `shouldReduceMotion()` from `src/lib/settings.ts` — check this for auto-hide disable
- Theater mode CSS at `src/styles/theme.css:563` — CSS variable override pattern
- `DropdownMenu` components in `src/app/components/ui/dropdown-menu.tsx`

**Key files to create:**
- `src/hooks/useAutoHide.ts` — NEW
- `src/app/components/figma/ReadingToolbar.tsx` — NEW
- `src/app/components/figma/ReadingProgressBar.tsx` — NEW

**Key files to modify:**
- `src/styles/theme.css` — add reading typography CSS variables, sepia/high-contrast theme overrides
- `src/app/pages/LessonPlayer.tsx` — render `ReadingToolbar` and `ReadingProgressBar` when in reading mode

**Libraries:** No new dependencies. Uses existing shadcn/ui DropdownMenu, Button, lucide-react icons (Type, Minus, Plus, Palette, Settings2).

**Performance:** Progress bar scroll listener must use `requestAnimationFrame` throttling to avoid layout thrashing. Font size and line height changes use CSS variables (repaint only, no reflow of the DOM tree).

**Settings persistence vs state:** Reading mode ON/OFF is session-level React state (from E65-S01). But toolbar customization (font size, line height, theme) persists to `localStorage` so preferences survive across sessions. E65-S05 will later move these defaults to `AppSettings`.

## Testing Notes

- E2E: Verify toolbar appears when reading mode activates
- E2E: Test font size A+/A- buttons cycle through all levels
- E2E: Test line height controls cycle through levels
- E2E: Test theme toggle cycles Auto -> Sepia -> High Contrast -> Auto
- E2E: Test preset selection applies correct settings
- E2E: Test progress bar updates on scroll (check `aria-valuenow` changes)
- E2E: Test auto-hide behavior (wait 3s, verify toolbar fades)
- E2E: Test toolbar settings persist across reading mode sessions
- Unit: Test `useAutoHide` hook — visibility state, timer reset, disabled mode
- Accessibility: Verify `role="progressbar"` attributes, button `aria-label` values

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
