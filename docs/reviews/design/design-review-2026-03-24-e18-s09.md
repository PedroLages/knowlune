# Design Review Report — E18-S09: Configure Quiz Preferences in Settings

**Review Date**: 2026-03-24
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E18-S09 — Configure Quiz Preferences in Settings
**Changed Files**:
- `src/app/components/settings/QuizPreferencesForm.tsx` (new, 154 lines)
- `src/app/pages/Settings.tsx` (modified — `QuizPreferencesForm` added at line 566)
- `src/app/pages/Quiz.tsx` (modified — reads `quizPreferences` on init)
**Affected Pages Tested**: `/settings`

---

## Executive Summary

E18-S09 delivers a clean, well-structured Quiz Preferences section that integrates naturally into the existing Settings page. All three acceptance criteria (AC1, AC2, AC4) pass in live browser testing. The component uses design tokens throughout with no hardcoded colors, follows the established card pattern used by Data Management and AI Configuration sections, and auto-saves each change with a toast confirmation. Two accessibility concerns require attention before merge: the radio card labels lack a distinct focus ring when focused via keyboard (the selected-state border alone cannot serve as a focus indicator), and the `radiogroup` element is missing an `aria-labelledby` association to its visible heading.

---

## What Works Well

- **AC1 fully satisfied**: All three controls (timer radio group, immediate feedback toggle, shuffle questions toggle) are present and render correctly at all viewports.
- **AC4 defaults confirmed**: Fresh load shows `timerAccommodation: standard` (1x selected), `showImmediateFeedback: false`, `shuffleQuestions: false` — matching `DEFAULT_QUIZ_PREFERENCES` in `src/lib/quizPreferences.ts`.
- **AC2 persistence confirmed**: Every control change immediately writes to `localStorage` (`levelup-quiz-preferences`) and shows a "Quiz preferences saved" toast. Cross-tab sync via `quiz-preferences-updated` custom event is implemented.
- **Design token compliance**: No hardcoded hex colors or raw Tailwind palette classes detected. The component uses `bg-brand-soft`, `text-brand`, `border-brand`, `text-muted-foreground`, `bg-background`, `border-border` — all semantic tokens.
- **Card pattern consistency**: Header structure (`border-b border-border/50 bg-surface-sunken/30`, icon badge, `CardTitle`, description) exactly matches the Data Management and AI Configuration sections in the same Settings page.
- **Card border radius**: Verified `24px` via `getComputedStyle` — matches the platform standard.
- **Body background**: `rgb(250, 245, 238)` — correct warm off-white.
- **Heading hierarchy**: Quiz Preferences card renders as `H3` (via `CardTitle`), consistent with sibling sections (Study Reminders, Course Reminders, AI Configuration, Data Management all use H3). Hierarchy is H1 > H2 > H3 > H4.
- **Switch associations**: Both `<Label htmlFor="show-immediate-feedback">` and `<Label htmlFor="shuffle-questions">` are correctly associated to their switch inputs via matching `id` attributes.
- **Switch keyboard activation**: Space key activates/deactivates the switch when focused. Confirmed `data-state` transitions from `unchecked` to `checked`.
- **Icon accessibility**: `SlidersHorizontal` icon correctly carries `aria-hidden="true"`.
- **Transition timing**: Timer card `transition: 0.2s` — within the 150–200ms spec for quick interactions.
- **`prefers-reduced-motion` CSS**: Present in the stylesheet — platform-level compliance confirmed.
- **No console errors or warnings** on page load or interaction.
- **Mobile layout**: No horizontal scroll at 375px. Timer grid correctly collapses to single column (`266px` computed, full-width). Toggle rows have `min-h-[44px]` and computed height of 54px — meet the 44px touch target requirement.
- **Tablet layout**: Timer grid correctly renders 3-column (`~199px x 3`) at 768px.

---

## Findings by Severity

