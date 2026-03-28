---
story_id: E51-S03
story_name: "Atkinson Hyperlegible Font Toggle with Lazy Loading"
status: in-progress
started: 2026-03-28
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 51.3: Atkinson Hyperlegible Font Toggle with Lazy Loading

## Story

As a learner with dyslexia or low vision,
I want to switch to Atkinson Hyperlegible font,
so that I can read course content more comfortably.

## Acceptance Criteria

**Given** the font toggle is OFF
**When** the user enables it
**Then** `--font-body` changes to Atkinson Hyperlegible and all body text updates instantly

**Given** the font toggle is ON
**When** the user disables it
**Then** `--font-body` reverts to DM Sans immediately

**Given** the font is enabled
**When** the page is reloaded
**Then** Atkinson Hyperlegible loads automatically on init (acceptable brief swap from DM Sans)

**Given** the font toggle is OFF and the user never enables it
**When** inspecting the network tab
**Then** the Atkinson Hyperlegible CSS is NOT included in the main bundle (no font request)

**Given** the font fails to load (e.g., dynamic import error)
**When** the toggle is enabled
**Then** the switch reverts to OFF and an error toast shows "Could not load accessibility font. Please try again."

**Given** the font toggle is ON
**When** the user looks at the Font subsection
**Then** a preview panel shows sample text in Atkinson Hyperlegible with "Atkinson Hyperlegible -- Braille Institute" attribution

## Tasks / Subtasks

- [x] Task 1: Create `accessibilityFont.ts` utility (AC: 1, 2)
  - [x] 1.1 Create `src/lib/accessibilityFont.ts`
  - [x] 1.2 Export `async function loadAccessibilityFont(): Promise<void>` that:
    - Dynamically imports `@fontsource/atkinson-hyperlegible`
    - Dynamically imports `@fontsource/atkinson-hyperlegible/700.css`
    - Sets `--font-body` on `document.documentElement` to `'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif`
  - [x] 1.3 Export `function unloadAccessibilityFont(): void` that restores `--font-body` to `'DM Sans', system-ui, -apple-system, sans-serif`

- [x] Task 2: Create `useAccessibilityFont` hook (AC: 1, 2, 3, 5)
  - [x] 2.1 Create `src/hooks/useAccessibilityFont.ts`
  - [x] 2.2 Read `accessibilityFont` from `getSettings()` on mount
  - [x] 2.3 Listen for `settingsUpdated` events (follow `useFontScale.ts` pattern)
  - [x] 2.4 When enabled: call `loadAccessibilityFont()` (async, with try/catch)
  - [x] 2.5 When disabled: call `unloadAccessibilityFont()`
  - [x] 2.6 On mount, if setting is already true, load the font
  - [x] 2.7 On load failure: revert setting via `saveSettings({ accessibilityFont: false })`, dispatch `settingsUpdated` event, show error toast "Could not load accessibility font. Please try again."

- [x] Task 3: Wire hook into App.tsx (AC: 3)
  - [x] 3.1 Import `useAccessibilityFont` from `@/hooks/useAccessibilityFont`
  - [x] 3.2 Call `useAccessibilityFont()` alongside existing `useFontScale()` and `useColorScheme()`

- [x] Task 4: Add font toggle to DisplayAccessibilitySection (AC: 1, 6)
  - [x] 4.1 Open `src/app/components/settings/DisplayAccessibilitySection.tsx`
  - [x] 4.2 Replace the Font subsection placeholder with:
    - Label: "Accessibility Font"
    - Description: "Use Atkinson Hyperlegible for improved readability (dyslexia, low vision)"
    - `<Switch>` bound to `settings.accessibilityFont`
    - `aria-label="Enable accessibility font"`
  - [x] 4.3 Add font preview panel (shown conditionally when enabled):
    - Container: `rounded-xl border border-border/50 bg-surface-sunken/30 p-4 mt-3`
    - Sample text: "The quick brown fox jumps over the lazy dog" + "0123456789 AaBbCcDdEeFf"
    - Attribution: "Atkinson Hyperlegible -- Braille Institute" in `text-xs text-muted-foreground`
    - Animate in: `animate-in fade-in-0 slide-in-from-top-1 duration-200` (respects reduced motion)
  - [x] 4.4 On change: call `onSettingsChange({ accessibilityFont: !settings.accessibilityFont })`

## Design Guidance

