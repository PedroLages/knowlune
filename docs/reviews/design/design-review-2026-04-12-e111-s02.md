# Design Review Report — E111-S02: Skip Silence & Speed Memory

**Review Date**: 2026-04-12
**Reviewed By**: Ava (design-review agent, Claude Sonnet 4.6 via Playwright MCP)
**Story**: E111-S02 — Skip Silence + Speed Memory for Audiobook Player
**Changed Files (UI-relevant)**:
- `src/app/components/audiobook/SilenceSkipIndicator.tsx` (new)
- `src/app/components/audiobook/SkipSilenceActiveIndicator.tsx` (new)
- `src/app/components/audiobook/SpeedControl.tsx` (modified)
- `src/app/components/audiobook/AudiobookSettingsPanel.tsx` (modified)
- `src/app/components/audiobook/AudiobookRenderer.tsx` (modified)

**Affected Route**: `/library/:bookId/read` (audiobook player)
**Test URL**: `http://localhost:5173/library/test-audiobook-e111-s02-a/read`

---

## Executive Summary

E111-S02 adds two new visual components to the audiobook player — a transient silence-skip notification badge and a persistent "Skip Silence" active indicator — and introduces per-book speed memory. The implementation is structurally sound: the new components use design tokens correctly, touch targets on primary controls all pass the 44px minimum, and the responsive layout holds at mobile (375px) without horizontal overflow. Several targeted issues need attention before merge, the most significant being invalid ARIA (nested interactive elements in the speed popover, `role="status"` duplicating `aria-live`), a touch target shortfall in the speed popover options, and a character inconsistency in `formatSpeed` between the two components.

---

## What Works Well

- All new components use design tokens (`bg-brand-soft`, `text-brand-soft-foreground`, `bg-brand`, `text-brand-foreground`) — no hardcoded colors detected.
- The `SilenceSkipIndicator` correctly uses `aria-hidden={!visible}` + `invisible/opacity-0` for the invisible-but-present-in-DOM pattern required by E2E tests.
- Primary playback controls (play/pause 64×64px, skip buttons 48×67px) comfortably exceed the 44px touch target floor at mobile.
- The `AudiobookSettingsPanel` section headings are properly marked up as `<section aria-labelledby>` with `<h3>` — correct landmark structure.
- Speed presets in the settings panel all meet the 44px minimum height (computed 44px with `min-h-[44px]`).
- The blurred cover background div carries `aria-hidden="true"` — decorative element correctly hidden.
- The `SkipSilenceActiveIndicator` pulse dot uses `motion-safe:animate-pulse`, respecting `prefers-reduced-motion`.
- `SilenceSkipIndicator` uses `aria-atomic="true"` so screen readers announce the complete badge text each time, not just the changed portion.
- No horizontal scroll at 375px mobile viewport.

---

## Findings by Severity

### Blockers (Must fix before merge)

None identified.

### High Priority (Should fix before merge)

**H1 — Invalid ARIA: nested interactive element inside `role="option"` (SpeedControl.tsx)**

`<li role="option">` contains a `<button>` child. The ARIA spec prohibits interactive elements inside `option` roles — `option` is not an interactive widget itself; interactivity belongs on the `option` role directly, or the `<button>` should replace the `option` role entirely. Screen readers in virtual browse mode may announce both the `option` and the `button`, creating a confusing double-announcement ("1.5× option — 1.5× button"). For learners using NVDA or VoiceOver, this makes the speed picker unnecessarily noisy.

- **Location**: `src/app/components/audiobook/SpeedControl.tsx:56-68`
- **Evidence**: Accessibility tree shows `option > button` nesting; computed `role="option"` on `<li>` wrapping `<button>`
- **Suggestion**: Remove `role="option"` and `aria-selected` from the `<li>` and instead apply the listbox pattern purely via the `<button>` elements, converting to `role="menuitem"` in a `role="menu"`, or use native `<select>` / a purpose-built combobox. The simplest fix that preserves current visual design: remove the `role="listbox"` / `role="option"` from `<ul>`/`<li>` and use `role="menu"` + `role="menuitem"` on the `<button>` directly, which permits interactive descendants.

**H2 — Speed popover options touch target too small (SpeedControl.tsx)**

Speed option buttons are 36px tall (computed). The design standard requires ≥44px on touch devices. A learner with motor impairment listening on a phone will have difficulty precisely tapping a speed option.

- **Location**: `src/app/components/audiobook/SpeedControl.tsx:58-67`
- **Evidence**: `getBoundingClientRect().height = 36` for `[data-testid="speed-option-0.5"]`
- **Suggestion**: Add `min-h-[44px]` to the button className, matching the approach used for speed presets in `AudiobookSettingsPanel.tsx:99`.

**H3 — `role="status"` + explicit `aria-live="polite"` are redundant on SkipSilenceActiveIndicator (SkipSilenceActiveIndicator.tsx)**