### Blockers (Must fix before merge)

#### BLOCKER-1: Radio card labels have no distinct keyboard focus indicator

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:86–101`

**Evidence**: When the sr-only `RadioGroupItem` button (tabindex=0, position:absolute, clip:rect(0,0,0,0)) receives programmatic keyboard focus, the parent `<label>` card shows `borderColor: rgb(94, 106, 210)` — the brand blue. However, this is the same border style used for the *selected* state (`border-brand bg-brand-soft`). For the currently-selected card, focus is completely invisible: the card already has the brand border, so nothing changes when it receives focus. For unselected cards, the border does change from `border-border` on ArrowRight, but this only occurs because the arrow key immediately *selects* the next option (Radix roving tabindex moves selection with arrow keys), not because a focus ring is applied. There is no separate focus ring, `outline`, or `box-shadow` applied on the label when `:focus-within` is triggered.

This fails **WCAG 2.1 SC 2.4.7** (Focus Visible) and **SC 2.4.11** (Focus Appearance, AA in WCAG 2.2). Keyboard-only learners cannot determine which timer card currently has focus independently of which option is selected.

**Impact**: Learners who navigate entirely by keyboard — including users with motor disabilities or low vision who rely on keyboard navigation — cannot determine which timer card is focused. On the selected card, there is zero visual change when keyboard focus arrives, making the control appear non-interactive.

**Suggestion**: Add a `:focus-within` ring to the label card using a `has-focus-visible` Tailwind modifier or a CSS custom class. Since Tailwind v4 supports arbitrary variants, a targeted approach:

```tsx
className={cn(
  'relative flex flex-col gap-1.5 p-4 border-2 rounded-xl cursor-pointer',
  'transition-all duration-200 hover:shadow-sm',
  'has-[[data-radix-collection-item]:focus-visible]:ring-2',
  'has-[[data-radix-collection-item]:focus-visible]:ring-ring',
  'has-[[data-radix-collection-item]:focus-visible]:ring-offset-2',
  prefs.timerAccommodation === option.value
    ? 'border-brand bg-brand-soft shadow-sm'
    : 'border-border bg-background hover:border-brand/50'
)}
```

Alternatively, add a plain CSS rule in a component stylesheet or use the existing pattern from the Appearance section (which uses the same card pattern) once that section is audited.

---

### High Priority (Should fix before merge)

#### HIGH-1: `radiogroup` lacks `aria-labelledby` — timer group label is not announced

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:77–103`

**Evidence**: The `<RadioGroup data-testid="timer-accommodation-group">` element has `role="radiogroup"` but `aria-label: null` and `aria-labelledby: null`. The visible label "Timer accommodation default" is a `<Label>` element rendered in a sibling `<div>`, not structurally connected to the `radiogroup`.

```json
{
  "role": "radiogroup",
  "ariaLabel": null,
  "ariaLabelledby": null
}
```

Screen readers will announce the group as an unnamed radio group, losing the "Timer accommodation default" context. JAWS typically reads: "radio group" with no name, leaving the user to infer context from surrounding content.

**Impact**: Learners using screen readers won't know the purpose of the radio group until they navigate into it. This is disorienting for the growing segment of learners with visual disabilities.

**Suggestion**: Assign an `id` to the `<Label>` and reference it via `aria-labelledby`:

```tsx
<Label id="timer-accommodation-label" className="text-sm font-medium">
  Timer accommodation default
</Label>
...
<RadioGroup
  aria-labelledby="timer-accommodation-label"
  data-testid="timer-accommodation-group"
  ...
>
```

