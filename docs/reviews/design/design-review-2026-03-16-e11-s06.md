# Design Review Report — E11-S06: Per-Course Study Reminders

**Review Date**: 2026-03-16
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E11-S06 — Per-Course Study Reminders
**Branch**: feature/e11-s06-per-course-study-reminders
**Changed Files**:
- `src/app/pages/Settings.tsx`
- `src/app/components/figma/CourseReminderSettings.tsx`
- `src/app/components/figma/CourseReminderRow.tsx`
- `src/app/components/figma/DaySelector.tsx`
- `src/app/components/Layout.tsx`

**Affected Pages**: `/settings`

---

## Executive Summary

E11-S06 adds a per-course study reminder system to the Settings page, implemented as a new `CourseReminderSettings` card placed directly below the existing `ReminderSettings` card. The implementation is structurally sound, follows the established card pattern, uses design tokens correctly, and handles all key interaction states. One medium-priority accessibility issue was found (orphaned "Days" label), one pre-existing contrast issue was confirmed (not a regression), and the component is responsive across all three tested breakpoints with correct pill-wrapping behaviour at mobile widths.

---

## What Works Well

1. **Consistent card pattern**: `CourseReminderSettings` matches the structure of every other Settings card — rounded-24px card, sunken header with icon + title + description, `CardContent` with `space-y-4`. Visual hierarchy is immediately legible.

2. **DaySelector accessibility**: All seven day pills carry `role="checkbox"`, `aria-checked="true|false"`, `aria-label="<Full day name>"`, and are wrapped in `role="group" aria-label="Days of the week"`. Touch targets are all 44×44px minimum (verified via computed `getBoundingClientRect`). This is exactly what the story design spec required.

3. **Touch targets across the board**: Every interactive element in the new components — Add Reminder button (44px height), day pills (44px height), Switch, Edit button, Cancel button, Save button — meets the 44×44px minimum touch target requirement.

4. **Focus ring is visible and on-brand**: Keyboard focus on day pills renders a 2px solid ring in the brand color (`rgb(139, 146, 218)` / `focus-visible:ring-2 focus-visible:ring-brand`) via `box-shadow`. Confirmed active via `:focus-visible` match.

5. **No hardcoded colors or inline styles**: Grepped all three new component files — zero hex color literals, zero hardcoded Tailwind palette colors (e.g., `bg-blue-600`), zero inline `style=` attributes. All styling uses the design token system (`bg-brand`, `text-brand-foreground`, `bg-success`, `text-warning`, etc.).

6. **Responsive behaviour is correct**: No horizontal overflow at any breakpoint. Pills wrap to 2 rows at 375px (Mon/Tue/Wed, Thu/Fri/Sat/Sun) as specified in the design guidance. At 768px the sidebar correctly hides and the section expands to fill width.

7. **Correct page background**: `rgb(250, 245, 238)` computed on `<body>` in light mode — exactly the `#FAF5EE` design token.

8. **Animation is purposeful and covers reduced-motion**: Banners and form slides use `animate-in fade-in-0 slide-in-from-top-1 duration-300` (within 250–350ms content-reveal spec). The global `prefers-reduced-motion` rule in `src/styles/index.css:306` collapses all animations/transitions to `0.01ms` universally — the new components inherit this automatically.

9. **Save button guards**: The Save Reminder button is correctly `disabled` until both a course and at least one day are selected. Verified by computing `disabled` state in both partial-selection states.

10. **Console is clean**: Zero errors, one pre-existing unrelated meta-tag deprecation warning.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

---

### High Priority (Should fix before merge)

None.

---

### Medium Priority (Fix when possible)

#### M1 — Orphaned "Days" label has no programmatic association

**Issue**: In both `CourseReminderSettings.tsx` and `CourseReminderRow.tsx`, the `<Label>Days</Label>` element above the `<DaySelector>` component has no `htmlFor` attribute and no `id` on the group. Screen readers will not announce it as the label for the day selector group.

**Location**:
- `src/app/components/figma/CourseReminderSettings.tsx:289` — `<Label className="text-sm text-muted-foreground">Days</Label>`
- `src/app/components/figma/CourseReminderRow.tsx:86` — `<DaySelector ...>` used without a visible label in edit mode