`role="status"` already implies `aria-live="polite"` per the ARIA spec. Specifying both explicitly is redundant and can confuse automated accessibility tools (axe flags it as a potential issue). More importantly, the element also has `aria-label` set conditionally — when `isActive=false` the `aria-label` attribute is `undefined`, which removes it entirely. This is correct, but combined with `aria-hidden="true"` and the redundant live region, the element's semantics are over-specified.

- **Location**: `src/app/components/audiobook/SkipSilenceActiveIndicator.tsx:17-19`
- **Evidence**: `role="status"` + `aria-live="polite"` both present in DOM
- **Suggestion**: Remove `aria-live="polite"` — keep `role="status"` alone. This simplifies the element and removes the redundancy.

### Medium Priority (Fix when possible)

**M1 — `formatSpeed` character inconsistency: `×` vs `x` (SpeedControl.tsx / AudiobookSettingsPanel.tsx)**

`SpeedControl.tsx` uses the Unicode multiplication sign `×` (U+00D7): `"1.5×"`. `AudiobookSettingsPanel.tsx` uses the ASCII letter `x`: `"1.5x"`. A learner who toggles their speed in the player sees `1.5×` on the speed button, then opens settings and sees `1.5x` presets. The mismatch looks like a different unit or scale. Screen readers also announce them differently ("times" vs "ex").

- **Location**: `src/app/components/audiobook/SpeedControl.tsx:22` vs `src/app/components/audiobook/AudiobookSettingsPanel.tsx:45`
- **Evidence**: `SpeedControl.formatSpeed` returns `` `${rate}×` ``; `AudiobookSettingsPanel.formatSpeed` returns `` `${rate}x` ``
- **Suggestion**: Extract a single `formatSpeed` utility (e.g., to `src/app/components/audiobook/formatSpeed.ts`) using `×` consistently, and import it in both components. This also eliminates a logic divergence (`rate % 1 === 0` vs `Number.isInteger(rate)` — functionally equivalent but not obviously so).

**M2 — "Default Speed" and "Default Sleep Timer" labels not associated with their controls (AudiobookSettingsPanel.tsx)**

The `<Label>` components for "Default Speed" (line 82) and "Default Sleep Timer" (line 145) have no `htmlFor` attribute. They are visually grouped with their `radiogroup` below, but screen readers cannot programmatically associate the label text with the group. The `radiogroup` itself has `aria-label="Default playback speed"` which partially compensates, but the `<Label>` text is not connected to the group and will be announced separately, creating redundancy (screen reader announces "Default Speed" as standalone text, then "Default playback speed radiogroup").

- **Location**: `src/app/components/audiobook/AudiobookSettingsPanel.tsx:82` and `145`
- **Evidence**: `label.htmlFor = null` for both "Default Speed" and "Default Sleep Timer" labels
- **Suggestion**: Either add `id` to the `radiogroup` div and use `aria-labelledby` pointing to both the `<Label>` and the group, or remove the standalone `<Label>` and rely solely on the `aria-label` on the `radiogroup`. The simplest fix: remove the `<Label>` wrappers and fold their text into the `aria-label` on the `radiogroup`.

**M3 — Skip Silence switch missing `aria-describedby` for help text (AudiobookSettingsPanel.tsx)**

The "Skip Silence" switch has a description paragraph ("Automatically skip silent sections during playback.") immediately below its label, but this description is not programmatically linked to the switch via `aria-describedby`. Screen readers will not announce the description when the switch receives focus, leaving learners who rely on AT without context for what the toggle does.

- **Location**: `src/app/components/audiobook/AudiobookSettingsPanel.tsx:116-130`
- **Evidence**: `skipSilenceSwitch.getAttribute('aria-describedby') === null`
- **Suggestion**: Add `id="skip-silence-description"` to the `<p>` and `aria-describedby="skip-silence-description"` to the `<Switch>`. Apply the same pattern to "Auto-Bookmark on Stop" (line 189-205).

**M4 — React key warning: `ChapterList` chapters without `id` produce duplicate `undefined` keys**

The `ChapterList` component uses `key={chapter.id}`. Test-seeded audiobooks (and potentially real ABS-imported books) may have chapters without an `id` field, causing all keys to be `undefined` and triggering a React console error: "Each child in a list should have a unique key prop." This produces a console error in the player which could mask other errors during E2E runs.

- **Location**: `src/app/components/audiobook/ChapterList.tsx:61`
- **Evidence**: Console error in browser: "Each child in a list should have a unique 'key' prop. Check the render method of ChapterList." Test book chapters `{ title: "Chapter 1" }` have no `id` field.
- **Suggestion**: Use a fallback key: `key={chapter.id ?? chapter.title ?? index}`. A composite fallback on `title` is more stable than index alone, but index is acceptable as last resort since chapter order is stable for a given book.

### Nitpicks (Optional)

**N1 — `SilenceSkipIndicator` has no `role` attribute**