#### HIGH-2: Switch focus ring appears absent at runtime

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:121–127, 143–149`

**Evidence**: When the `Switch` buttons (`role="switch"`) are focused, computed styles show:
```json
{
  "outline": "oklab(0.708 0 0 / 0.5) none 0px",
  "outlineWidth": "0px",
  "boxShadow": "none"
}
```

`outline-style` is `none` and `box-shadow` is zero — no focus ring is rendered. This is likely a platform-wide Switch styling issue rather than specific to this component, but it surfaces here.

**Note**: This may be a pre-existing issue inherited from the shadcn `Switch` component configuration. Confirm by checking if `focus-visible:ring-2 focus-visible:ring-ring` classes are in the Switch component at `src/app/components/ui/switch.tsx`.

**Impact**: Keyboard users tabbing between the two toggle rows cannot see which switch is focused, violating WCAG 2.1 SC 2.4.7 (Focus Visible).

**Suggestion**: Inspect `src/app/components/ui/switch.tsx` and verify the `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` classes are present. If already present, check if a CSS reset or Tailwind base layer is overriding them.

---

### Medium Priority (Fix when possible)

#### MEDIUM-1: Auto-save triggers a toast on every single toggle change — potential toast fatigue

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:44–49`

**Evidence**: `toastSuccess.saved('Quiz preferences saved')` is called on every `onValueChange` and `onCheckedChange`. Toggling the shuffle switch on and off twice rapidly shows 4 toasts. Given that this is a preferences form with multiple controls, learners adjusting all three preferences will see 3+ toasts in rapid succession.

**Impact**: Toast fatigue reduces the signal value of toasts across the app. Learners in flow may find repeated notifications disruptive, especially during the initial setup of their preferences.

**Suggestion**: Consider a 600–800ms debounce on the toast (not on the save — saves should remain immediate) so that rapid successive changes produce a single "saved" confirmation. The `saveQuizPreferences` logic itself can remain synchronous and immediate; only the toast notification needs debouncing.

#### MEDIUM-2: Timer radio cards use `<label>` with no `htmlFor` — screen reader association relies entirely on nesting

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:86–101`

**Evidence**: The timer option `<label>` elements have no `htmlFor` attribute:
```json
{
  "tag": "LABEL",
  "htmlFor": null,
  "hasHiddenRadio": true
}
```

The association relies on the `<RadioGroupItem>` being a child of the `<label>`. This is valid HTML but some legacy screen readers handle implicit label association inconsistently. The sr-only `RadioGroupItem` buttons have no `id` either.

**Impact**: Minor — modern screen readers (NVDA, JAWS, VoiceOver) handle implicit label association. This is a defensive improvement.

**Suggestion**: Either add unique `id` values to each `RadioGroupItem` and `htmlFor` to each `<label>`, or add a `aria-label` to each `RadioGroupItem` as a fallback (e.g., `aria-label="1x — Standard timing"`).

#### MEDIUM-3: Card header uses `CardTitle` but Settings page profile card uses `h2` directly — minor inconsistency

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:59` vs. `src/app/pages/Settings.tsx:325`

**Evidence**: The Profile card uses `<h2 className="text-lg font-display">Your Profile</h2>` directly, while QuizPreferencesForm (and Data Management, AI Configuration) use `<CardTitle className="text-lg font-display">`. `CardTitle` renders as an `H3` in this context. This is not wrong — the hierarchy is valid — but the Profile and Appearance cards' direct `h2` usage creates inconsistency in how card headers are semantically marked up.

**Impact**: No functional issue. The heading hierarchy resolves correctly regardless. Minor maintainability concern.

**Suggestion**: Standardize all Settings card section headers to use `CardTitle` (which renders contextually based on composition, typically as a heading), or use explicit heading tags throughout. Either approach is fine; consistency matters more than which one is chosen.

---

### Nitpicks (Optional)