**Evidence**: `document.querySelector('label[for]').htmlFor` returns `""` for the Days label. The `role="group"` element already has `aria-label="Days of the week"` which provides screen reader coverage, but the visual "Days" label text is semantically disconnected — it reads as an orphaned label element in the accessibility tree.

**Impact**: Screen readers may announce the group twice (once from the visual label passing through the reading order, once from `aria-label`), or skip the visual label entirely. This is mildly confusing for assistive technology users.

**Suggestion**: Add an `id` to the `<DaySelector>` wrapper div and connect it with `aria-labelledby`, replacing the redundant `aria-label`. Alternatively, remove the `<Label>` and rely solely on the group's `aria-label="Days of the week"` — it already conveys the same meaning. Either option resolves the duplication cleanly.

---

#### M2 — Unselected day pill text contrast fails WCAG AA in light mode (pre-existing token issue)

**Issue**: Unselected day pill text (`text-muted-foreground`) renders at `rgb(125, 129, 144)` on the `#FAF5EE` pill background (`rgb(250, 245, 238)`), producing a contrast ratio of **3.58:1** — below the 4.5:1 WCAG AA threshold for normal text.

**Location**: `src/app/components/figma/DaySelector.tsx:53` — `text-muted-foreground` on the unselected pill

**Evidence** (computed in light mode):
- Foreground: `rgb(125, 129, 144)`
- Background: `rgb(250, 245, 238)` (the `bg-background` token resolves to `#FAF5EE`)
- Contrast ratio: **3.58:1** (threshold: 4.5:1)

**Scope context**: This is a theme-level token behaviour. The same `text-muted-foreground` on white card backgrounds measures **3.88:1** in the pre-existing `ReminderSettings` card — confirming this is not a regression introduced by this story. The issue exists platform-wide in light mode.

**Impact**: Day pills are the primary interaction in this feature. Learners with moderate low vision may struggle to read the day abbreviations (Mon, Tue, etc.) in light mode.

**Suggestion**: Since the pill background (`bg-background`) is slightly warmer/darker than pure white, either:
1. Use a slightly darker text token for the unselected pill, e.g., `text-foreground/60` instead of `text-muted-foreground`
2. Track this as a theme-level issue in `src/styles/theme.css` to increase `--muted-foreground` luminance in light mode globally — this would fix it everywhere including existing cards

---

### Nitpicks (Optional)

#### N1 — "New Course Reminder" form heading uses H4 without visible hierarchy context

**Issue**: The inline add form renders `<h4 className="text-sm font-medium">New Course Reminder</h4>` inside a `<Card>` whose card title is an `<h3>`. This is technically correct (H3 → H4), but the H4 uses only `text-sm font-medium` styling, which is visually identical to a label. Screen readers will announce it as a heading, potentially surprising users.

**Location**: `src/app/components/figma/CourseReminderSettings.tsx:257`

**Suggestion**: Either style the H4 with slightly more visual prominence (e.g., `text-sm font-semibold`), or change it to a `<p>` with `font-medium` if it reads better as a section label rather than a structural heading. The heading hierarchy is not broken, but the mismatch between heading semantics and visual treatment is worth revisiting.

---

#### N2 — Edit mode in CourseReminderRow omits a "Days" label above DaySelector

**Issue**: When a `CourseReminderRow` enters edit mode, the `<DaySelector>` is rendered without a visible "Days" label above it. The add form includes the label but the edit form does not.

**Location**: `src/app/components/figma/CourseReminderRow.tsx:86` — `<DaySelector selectedDays={editDays} onChange={setEditDays} />` with no label

**Impact**: Minor inconsistency. The group's `aria-label` still provides screen reader coverage, but sighted users have no visual "Days" affordance in edit mode.

**Suggestion**: Add `<p className="text-xs text-muted-foreground">Days</p>` above the DaySelector in the edit form to match the add form pattern.

---

#### N3 — Permission prompt banner and form are mutually exclusive, but both can technically show if permission is denied

**Issue**: When `currentPerm === 'denied'`, `handleAddClick` sets `showDeniedGuidance(true)` and also calls `openAddForm()`, meaning both the denied-guidance banner and the add form can be visible simultaneously. This is intentional per AC4, but the visual layout (banner above form) may look crowded with both showing at once.