The `SilenceSkipIndicator` wrapper `<div>` has `aria-live="polite"` and `aria-atomic="true"` but no explicit role. Adding `role="status"` (implied by `aria-live="polite"`) is not required but would make the semantics self-documenting and consistent with `SkipSilenceActiveIndicator` which does use `role="status"`.

- **Location**: `src/app/components/audiobook/SilenceSkipIndicator.tsx:47`

**N2 — `SPEED_OPTIONS` defined independently in both `SpeedControl` and `AudiobookSettingsPanel`**

`SpeedControl` defines its own `SPEED_OPTIONS = [0.5, 0.75, 1.0, ...]` array while `AudiobookSettingsPanel` imports `VALID_SPEEDS` from the store. The `SpeedControl` array does not include `2.25` and `2.75` that exist in the store's `VALID_SPEEDS`, meaning the player speed button offers fewer options than the settings panel. This is a functional mismatch surfaced by the design review, not a blocker, but worth aligning.

- **Location**: `src/app/components/audiobook/SpeedControl.tsx:19`

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light + dark) | Pass | Design tokens used throughout; no hardcoded colors |
| Touch targets ≥44px (primary controls) | Pass | Play 64px, skip ±48px, all secondary controls 44px |
| Touch targets ≥44px (speed popover) | Fail | Speed options 36px tall — see H2 |
| Keyboard navigation | Pass | Tab order logical; Escape closes panels |
| Focus indicators visible | Pass | Default Radix focus rings present |
| Heading hierarchy | Pass | H1 (title) → H2 (Chapters) → H3 (settings sections) |
| ARIA labels on icon buttons | Pass | All icon-only buttons have `aria-label` |
| Semantic HTML | Partial | Speed popover `option>button` nesting invalid — see H1 |
| Form labels associated | Partial | "Default Speed" / "Default Sleep Timer" labels unlinked — see M2 |
| `aria-describedby` for help text | Fail | Skip Silence and Auto-Bookmark switches missing — see M3 |
| `aria-live` regions | Partial | `role="status"` + `aria-live` redundant on SkipSilenceActiveIndicator — see H3 |
| `prefers-reduced-motion` | Pass | Pulse animation uses `motion-safe:animate-pulse` |
| No horizontal scroll at mobile | Pass | `scrollWidth === clientWidth` at 375px |
| Design tokens (no hardcoded colors) | Pass | All new components use theme tokens |
| Console errors | Fail | React key warning from ChapterList — see M4 |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass — no horizontal overflow, all primary controls meet touch targets, secondary controls bar fits within viewport (242px width in 375px viewport), layout renders single-column correctly.
- **Tablet (768px)**: Not independently tested — player layout is single-column centered (`max-w-lg mx-auto`) so tablet breakpoint is not a risk point.
- **Desktop (1440px)**: Pass — player centers within viewport, blurred background cover fills correctly.

---

## Detailed Findings Summary

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| H1 | HIGH | SpeedControl.tsx | 56–68 | `role="option"` wrapping `<button>` — invalid ARIA nesting |
| H2 | HIGH | SpeedControl.tsx | 58–67 | Speed option touch targets 36px (need ≥44px) |
| H3 | HIGH | SkipSilenceActiveIndicator.tsx | 17–19 | `role="status"` + `aria-live="polite"` redundant |
| M1 | MEDIUM | SpeedControl.tsx:22 / AudiobookSettingsPanel.tsx:45 | — | `×` vs `x` character inconsistency in `formatSpeed` |
| M2 | MEDIUM | AudiobookSettingsPanel.tsx | 82, 145 | "Default Speed" / "Default Sleep Timer" labels not associated |
| M3 | MEDIUM | AudiobookSettingsPanel.tsx | 116–130 | Skip Silence / Auto-Bookmark switches missing `aria-describedby` |
| M4 | MEDIUM | ChapterList.tsx | 61 | `key={chapter.id}` breaks when chapters have no `id` — React error in console |
| N1 | NIT | SilenceSkipIndicator.tsx | 47 | No `role="status"` on `aria-live` wrapper (minor, self-documenting) |
| N2 | NIT | SpeedControl.tsx | 19 | `SPEED_OPTIONS` not aligned with store's `VALID_SPEEDS` (functional gap) |

---

## Recommendations

1. **Fix H1 + H2 together** — the speed popover ARIA pattern needs rework regardless of touch targets. Converting to `role="menu"` / `role="menuitem"` on the `<button>` elements directly solves both: menus permit interactive children and the button height can then be set to `min-h-[44px]`.

2. **Address M1 (formatSpeed)** — extract a shared utility and use `×` consistently. This takes ~10 minutes and prevents the mismatch from confusing learners.

3. **Address M3 (aria-describedby on switches)** — the pattern is straightforward: add `id` to the description `<p>` and link it via `aria-describedby`. Apply to both "Skip Silence" and "Auto-Bookmark on Stop".

4. **Fix M4 (ChapterList key)** — one-line fix with a clear fallback: `key={chapter.id ?? chapter.title ?? index}`.
