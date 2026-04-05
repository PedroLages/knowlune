# Design Review: Global Consistency Tokens

**Review Date**: 2026-04-04
**Reviewed By**: Claude Code (design-review agent — code analysis + provided screenshots)
**Scope**: Two global design token changes affecting all pages
**Changed Files**:
- `src/app/components/ui/card.tsx` — `rounded-[24px]` → `rounded-2xl`
- `src/app/components/ui/tabs.tsx` — default variant changed from `default` to `brand-pill`

---

## Executive Summary

Two targeted token changes were made to improve visual consistency across the app: card border radius was reduced from 24px to 16px to match the video player's radius, and the tab default variant was switched to `brand-pill` to propagate brand-colored active states everywhere without per-site opt-in. Both changes work correctly for the primary consumer paths. However, three tab callsites that were written assuming the old `default` variant (with `flex-1` triggers and a muted pill background) now silently break their full-width layout intent — the triggers no longer fill the container width. These are functional regressions that need targeted fixes.

---

## What Works Well

- The `rounded-2xl` token (`--radius-2xl` = `0.625rem + 6px` = **16px**) is mathematically correct and matches the video player border radius. The change is clean and token-based — no hardcoded pixel values introduced.
- The `brand-pill` default elegantly eliminates scattered `variant="brand-pill"` props from pages that already relied on the default (My Class, Reports, Notes). These pages now get the intended brand-color active state with zero code changes.
- `BelowVideoTabs.tsx` already explicitly passed `variant="brand-pill"`, so it is unaffected and continues to work correctly.
- `EditCourseDialog.tsx` passes `flex-1` on each trigger manually, so the `w-full` tab list there continues to stretch correctly even with the new default.
- `ThumbnailPickerDialog.tsx` fully overrides both `TabsList` and `TabsTrigger` styling via className, so the default change has no visible effect on it.
- The `Authors.tsx` page uses `rounded-3xl` explicitly on its hero cards, which is intentional for that page's larger hero treatment and is unaffected by the card.tsx default change.

---

## Findings by Severity

### Blockers (Must fix before merge)

None. No layout is completely broken, and no content is inaccessible.

### High Priority (Should fix before merge)

**1. PlayerSidePanel tabs no longer fill full width**
- **Location**: `src/app/components/course/PlayerSidePanel.tsx:182`
- **Issue**: `TabsList className="w-full shrink-0 px-1"` is intended to create a full-width tab bar spanning the side panel. The old `default` variant added `flex-1` to each trigger, evenly distributing them. The new `brand-pill` default has no `flex-1` on triggers, so the tabs now cluster left with dead whitespace on the right side.
- **Impact**: The lesson player side panel is the most-used surface in the app — learners spend the majority of their time there. A visually misaligned tab bar feels unpolished and makes tab labels harder to scan.
- **Suggestion**: Add `variant="default"` to this `TabsList` and each `TabsTrigger` to restore the original full-width fill behavior. Alternatively, add `flex-1` directly on each `TabsTrigger` className if the brand-pill style is preferred here.

**2. AuthDialog / Login page tabs no longer fill full width**
- **Location**: `src/app/components/auth/AuthDialog.tsx:71` and `src/app/pages/Login.tsx:84`
- **Issue**: Both use `TabsList className="w-full h-11"` to create a full-width authentication method switcher (Email / Magic Link / Google). Like the side panel above, `flex-1` from the `default` trigger variant is now missing. The three auth tabs will cluster left with empty space at right.
- **Impact**: Authentication is the first experience for new users. An unbalanced tab bar creates a visual jitter and undermines trust before the user has even signed in.
- **Suggestion**: Add `variant="default"` to both `TabsList` and each `TabsTrigger` in these two files, or add `className="flex-1"` to each `TabsTrigger`. The muted-background pill style was arguably intentional here since auth forms sit on a card surface already.

### Medium Priority (Fix when possible)

**3. Reports tab height constraint may clip brand-pill**
- **Location**: `src/app/pages/Reports.tsx:274`
- **Issue**: The Reports `TabsList` passes `className="h-11"` (44px fixed height). The `brand-pill` list has `h-auto p-1`, which with a rounded trigger of `py-1.5` (12px padding × 2 + ~20px text = ~44px natural height) should fit. However, the fixed `h-11` override sets a max, not a min. If the brand font renders slightly taller than expected, the triggers could be cropped. The old `default` variant used `min-h-[44px]`, which was explicitly elastic.
- **Impact**: Minor visual clipping risk, particularly on Windows/Android where DM Sans renders slightly taller.
- **Suggestion**: Change `h-11` to `min-h-[44px]` to match the accessibility-safe floor the old variant provided, or remove the height override entirely since `brand-pill` sets `h-auto` naturally.

**4. AuthorProfile.tsx uses `rounded-3xl` inconsistently with the new 16px standard**
- **Location**: `src/app/pages/AuthorProfile.tsx:120`, `:229`, `:272` and `src/app/pages/Authors.tsx:426`, `:541`, `:584`
- **Issue**: Six cards on the Authors and AuthorProfile pages use `rounded-3xl` (24px) directly on `<Card>`, bypassing the new `rounded-2xl` card default. This was likely intentional at the time (hero cards designed for maximum softness), but now creates inconsistency with every other card in the app at 16px.
- **Impact**: The Authors pages will visually stand out as "rounder" after the rest of the app shifts to 16px. This is not broken — it may be a deliberate design choice for hero surfaces — but it should be a conscious decision rather than an accidental holdover.
- **Suggestion**: Decide whether Author hero cards are intentionally 24px (document this in a comment) or should follow the global 16px standard. If the latter, remove the explicit `rounded-3xl` overrides.

