# Design Review — E18-S09: Configure Quiz Preferences in Settings

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright)
**Story**: E18-S09 — Configure Quiz Preferences in Settings
**Branch**: `feature/e18-s09-configure-quiz-preferences-in-settings`

**Changed Files Reviewed**:
- `src/app/components/settings/QuizPreferencesForm.tsx` (new)
- `src/app/pages/Settings.tsx` (modified — added `<QuizPreferencesForm />`)

**Affected Pages Tested**: `/settings`

**Viewports Tested**: 1440px (desktop), 768px (tablet), 375px (mobile)

---

## Executive Summary

The Quiz Preferences section is a well-crafted addition that integrates cleanly with the existing Settings page. The card-based radio group for timer accommodation uses the same visual pattern as the existing Appearance section, creating a consistent experience. Design token usage is clean throughout — no hardcoded hex values or Tailwind color classes were found. One WCAG AA contrast failure was identified (muted description text on the selected/active timer card background), and the Switch component's inactive state has a known non-text contrast gap that predates this story. Two accessibility improvements are recommended for the radio group labelling. No blockers prevent merge; the single High Priority item should be addressed before shipping to users with low vision needs.

---

## Blockers (Must fix before merge)

None.

---

## High Priority (Should fix before merge)

### H1 — Radio group items lack accessible labels for screen readers

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:86-101`

**Evidence**: The `RadioGroupItem` buttons (rendered as `role="radio"`) have no `aria-label`, no `aria-labelledby`, and no `id` to associate with the parent `<label>`. The Radix `RadioGroupItem` is rendered `sr-only` and its containing `<label>` wraps the visual content, but the label element itself has no `for`/`htmlFor` pointing to the radio input. Programmatic association relies on the `<label>` containing the radio as its descendant — which is valid HTML, but only when the radio button is not `sr-only` (hidden from the accessibility tree via `className="sr-only"`).

Audit result: all three `role="radio"` buttons show `ariaLabel: null` and `ariaLabelledby: null` in the computed ARIA tree. The associated `<label>` elements show `for: null` / `htmlFor: ""`.

**Impact**: Screen reader users navigating the timer accommodation group may hear "radio button, 1 of 3" with no indication of what "1x", "1.5x", or "2x" means, because the accessible name resolution from a `sr-only` wrapped radio + outer visual label is inconsistently supported across assistive technologies. This is a meaningful barrier for learners who use screen readers and need extended time accommodations — the very feature this control sets.

**Suggestion**: Add an `aria-label` directly to each `RadioGroupItem`, matching the visible label text and description. For example:
```
<RadioGroupItem
  value={option.value}
  aria-label={`${option.label} — ${option.description}`}
  className="sr-only"
/>
```
Alternatively, give each `RadioGroupItem` an `id` and add `htmlFor` to the wrapping `<label>`, which restores the standard programmatic association even when the input is visually hidden.

---

### H2 — Muted description text on selected timer card fails WCAG AA contrast

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:99`

**Evidence**:
- Text: `rgb(101, 104, 112)` — `--muted-foreground` token
- Background: `rgb(208, 210, 238)` — `--brand-soft` token (applied when selected)
- Computed contrast ratio: **3.75:1**
- WCAG AA requirement for normal text (< 18pt / < 14pt bold): **4.5:1**
- Status: **FAIL**

The description text ("Standard timing", "Extended time", "Maximum extension") at `text-xs` (12px) sits below the threshold when its card is in the selected/active state. In the unselected state the same text on `#FAF5EE` achieves 5.14:1 (pass), so the issue is specific to the selected highlighted background.

**Impact**: Learners with moderate low vision may be unable to read the description text on the selected option — precisely the state they need to read most to confirm their choice. This is particularly relevant for learners with visual impairments who use accommodation settings.

**Suggestion**: Replace `text-muted-foreground` on the description span inside timer cards with a conditional class that uses a higher-contrast token when selected:
```tsx
<span className={cn(
  'text-xs',
  prefs.timerAccommodation === option.value
    ? 'text-brand-soft-foreground'  // #3d46b8 on brand-soft = ~7.5:1
    : 'text-muted-foreground'
)}>
  {option.description}
</span>
```
`--brand-soft-foreground` (`#3d46b8`) achieves approximately 7.5:1 on `--brand-soft` background and is the semantically correct token for this context (matching how badges and labels use it).

---

## Medium Priority (Fix when possible)

### M1 — Switch component touch target is 18px tall on mobile (below 44px minimum)

**Location**: `src/app/components/ui/switch.tsx` (global component, not new code)