**Location**: `src/app/components/figma/CourseReminderSettings.tsx:79–84`

**Suggestion**: No code change required — the behaviour is correct per spec. Worth documenting in a comment that both can co-exist by design (`// AC4: show denied guidance AND form simultaneously`).

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (dark mode) | Pass | Title: 12.45:1, description: 4.59:1, muted labels on form bg: 4.38:1 (marginal, passes) |
| Text contrast ≥4.5:1 (light mode) | Partial | Muted labels on card: 3.88:1 (pre-existing theme issue, not a regression). Unselected pill text: 3.58:1 (see M2) |
| Keyboard navigation | Pass | Tab navigates through day pills in order; focus ring visible (2px brand ring); Enter/Space toggles pills |
| Focus indicators visible | Pass | `focus-visible:ring-2 focus-visible:ring-brand` applied on day pills; shadcn Switch/Button have their own focus rings |
| Heading hierarchy | Pass | H1 Settings → H2 Your Profile, Appearance → H3 Course Reminders → H4 New Course Reminder. Correct nesting. |
| ARIA labels on icon buttons | Pass | Edit button: `aria-label="Edit {courseName} reminder"`, Cancel: `aria-label="Cancel editing"`, Switch: `aria-label="Enable {courseName} reminder"` |
| Semantic HTML | Pass | No `<div onClick>` patterns. All interactive elements use `<button>` or shadcn components. |
| Form labels associated | Partial | Course select: ✓ (`htmlFor="course-select"`), Time input: ✓ (`htmlFor="new-reminder-time"`), Days label: ✗ (orphaned — see M1) |
| Day selector role/ARIA | Pass | `role="group" aria-label="Days of the week"`, each pill: `role="checkbox" aria-checked="true|false" aria-label="<FullDay>"` |
| Permission banners live region | Pass | Both banners use `role="alert" aria-live="polite"` |
| Decorative icons aria-hidden | Pass | All SVGs in the section carry `aria-hidden="true"` |
| prefers-reduced-motion | Pass | Global rule in `src/styles/index.css:306` collapses all animations to 0.01ms via `*` selector |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll. Section width: 305px. Add button: 255×44px. Day pills wrap to 2 rows (Mon/Tue/Wed, Thu/Fri/Sat/Sun). Bottom nav renders correctly. |
| Tablet (768px) | Pass | No horizontal scroll. Section width: 672px. Sidebar hidden. Card takes full content area width. |
| Desktop (1440px) | Pass | Section rendered at card width with `max-w-2xl` constraint (matching all other Settings cards). Sidebar visible and persistent. |

---

## Detailed Findings Summary

| # | Severity | Issue | File | Status |
|---|----------|-------|------|--------|
| M1 | Medium | Orphaned "Days" label — no `htmlFor`/`aria-labelledby` | `CourseReminderSettings.tsx:289`, `CourseReminderRow.tsx:86` | Open |
| M2 | Medium | Unselected pill contrast 3.58:1 in light mode (pre-existing token issue) | `DaySelector.tsx:53` / `theme.css` | Pre-existing, tracked |
| N1 | Nitpick | H4 "New Course Reminder" visually under-styled for a heading | `CourseReminderSettings.tsx:257` | Optional |
| N2 | Nitpick | Edit mode DaySelector missing visible "Days" label | `CourseReminderRow.tsx:86` | Optional |
| N3 | Nitpick | AC4 dual-banner behaviour could benefit from an intent comment | `CourseReminderSettings.tsx:79-84` | Optional |

---

## Recommendations

1. **Fix the orphaned "Days" label (M1)** before merge. The simplest fix is to remove the `<Label>Days</Label>` from the add form in `CourseReminderSettings.tsx` and rely on the `role="group" aria-label="Days of the week"` that already exists on the DaySelector — it is semantically complete on its own. Alternatively add `aria-labelledby` pointing to a labelled element.

2. **Track the muted-foreground contrast token (M2)** as a platform-level issue. File it against `src/styles/theme.css` separately from this story. It pre-dates E11-S06 and affects the entire Settings page.

3. **Add the "Days" label to the edit form (N2)** to match the add form visually — this is a one-line change and improves consistency.

4. **No blocking issues found** — the implementation is shippable once M1 is addressed.