#### NITPICK-1: Description text in card header uses inline `mt-1` but component spec uses `space-y` pattern

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:60–62`

The description paragraph uses `mt-1` manually while the rest of the header flex container could use `space-y-1`. Functionally identical, cosmetically consistent with sibling sections.

#### NITPICK-2: `data-testid="timer-option-150%"` uses `%` in testid

**Location**: `src/app/components/settings/QuizPreferencesForm.tsx:95`

The `%` character in `data-testid` values can occasionally cause issues with CSS selector-based queries in some test frameworks. All current Playwright tests use `getByTestId` (attribute query), which is safe. A minor future-proofing improvement would be `timer-option-150pct` or `timer-option-1.5x`.

---

## Acceptance Criteria Verification

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | Quiz Preferences section visible with all 3 controls | PASS | `sectionVisible: true`, all 3 `data-testid` selectors found |
| AC2 | Persistence with toast confirmation | PASS | localStorage updated on each change, "Quiz preferences saved" toast confirmed |
| AC3 | (Not in scope for this review — per-quiz override) | N/A | — |
| AC4 | Default values: 1x timer, feedback off, shuffle off | PASS | `timer1xClasses` includes `border-brand bg-brand-soft`, both toggles `data-state="unchecked"` |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 | Pass | Card title `rgb(28,29,43)` on white: ~19:1. Muted text `rgb(101,104,112)` on white: ~4.6:1 — borderline pass. Verify in dark mode. |
| Keyboard navigation | Partial | RadioGroup is reachable; switches are Tab-navigable and Space-activated. Arrow keys work within radio group. |
| Focus indicators visible | **FAIL** | Radio cards: no distinct focus ring beyond selected-state border (BLOCKER-1). Switches: no focus ring visible (HIGH-2). |
| Heading hierarchy | Pass | H1 > H2 > H3 (Quiz Preferences) — correct progression |
| ARIA labels on icon buttons | Pass | `SlidersHorizontal` icon has `aria-hidden="true"` |
| RadioGroup labeled | **FAIL** | `radiogroup` has no `aria-label` or `aria-labelledby` (HIGH-1) |
| Switch labels associated | Pass | `htmlFor` / `id` pairs verified for both switches |
| Form labels associated | Pass | Both switches correctly labeled via `<Label htmlFor>` |
| `prefers-reduced-motion` | Pass | CSS media query found in stylesheet |
| No console errors | Pass | Zero errors/warnings on load or interaction |
| Semantic HTML | Pass | `radiogroup`, `switch` roles correct; heading hierarchy valid |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll. Timer grid: single column (266px full-width). Toggle rows: 54px height (exceeds 44px min). No overflow. |
| Tablet (768px) | Pass | No horizontal scroll. Timer grid: 3-column (`~199px x 3`) — responsive `sm:grid-cols-3` kicks in correctly at 640px breakpoint. |
| Desktop (1440px) | Pass | Timer grid: 3-column. Full layout intact. Card `max-w-2xl` constraint respected. |

---

## Recommendations

1. **Fix BLOCKER-1 first**: Add a `:focus-within` focus ring to the timer card `<label>` elements. This is a focused CSS change — no logic changes required. The `has-[[data-radix-collection-item]:focus-visible]:ring-2` Tailwind v4 approach is clean.

2. **Fix HIGH-1 alongside BLOCKER-1**: Adding `aria-labelledby` to `<RadioGroup>` is a one-line change that pairs naturally with the fix for BLOCKER-1 since both touch the same component.

3. **Investigate HIGH-2 (Switch focus ring)**: Check `src/app/components/ui/switch.tsx` to confirm whether this is a pre-existing platform issue or introduced here. If platform-wide, log a separate ticket rather than blocking this story.

4. **Consider debouncing toast for MEDIUM-1**: A 600ms debounce on the success toast (not the save) would improve the experience for users who adjust multiple preferences in quick succession.

---

## Files Reviewed

- `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/settings/QuizPreferencesForm.tsx`
- `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/Settings.tsx`
- `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/Quiz.tsx`
- `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/quizPreferences.ts`
- `/Volumes/SSD/Dev/Apps/Knowlune/.claude/workflows/design-review/design-principles.md`