**Evidence**: Measured at 375px viewport:
```
immediate-feedback-toggle: width=32px, height=18px
shuffle-questions-toggle: width=32px, height=18px
```
The parent row has `min-h-[44px]` which meets the touch target requirement for the row height, but the interactive element itself (`role="switch"`) is 18px tall. On touch devices, the tappable area is constrained to the rendered component bounds, not the surrounding row.

**Impact**: Users with motor impairments or large fingers may miss the switch thumb on mobile. The WCAG 2.5.5 criterion (AAA) recommends 44x44px; WCAG 2.5.8 (AA, 2.2) recommends 24px minimum. At 18px this falls below even the AA 2.2 threshold.

**Note**: This is a pre-existing issue with the shared Switch component, not introduced by this story. Flagging here as the new toggles make it more prominent on a settings page where mobile users are likely to adjust preferences.

**Suggestion**: Add a transparent hit-area wrapper or increase the Switch component size. A common pattern is wrapping the switch in a `<div className="p-3 -m-3">` to expand the interactive tap zone without changing visual appearance.

---

### M2 — No visual "selected" indicator beyond color/border on timer cards

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:86-101`

**Evidence**: The Appearance section cards (for System/Light/Dark theme) include a small `bg-brand rounded-full` dot indicator when selected (`{theme === 'system' && <div className="w-2 h-2 bg-brand rounded-full" />}`). The timer accommodation cards use only border and background color to communicate selection — no supplementary non-color indicator.

```
Selected: borderColor=rgb(94,106,210), bg=rgb(208,210,238)
Unselected: borderColor=rgba(0,0,0,0.07), bg=rgb(250,245,238)
```

**Impact**: WCAG 1.4.1 requires that color is not the sole means of conveying information. While the contrast between selected and unselected border colors is visually clear for most users, users with certain color vision deficiencies (blue-yellow) may not distinguish the brand blue border from the neutral gray. Adding a small checkmark or dot (as used in the Appearance section) resolves this and improves visual consistency.

**Suggestion**: Add the same `bg-brand rounded-full` dot used in the Appearance section, or a checkmark icon:
```tsx
{prefs.timerAccommodation === option.value && (
  <div className="w-2 h-2 bg-brand rounded-full" aria-hidden="true" />
)}
```

---

### M3 — CardTitle type annotation says `div` but renders `h3`

**Location**: `src/app/components/ui/card.tsx:31`

**Evidence**:
```tsx
function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <h3 data-slot="card-title" ... />
```
The TypeScript props type is `ComponentProps<'div'>` but the element renders as `<h3>`. This is a minor inconsistency in the shared component — not introduced by this story — but worth noting since the `QuizPreferencesForm` relies on `CardTitle` for heading hierarchy. If someone later changes the props type to match the implementation, consumers could be affected.

**Impact**: Low. Heading hierarchy is correct in the DOM (H1 Settings → H3 Quiz Preferences → H3 Data Management etc.). The type mismatch will not cause a runtime error.

**Suggestion**: Update the shared component: `React.ComponentProps<'h3'>` or extract a `'div'` variant for cases where a heading is not appropriate.

---

## Low Priority (Nitpicks / Optional)

### L1 — Tablet viewport shows open sidebar overlaying content

**Location**: Layout / responsive behavior (pre-existing)

**Evidence**: At 768px the sidebar renders as an open drawer overlay, covering most of the Settings content. The Quiz Preferences section is partially visible behind the sidebar overlay in the tablet screenshot. This is a pre-existing behavior from the Layout component, not introduced by this story.

**Note**: No action needed for this story, but the behavior affects discoverability of settings on tablets.

---

### L2 — "Set your default quiz behavior — overridable per quiz" description uses em dash

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:60`

**Evidence**:
```tsx
Set your default quiz behavior — overridable per quiz
```

The em dash (`—`) is a typographically correct character, but the surrounding text reads somewhat informally. This is entirely stylistic and no change is needed.

---