- **Switch row layout:** Label + description on left, Switch on right via `flex justify-between items-center`
- **Switch:** Use `<Switch>` from `@/app/components/ui/switch`
- **Preview panel:** `rounded-xl border border-border/50 bg-surface-sunken/30 p-4 mt-3`
- **Sample text:** `text-base` using inherited `font-family: var(--font-body)`
- **Attribution:** `text-xs text-muted-foreground italic`
- **Animation:** `animate-in fade-in-0 slide-in-from-top-1 duration-200` -- automatically suppressed by `.reduce-motion` CSS
- **Mobile:** Switch row stacks label above switch on <640px
- **All colors must use design tokens** -- no hardcoded Tailwind colors

## Implementation Notes

- **Dynamic import:** `@fontsource/atkinson-hyperlegible` is imported via `import()` -- Vite handles code splitting. The CSS files inject `@font-face` rules into the document. Once loaded, subsequent toggles just swap the CSS variable (no re-download).
- **Font variable:** `--font-body` is defined in `src/styles/theme.css:28` and used as the body font family. Overriding it via `document.documentElement.style.setProperty()` takes precedence.
- **Hook pattern:** Follow `src/hooks/useFontScale.ts` for event listener setup and `getSettings()` reading
- **Error handling:** Wrap `loadAccessibilityFont()` in try/catch. On failure, revert setting AND dispatch event so the UI updates. Use `toast.error()` from Sonner.
- **Files modified:** `src/lib/accessibilityFont.ts` (new), `src/hooks/useAccessibilityFont.ts` (new), `src/app/App.tsx`, `src/app/components/settings/DisplayAccessibilitySection.tsx`
- **Dependency installed in S01:** `@fontsource/atkinson-hyperlegible` is already installed by E51-S01

## Testing Notes

- **Unit tests (Vitest):**
  - `accessibilityFont.ts`: test `loadAccessibilityFont` sets `--font-body` CSS variable
  - `accessibilityFont.ts`: test `unloadAccessibilityFont` restores original `--font-body` value
  - `useAccessibilityFont`: test mount behavior when setting is true (calls loadAccessibilityFont)
  - `useAccessibilityFont`: test mount behavior when setting is false (does not call loadAccessibilityFont)
  - `useAccessibilityFont`: test error handling on load failure (reverts setting, shows toast)
- **E2E tests (Playwright):** `tests/e51-s03-accessibility-font.spec.ts`
  - Toggle font ON -> verify `--font-body` CSS variable contains "Atkinson Hyperlegible"
  - Toggle font OFF -> verify `--font-body` reverts to "DM Sans"
  - Verify preview panel appears when font is ON, disappears when OFF
  - Verify preview panel shows attribution text
  - Reload page with font enabled -> verify font re-applied
  - Verify font toggle has correct aria-label

## Dependencies

- **Depends on:** E51-S01 (AppSettings fields + DisplayAccessibilitySection shell + npm dependency)
- **Can parallel with:** E51-S02, E51-S04

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

### Dynamic Font Loading via CSS Variable Swap

The `@fontsource/atkinson-hyperlegible` package is code-split by Vite -- the CSS and font files are only fetched when `loadAccessibilityFont()` first calls `import()`. The CSS injection adds `@font-face` rules to the document, and the actual font swap happens by overriding the `--font-body` CSS custom property on `document.documentElement`. This approach means zero font payload in the main bundle when the toggle is off (AC4), and instant swaps on subsequent toggles since the `@font-face` rules persist in the document.

### Error Handling with Revert Strategy

When the dynamic import fails (network error, corrupt bundle, etc.), the hook must revert the `accessibilityFont` setting to `false`, dispatch a `settingsUpdated` event so the UI switch flips back, and show a `toast.error()`. The revert-then-notify pattern prevents the UI from showing an enabled state while the font is not actually loaded. This is tested explicitly in `useAccessibilityFont.test.ts` via a mocked rejection.

### @font-face Rules Persist After Disable (Acceptable)

When the user disables the accessibility font, `unloadAccessibilityFont()` restores `--font-body` to DM Sans but does not remove the injected `@font-face` rules from the document. This is harmless -- the browser only downloads/renders fonts that are actively referenced by computed styles. Removing `<style>` elements injected by `@fontsource` would require tracking them, adding complexity for no user-facing benefit.

### Font CSS in PWA Precache (Acceptable)

The Vite PWA plugin may include the font CSS chunk in its precache manifest since it is a static asset produced by the build. This is acceptable behavior -- the precached CSS is small (a few hundred bytes of `@font-face` rules), and the actual font files are only fetched when the CSS is applied to the document. Users who never enable the toggle pay only the manifest entry cost, not the font download.