### Nitpicks

**5. `CourseHeader.tsx` comment references old radius**
- **Location**: `src/app/components/course/CourseHeader.tsx:5-6`
- **Issue**: A code comment reads `"bg-card rounded-3xl shadow-sm p-8"` — this is a stale reference to the old 24px radius from a ported design. The actual rendered element now uses `rounded-2xl` implicitly through the card.tsx default.
- **Suggestion**: Update the comment to remove the `rounded-3xl` reference to avoid future confusion.

**6. `brand-pill` list background on white card surfaces**
- **Location**: Multiple callsites (Notes.tsx, Reports.tsx, MyClass.tsx)
- **Issue**: `brand-pill` uses `bg-card/50` as its list background — a 50% transparent card color. On the `#FAF5EE` page background this reads as a very subtle warm white, creating a gentle tray effect. On the `bg-card` (`#ffffff`) background of auth dialogs and course dialogs, it becomes nearly invisible (white on white). The visual affordance of "these are tabs" is weaker in those contexts.
- **Impact**: Minor affordance concern. The brand-colored active state still makes the selected tab clear. Inactive tabs may look like plain text buttons.
- **Suggestion**: Consider whether the auth dialog and edit dialog tabs (which now inherit brand-pill) benefit from a slightly more visible tray. If so, pass `variant="default"` there for the clear muted-background pill.

---

## Border Radius Computation

The `rounded-2xl` token resolves as:

```
--radius      = 0.625rem = 10px
--radius-2xl  = var(--radius) + 6px = 10px + 6px = 16px
```

This is correct. The video player uses `rounded-2xl` explicitly; cards now match.

Previously `rounded-[24px]` was a hardcoded Tailwind arbitrary value. The new approach is token-based and will scale correctly if `--radius` is ever adjusted globally.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast on brand-pill active state | Pass | `--brand` (#5e6ad2) + `--brand-foreground` (#ffffff) = high contrast white-on-indigo |
| Text contrast on brand-pill inactive state | Pass | Foreground on `bg-card/50` — standard `text-foreground` (#1c1d2b) on warm white |
| Keyboard navigation on tabs | Pass | Radix UI Tabs handles arrow-key roving tabindex by default in all variants |
| Focus indicators on brand-pill triggers | Review needed | `brand-pill` trigger has no explicit `focus-visible:ring` classes; relies on browser default outline. The `default` variant had explicit `focus-visible:ring-ring/50` and `focus-visible:outline-ring`. This may result in weaker focus visibility across all pages. |
| Touch targets (min 44px) | Partial | `brand-pill` trigger is `py-1.5 px-3` = ~44px natural height on 16px font. Acceptable at desktop. Borderline on mobile — monitor. |
| Border radius change and WCAG | Pass | Border radius changes do not affect accessibility. |
| Semantic HTML | Pass | Radix TabsPrimitive renders proper `role="tablist"` / `role="tab"` regardless of variant. |

### Focus Indicator Note (High Priority addendum)

The `brand-pill` trigger variant does not include focus-visible ring classes. The `default` variant explicitly had:
```
focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:outline-1
```

Since `brand-pill` is now the default, **all tabs across the app** rely on the browser's native focus outline, which varies by browser/OS and is often invisible on Chromium without OS-level settings. This is a WCAG 2.1 SC 2.4.7 concern.

**Suggestion**: Add focus-visible ring classes to the `brand-pill` trigger variant in `tabs.tsx`:
```tsx
'brand-pill':
  'gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-brand data-[state=active]:text-brand-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
```

---

## Responsive Design Notes

The border radius change (24px → 16px) has no layout implications at any breakpoint — it is purely a visual rounding value.

The `brand-pill` tab layout change does have responsive implications:

- At **mobile (375px)**: `brand-pill` triggers do not wrap (they have `whitespace-nowrap`). `MyClass.tsx` uses `overflow-x-auto` on the `TabsList`, so the 4 tabs scroll horizontally — this is fine and intended. `PlayerSidePanel` with 5 tabs at `text-xs` may overflow similarly; verifying in a live session is recommended given the side panel's fixed-width context.
- At **tablet (768px)**: No expected issues.
- At **desktop (1440px)**: Primary concern is the `PlayerSidePanel` tabs clustering left (finding #1 above).

---

## Summary of Files Needing Changes

| File | Change Needed | Severity |
|------|--------------|----------|
| `src/app/components/course/PlayerSidePanel.tsx` | Add `variant="default"` to TabsList and all TabsTriggers, or add `flex-1` to each trigger | High |
| `src/app/components/auth/AuthDialog.tsx` | Add `variant="default"` to TabsList and TabsTriggers | High |
| `src/app/pages/Login.tsx` | Add `variant="default"` to TabsList and TabsTriggers | High |
| `src/app/components/ui/tabs.tsx` | Add `focus-visible:ring` classes to `brand-pill` trigger variant | High (a11y) |
| `src/app/pages/Reports.tsx` | Change `h-11` to `min-h-[44px]` on TabsList | Medium |
| `src/app/pages/AuthorProfile.tsx` + `Authors.tsx` | Decide on `rounded-3xl` vs `rounded-2xl` for hero cards | Medium |
| `src/app/components/course/CourseHeader.tsx` | Update stale radius comment | Nitpick |