### L3 — `CardTitle` `font-display` class on quiz section but not all other cards

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:59`

**Evidence**: The Quiz Preferences section uses `className="text-lg font-display"` on `CardTitle`. Several other new-style cards on Settings (Data Management, AI Configuration) also use `font-display`. However, the "Appearance" card's `CardHeader` uses `<h2 className="text-base leading-none">` without `font-display`. The inconsistency is in the older sections, not this story. The new card correctly follows the pattern established by Data Management and AI Configuration.

---

## What Works Well

1. **Consistent card pattern**: The Quiz Preferences card header (icon badge + title + description) matches the Data Management and AI Configuration cards exactly — icon in `rounded-full bg-brand-soft p-2`, `CardTitle` with `font-display`, subtitle with `text-sm text-muted-foreground`. This visual consistency builds learner confidence in the settings area.

2. **Design token hygiene**: Zero hardcoded hex colors or raw Tailwind color classes in the new file. All colors reference semantic tokens (`bg-brand-soft`, `text-brand`, `text-muted-foreground`, `border-brand`, `bg-background`). This is exactly the standard the project enforces.

3. **Timer radio card pattern mirrors Appearance section**: Reusing the `grid-cols-1 sm:grid-cols-3 gap-3` grid with `border-2 rounded-xl` cards for timer selection creates visual coherence — users who have already set their theme will immediately understand how to use the timer selector.

4. **Toast confirmation on every preference change**: Each individual change (timer, feedback toggle, shuffle toggle) triggers `toastSuccess.saved('Quiz preferences saved')`. The toast is visible, properly positioned, and uses the established toast helper pattern. Confirmed working in live testing (screenshot `dr-04-timer-selected-toast.png`).

5. **Mobile layout is clean**: At 375px the timer options correctly stack to single column, description text is readable, and the section title wraps gracefully ("Set your default quiz behavior — overridable per quiz"). No horizontal overflow detected. The toggle rows maintain their `min-h-[44px]` row height.

6. **Correct heading hierarchy**: H1 (Settings page title) → H3 (Quiz Preferences via CardTitle rendering `<h3>`). The section fits correctly in the established H1 → H3 pattern used by other settings cards.

7. **No console errors**: Zero JavaScript errors or React warnings were generated during the full test session including navigation, preference changes, and responsive resizing.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast 4.5:1 (normal text) | Partial | FAIL: muted description on selected timer card bg = 3.75:1 (H2 above) |
| Non-text contrast 3:1 (UI components) | Partial | FAIL: Switch inactive thumb = 1.71:1 (pre-existing, M1 above). Brand icon on soft bg = 3.16:1 (pass) |
| Keyboard navigation works | Pass | Tab order reaches quiz section; radio group keyboard-navigable via arrow keys (Radix handles internally) |
| Focus indicators visible | Pass | Global `*:focus-visible` rule applies brand-colored 2px outline; verified 4.70:1 contrast ratio |
| Heading hierarchy correct | Pass | H1 Settings → H3 Quiz Preferences — valid hierarchy |
| ARIA labels on icon buttons | Pass | SlidersHorizontal icon has `aria-hidden="true"`; switches have `id` matching `Label htmlFor` |
| Radio buttons accessible name | Fail | `role="radio"` buttons have no `aria-label` / `aria-labelledby` (H1 above) |
| Form labels associated with inputs | Pass | Switch labels use `htmlFor` matching switch `id`; confirmed programmatic association |
| Switch labels linked | Pass | `htmlFor="show-immediate-feedback"` and `htmlFor="shuffle-questions"` match switch `id` attributes |
| prefers-reduced-motion respected | Pass | Global `@media (prefers-reduced-motion: reduce)` in `src/styles/index.css` covers `transition-all` |
| Color not sole differentiator | Fail | Selected timer cards rely on color/border only — no secondary indicator (M2 above) |
| Semantic HTML | Pass | No `<div onClick>` patterns found; uses `<label>` wrapping for radio options (Radix pattern) |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Desktop (1440px) | Pass | Three-column timer grid, correct card proportions, no overflow |
| Tablet (768px) | Pass | Timer grid correctly collapses to 3-col (768px triggers `sm:` breakpoint); no horizontal overflow. Note: pre-existing sidebar overlay on tablet is a Layout concern, not this story |
| Mobile (375px) | Pass | Timer options stack single-column, description text wraps cleanly, toggle rows maintain 44px row height, no horizontal overflow |

---

## Recommendations (Prioritized)

1. **Fix radio group accessible names (H1)** — Add `aria-label` to each `RadioGroupItem` before merge. This directly affects users who depend on extended time accommodations, the exact user population this feature serves. A one-line change per option.

2. **Fix muted text contrast on selected timer card (H2)** — Replace `text-muted-foreground` with `text-brand-soft-foreground` (conditional on selected state). The token already exists in `theme.css`; no new infrastructure needed.

3. **Add non-color selected indicator to timer cards (M2)** — A 2px dot or checkmark matches the Appearance section pattern and closes the WCAG 1.4.1 gap. Copy the dot pattern from `Settings.tsx:504` into `QuizPreferencesForm`.

4. **Track Switch touch target size as a backlog item (M1)** — The 18px Switch height is a platform-wide issue. Consider a dedicated story to add a larger hit-area to the Switch component, benefiting all settings toggles across the app.
