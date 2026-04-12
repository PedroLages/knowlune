# Design Review Report — E111-S02: Skip Silence & Speed Memory

**Review Date**: 2026-04-12
**Reviewed By**: Ava (design-review agent, Claude Sonnet 4.6 via Playwright MCP)
**Story**: E111-S02 — Skip Silence Detection & Per-Book Speed Memory
**Branch**: feature/e111-s02-skip-silence-speed-memory
**Changed Files (UI-relevant)**:
- `src/app/components/audiobook/SkipSilenceActiveIndicator.tsx` (new)
- `src/app/components/audiobook/SilenceSkipIndicator.tsx` (new)
- `src/app/components/audiobook/AudiobookSettingsPanel.tsx` (modified)
- `src/app/components/audiobook/SpeedControl.tsx` (modified)
- `src/app/components/audiobook/AudiobookRenderer.tsx` (modified)
- `src/app/hooks/useSilenceDetection.ts` (new)
- `src/app/hooks/useAudiobookPrefsEffects.ts` (modified)

**Tested Route**: `/library/:id/read` (AudiobookRenderer)
**Test Book**: The Intelligent Investor Rev Ed. (`021013bb-d31a-447d-98ac-4334484cd4dd`)

---

## Executive Summary

E111-S02 adds silence detection with a persistent active-state pill (`SkipSilenceActiveIndicator`), a transient skip notification badge (`SilenceSkipIndicator`), a settings toggle in `AudiobookSettingsPanel`, and per-book speed memory in `SpeedControl`. The implementation is solid overall — design tokens are used correctly, touch targets for all primary controls meet the 44px minimum, no horizontal overflow at any breakpoint, and the accessibility ARIA structure is mostly correct. Three targeted issues require attention: the speed preset buttons in the settings panel are below the touch-target minimum, the active-state pill's `animate-pulse` dot is missing the `motion-safe:` guard used consistently elsewhere in the codebase, and the `SkipSilenceActiveIndicator` is missing an explicit `aria-live` attribute despite carrying `role="status"`.

---

## What Works Well

1. **Design token compliance**: All new components use `bg-brand-soft`, `text-brand-soft-foreground`, `bg-brand`, and `text-brand-foreground` — zero hardcoded hex colors. The ESLint token rule would catch regressions automatically.

2. **Primary control touch targets**: Every primary playback button (Play: 64×64, Skip Back/Fwd: 48×67, Speed: 52×44, Bookmark/Sleep/Settings: 44×44) meets the 44px minimum. Settings and bookmark buttons in the secondary bar also meet the minimum exactly.

3. **Transient indicator semantics**: `SilenceSkipIndicator` correctly uses `aria-live="polite"` and `aria-atomic="true"` on the wrapper div, so screen readers announce the "Skipped Xs silence" message without interrupting speech. The timeout+fade pattern is clean and respects existing interaction flow.

4. **Responsive layout**: No horizontal overflow at mobile (375px), tablet (768px), or desktop (1440px). The centered `max-w-lg` layout adapts gracefully, and h1 uses `truncate` for long titles.

5. **Per-book speed memory**: `SpeedControl` correctly calls `useBookStore.getState().updateBookPlaybackSpeed(bookId, rate)` on selection. Speed persists across page loads — confirmed live: reloading the reader showed 1.5× retained from the previous session.

6. **Settings panel ARIA structure**: The `AudiobookSettingsPanel` uses proper `radiogroup`/`radio` patterns, `<section aria-labelledby>`, `<Switch>` with `htmlFor` labels, and `<SheetTitle>`/`<SheetDescription>` — the full ARIA sheet structure is correct.

7. **Keyboard shortcut wired**: The `s` key toggles skip silence via `useKeyboardShortcuts` — discoverable through the keyboard shortcuts dialog.

---

## Findings by Severity

### High Priority (Should fix before merge)

**H1 — Speed preset buttons in settings panel: touch target below 44px minimum**
- **Location**: `src/app/components/audiobook/AudiobookSettingsPanel.tsx:99`
- **Evidence**: `min-h-[36px]` on the speed pill buttons. Measured height: 36px (< 44px requirement).
- **Impact**: On touch devices, users must tap with high precision to select a speed. Learners adjusting playback speed during a commute or workout are most likely to be affected. The sleep timer options in the same panel use a full-width row layout (`py-2` ≈ 40px via padding) but the speed pills are compact and fail on mobile.
- **Suggestion**: Change `py-1.5` to `py-2.5` (adds 4px top + bottom = 44px total) and verify the pill wrapping still looks correct at all speeds. Alternatively, increase `min-h-[36px]` to `min-h-[44px]`.

### Medium Priority (Fix when possible)

**M1 — `animate-pulse` on skip silence dot missing `motion-safe:` guard**
- **Location**: `src/app/components/audiobook/SkipSilenceActiveIndicator.tsx:26`
- **Evidence**: `className="inline-block size-1.5 rounded-full bg-brand-soft-foreground animate-pulse"`. The codebase's own convention (found in `ContinueLearning.tsx:187`, `figma/YouTubeImportDialog.tsx:526`, `reader/ClozeFlashcardCreator.tsx:238`) is `motion-safe:animate-pulse`. Bare `animate-pulse` plays for users who have enabled "Reduce Motion" in OS accessibility settings.
- **Impact**: Vestibular disorders can be aggravated by persistent looping animations. The dot pulses continuously whenever skip silence is active — which could be the entire listening session.
- **Suggestion**: Replace `animate-pulse` with `motion-safe:animate-pulse`. This matches the established pattern in the codebase and requires a single-word change.

**M2 — `SkipSilenceActiveIndicator` missing explicit `aria-live` on `role="status"` element**
- **Location**: `src/app/components/audiobook/SkipSilenceActiveIndicator.tsx:19-22`
- **Evidence**:
  ```
  role="status"
  aria-label={isActive ? 'Skip silence is active' : undefined}
  aria-hidden={!isActive}
  ```
  `role="status"` has an implicit `aria-live="polite"` per the ARIA spec, but `aria-label` on the container is set/cleared dynamically. When `isActive` becomes `true`, some screen reader + browser combinations announce the element change from `aria-hidden` but do not re-announce the `aria-label` without an explicit live region. The `SilenceSkipIndicator` sibling correctly uses an explicit `aria-live="polite"` on its wrapper div.
- **Impact**: Screen reader users toggling "Skip Silence" via the keyboard shortcut (`s`) or settings panel may not receive audible confirmation that the feature activated.
- **Suggestion**: Add `aria-live="polite"` explicitly to the outer div. Also consider whether `aria-label` needs to be present when inactive or if `aria-hidden="true"` alone is sufficient for the inactive state — removing `aria-label` when inactive is fine, but the live region declaration should be stable. Example:
  ```tsx
  <div
    data-testid="skip-silence-active-indicator"
    role="status"
    aria-live="polite"
    aria-label={isActive ? 'Skip silence is active' : undefined}
    aria-hidden={!isActive}
    ...
  >
  ```

**M3 — Section heading labels in settings panel use `text-xs uppercase` which may be low contrast**
- **Location**: `src/app/components/audiobook/AudiobookSettingsPanel.tsx:75,139,184`
- **Evidence**: `className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3"`. In dark mode, `text-muted-foreground` resolves to a mid-grey. Text at `text-xs` (12px) uppercase is considered "normal text" under WCAG (not large text, which requires 18px or 14px bold), so it requires 4.5:1 contrast. The muted foreground token in dark mode is designed to be low-contrast by intent (labels, hints), and these are purely decorative section dividers not conveying critical information — but they are used as `aria-labelledby` targets for the `<section>` landmark, making them functional labels.
- **Impact**: Low contrast on section labels reduces scanability for users with low vision, and since they are `aria-labelledby` targets, poor readability undermines the landmark's purpose.
- **Suggestion**: Either bump to `text-foreground` at reduced opacity (`text-foreground/60`) which gives slightly higher contrast while staying subtle, or accept the existing pattern as consistent with other settings panels in the codebase (check `EngagementPreferences.tsx` for prior precedent).

### Nitpicks

**N1 — `SilenceSkipIndicator` wrapper div has no semantic role**
- **Location**: `src/app/components/audiobook/SilenceSkipIndicator.tsx:46`
- **Evidence**: The outer `<div>` carries `aria-live="polite"` and `aria-atomic="true"` but no `role`. Per ARIA authoring practices, a live region benefits from `role="status"` (polite) to clarify intent.
- **Suggestion**: Add `role="status"` to the wrapper div. This is already the pattern on `SkipSilenceActiveIndicator` and makes the live region semantics explicit. Low priority since browsers handle bare `aria-live` live regions correctly.

**N2 — Settings speed presets use `text-[10px]` implicitly via pill container layout**
- The `SkipSilenceActiveIndicator` pill uses `text-[10px]` (10px) for the "Skip Silence" label. This is technically a "large text" threshold edge case at 10px — well below it. The colour pairing `text-brand-soft-foreground` on `bg-brand-soft` uses the dedicated foreground token designed to pass 4.5:1, so contrast should be acceptable. No action required, but worth verifying the token passes in both light and dark mode if the colour scheme changes.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (new components) | Pass | Brand-soft token pairing designed for this use case |
| Keyboard navigation — skip silence toggle | Pass | `s` key wired in `useKeyboardShortcuts` |
| Keyboard navigation — speed control | Pass | Popover opens via Enter/Space; arrow keys navigate the listbox |
| Focus indicators visible | Pass | Radix UI button/switch primitives retain focus rings |
| Heading hierarchy on reader page | Pass | H1 (book title) → H2 (Chapters) — no skipped levels |
| ARIA labels on icon buttons | Pass | Settings (44×44), Speed, Bookmark, Sleep Timer all have aria-label |
| Semantic HTML — settings vs div | Pass | `<button>`, `<section aria-labelledby>`, `<Switch>` via Radix |
| Cover image alt text | Pass | `alt="Cover of {book.title}"` |
| `aria-live` on transient skip notification | Pass | `aria-live="polite"` + `aria-atomic="true"` on SilenceSkipIndicator |
| `aria-live` on persistent active indicator | Warn | `role="status"` present but `aria-live` not explicit (M2) |
| `prefers-reduced-motion` on pulse dot | Fail | Missing `motion-safe:` guard (M1) |
| Touch targets ≥44px — primary controls | Pass | All primary playback buttons ≥44px |
| Touch targets ≥44px — settings speed pills | Fail | `min-h-[36px]` on speed presets (H1) |
| No horizontal overflow (mobile 375px) | Pass | `overflow-x: hidden` confirmed |
| Dark mode contrast — new components | Pass | Theme tokens used; no hardcoded values |
| `aria-hidden` toggles correctly on indicator | Pass | `aria-hidden={!isActive}` — hidden when inactive, announced when active |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass — no horizontal overflow; all primary controls render and are accessible; h1 truncates with ellipsis. Controls bar wraps correctly within the `max-w-lg` constraint.
- **Tablet (768px)**: Pass — player remains centred and full controls visible; no layout reflow issues.
- **Sidebar Collapse (1024px)**: Not directly tested (audiobook reader is a fullscreen overlay that bypasses the sidebar layout).
- **Desktop (1440px)**: Pass — centred layout with `max-w-lg` works well; no overflow.

---

## Recommendations

1. **Fix H1 first**: The `min-h-[36px]` on speed preset buttons in the settings panel is the highest-priority item since users will interact with these on mobile during playback configuration. One-line change.

2. **Fix M1 simultaneously** (`motion-safe:animate-pulse`): This is a single-keyword addition that aligns with the established codebase convention and respects vestibular accessibility needs. Zero visual change for users without reduced-motion preference.

3. **Address M2 before shipping**: The `aria-live` annotation on `SkipSilenceActiveIndicator` ensures screen reader users get confirmed feedback when the feature activates/deactivates. The fix is additive and non-breaking.

4. **Consider M3 in a polish pass**: The section label contrast in the settings panel is a lower-stakes issue since the labels are supplementary. If the settings panel gets a visual polish pass, address it then.

