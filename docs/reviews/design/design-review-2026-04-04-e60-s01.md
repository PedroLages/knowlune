# Design Review Report

**Review Date**: 2026-04-04
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E60-S01 — Knowledge Decay Alert Trigger
**Branch**: `feature/e60-s01-knowledge-decay-alert-trigger`
**Changed Files Reviewed**:

- `src/app/components/settings/NotificationPreferencesPanel.tsx`
- `src/app/pages/Notifications.tsx`
  **Affected Pages**: `/settings` (Notification Preferences panel), `/notifications`
  **Breakpoints Tested**: 375px (mobile), 768px (tablet), 1024px (sidebar collapse), 1440px (desktop)
  **Accessibility**: axe-core 4.10.2 (WCAG 2.1 AA), manual keyboard and ARIA audit

---

## Executive Summary

E60-S01 introduces two UI surfaces: a `knowledge-decay` preference toggle in `NotificationPreferencesPanel` and the `knowledge-decay` filter type in the Notifications page. Both surfaces are well-implemented, following existing component patterns consistently. No design-system violations, hardcoded colors, or broken layouts were found. Three findings warrant attention — two medium-priority issues and one nitpick — none of which block the merge.

---

## What Works Well

- **Consistent component patterns**: The knowledge decay toggle row is built with the same `Switch` + `Label` + description structure used for all other notification types. Consistency builds learner confidence and reduces cognitive load.
- **Correct background color**: Computed `rgb(250, 245, 238)` matches the `#FAF5EE` warm off-white design token exactly across all breakpoints and both color schemes.
- **Semantic ARIA labeling**: Every switch has both a programmatic `<Label htmlFor>` association and an explicit `aria-label`. Screen readers receive a clear, non-ambiguous label ("Knowledge Decay Alerts notifications").
- **Live region for state changes**: The Notifications page correctly uses `<span aria-live="polite" role="status">` to announce mark-read and dismiss actions to screen reader users — a detail that is frequently missed.
- **No horizontal scroll**: Neither `/settings` nor `/notifications` produces horizontal scroll at 375px or 768px.
- **prefers-reduced-motion**: Confirmed present in compiled CSS. The quiet hours reveal animation will be suppressed for users with motion sensitivity.
- **Touch target rows**: All notification toggle rows enforce `min-h-[44px]`, meeting the 44px minimum for touch devices. Verified at mobile viewport.
- **Heading hierarchy**: H1 Settings → H2 Notification Preferences is correct. No skipped levels.
- **Dark mode rendering**: Text colors confirmed — label `rgb(232, 233, 240)`, muted description `rgb(178, 181, 200)` — both readable against the dark background `rgb(26, 27, 38)`. No dark mode artifacts.
- **Zero console errors**: No JavaScript errors were recorded during navigation on either page.
- **Clean code**: No hardcoded hex colors, no inline styles, no non-semantic `<div onClick>` patterns. The ESLint `design-tokens/no-hardcoded-colors` rule would have caught any violations at save-time.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

**M1 — Duplicate icon for two distinct notification types in the preferences panel**
**M2 — Filter button touch targets below 44px minimum on mobile**

### Nitpicks (Optional)

**N1 — aria-live on the quiet hours container div is semantically non-ideal**

---

## Detailed Findings

### M1 — Duplicate icon for two semantically distinct notification types

**Issue**: In `NotificationPreferencesPanel.tsx`, both `review-due` (Flashcard Reviews) and `srs-due` (SRS Due Reminders) are assigned the `BookOpen` icon. These are distinct learning systems — spaced repetition cards and flashcard review are not synonymous — and sharing an identical icon makes them visually indistinguishable at a glance.

**Location**: `src/app/components/settings/NotificationPreferencesPanel.tsx:55,61`

```
{ type: 'review-due', label: 'Flashcard Reviews', icon: BookOpen },   // line 55
{ type: 'srs-due',    label: 'SRS Due Reminders', icon: BookOpen },   // line 61
```

**Contrast with Notifications page**: `src/lib/notifications.ts` correctly differentiates these — `review-due` uses `Clock` and `srs-due` uses `BookOpen`. The preferences panel does not match this established mapping.

**Impact**: For learners who rely on visual scanning rather than reading every label, identical icons create ambiguity. It also creates an inconsistency with the Notifications page where the same types display with different icons, which can undermine trust and predictability.

**Suggestion**: Align the preferences panel icons with the mapping already defined in `src/lib/notifications.ts`. Change `review-due` to use `Clock` (already imported in `notifications.ts`). This means adding `Clock` to the imports in `NotificationPreferencesPanel.tsx` and updating the `review-due` entry. No new icon decisions are required — the correct mapping is already established.

---

### M2 — Filter button touch targets below 44px minimum on mobile

**Issue**: On the Notifications page at 375px viewport, all filter buttons (read/unread/all status filters and notification type filters) render at 36px height — 8px below the 44px minimum required by WCAG 2.5.5 (Target Size) and the project's own responsive design standards.

**Location**: `src/app/pages/Notifications.tsx:127-170`

**Evidence**: Measured via `getBoundingClientRect()`:

```
{ text: "all",              h: 36, w: 41  }
{ text: "unread",           h: 36, w: 74  }
{ text: "read",             h: 36, w: 59  }
{ text: "All types",        h: 36, w: 81  }
{ text: "Course Complete",  h: 36, w: 163 }
```

The buttons use `size="sm"` with `min-h-[36px]`, which is appropriate for desktop density. On mobile these need to grow.

**Impact**: Learners with motor impairments or those on touch devices may find the filter controls difficult to activate accurately. The filter area is the primary way to navigate to knowledge decay notifications, making this more critical than a decorative element.

**Suggestion**: Apply `sm:min-h-[36px] min-h-[44px]` to the filter button `className` props on mobile, or add a wrapper that increases the touch area without visually enlarging the button (using padding or `::after` pseudo-element techniques). Alternatively, restructure the filter chip row to use a horizontal scroll container with appropriately sized chips on mobile.

---

### N1 — aria-live placement on the quiet hours container

**Issue**: The `aria-live="polite"` attribute is placed on the animated container `<div>` that wraps the Start/End time inputs. The intent is presumably to announce when the quiet hours section expands. However, `aria-live` regions announce changes to their _content_, not their own appearance. Since the container itself is conditionally rendered (not always in the DOM), screen readers will not reliably announce its appearance.

**Location**: `src/app/components/settings/NotificationPreferencesPanel.tsx:153-155`

```tsx
<div
  className="grid grid-cols-2 gap-4 animate-in fade-in-0 slide-in-from-top-1 duration-300"
  aria-live="polite"
>
```

**Impact**: This is a minor semantic issue. Screen readers will still read the newly focused time inputs when the user tabs into them. The absence of a live region announcement is not a functional barrier — it is a refinement.

**Suggestion**: If the intent is to announce the expansion, a separate visually-hidden live region outside the conditional rendering block would be more reliable. For example, update `liveMessage` state (pattern already used in `Notifications.tsx`) when quiet hours is toggled on. Alternatively, removing `aria-live` from the container entirely is acceptable — the label/input association is sufficient for screen reader users. The current implementation is not harmful, only imprecise.

---

## Accessibility Checklist

| Check                                      | Status          | Notes                                                                                                                                                                                                                                                             |
| ------------------------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text contrast ≥4.5:1 (light mode)          | Pass            | Empty state title `rgb(28,29,43)` on white, description `rgb(101,104,112)` — both pass AA                                                                                                                                                                         |
| Text contrast ≥4.5:1 (dark mode)           | Pass            | Label `rgb(232,233,240)`, muted `rgb(178,181,200)` on dark bg confirmed                                                                                                                                                                                           |
| Keyboard navigation — switch focusable     | Pass            | `#notif-knowledge-decay` receives Tab focus and keyboard Space activation confirmed                                                                                                                                                                               |
| Focus indicator visible                    | Pass (advisory) | Box-shadow ring at 2.51px present. Ring color at 42% opacity on white calculates to ~1.1:1 against panel background — meets WCAG 2.1 AA (no focus appearance requirement) but would fail WCAG 2.2 SC 2.4.11 advisory. Consider strengthening for future-proofing. |
| Focus indicators on filter buttons         | Pass            | Radix/shadcn focus-visible ring confirmed on notification page filter buttons                                                                                                                                                                                     |
| Heading hierarchy                          | Pass            | H1 → H2 correct, no skipped levels                                                                                                                                                                                                                                |
| ARIA labels on switches                    | Pass            | Both `htmlFor`/`id` association and explicit `aria-label` present                                                                                                                                                                                                 |
| Semantic HTML                              | Pass            | No `<div onClick>`, no images without alt, proper button elements throughout                                                                                                                                                                                      |
| Form labels associated                     | Pass            | All time inputs (`#quiet-start`, `#quiet-end`) have `<Label htmlFor>`                                                                                                                                                                                             |
| Live regions for dynamic content           | Pass            | `aria-live="polite" role="status"` on notifications page for mark-read/dismiss actions                                                                                                                                                                            |
| prefers-reduced-motion                     | Pass            | Confirmed present in compiled CSS                                                                                                                                                                                                                                 |
| Touch targets ≥44px (notification toggles) | Pass            | All switch rows enforce `min-h-[44px]`, measured at 44px on mobile                                                                                                                                                                                                |
| Touch targets ≥44px (filter buttons)       | Fail            | Filter buttons render at 36px on mobile (see M2)                                                                                                                                                                                                                  |
| No horizontal scroll at 375px              | Pass            | Confirmed on both /settings and /notifications                                                                                                                                                                                                                    |
| axe-core WCAG 2.1 AA scan                  | Pass (scoped)   | 3 axe violations found — all from `agentation` third-party library (`styles-module__` selectors), none from E60-S01 code                                                                                                                                          |

---

## Responsive Design Verification

| Breakpoint       | /settings | /notifications     | Notes                                                            |
| ---------------- | --------- | ------------------ | ---------------------------------------------------------------- |
| 375px (mobile)   | Pass      | Pass (advisory M2) | No horizontal scroll; toggle rows 44px; filter buttons 36px (M2) |
| 768px (tablet)   | Pass      | Pass               | Layout reflows correctly; filter chips wrap naturally            |
| 1024px (sidebar) | Pass      | —                  | Sidebar collapse behavior unaffected by this story's changes     |
| 1440px (desktop) | Pass      | Pass               | Full layout renders correctly; all 7 toggle rows visible         |

**Dark mode**: Both pages render correctly. Text contrast verified programmatically.

---

## Notes on Test Environment

The application renders a welcome onboarding wizard on fresh browser sessions (no persistent state). This wizard intercepts pointer events for automated interaction testing. The ARIA snapshot of the notification preferences panel was obtained successfully (7 toggles including `knowledge-decay` all present with correct `aria-checked="true"` states). All structural and accessibility properties were verified via snapshot and JavaScript evaluation, bypassing the visual obstruction. This is a testing environment concern, not a production UX concern.

---

## Recommendations

1. **Address M1 immediately** — aligning the `review-due` icon to `Clock` in the preferences panel is a one-line change that eliminates a real inconsistency and requires no design decisions (the correct mapping already exists in `notifications.ts`).

2. **Address M2 before the sprint closes** — the filter button touch target issue affects a core interaction on the Notifications page on mobile. Adding responsive `min-h` classes is low-risk and can be done in this PR or as a fast-follow chore.

3. **The N1 `aria-live` placement is worth understanding** — even if left as-is, the team should know that `aria-live` on conditionally-rendered containers does not produce reliable announcements. The existing approach is harmless but not effective. The `liveMessage` pattern already established in `Notifications.tsx` is the correct model.

4. **Knowledge decay notification type is fully wired** — the `'knowledge-decay'` type appears correctly in the ARIA snapshot, has a unique `Brain` icon (differentiated from all other types), and the filter button on the Notifications page responds to selection with correct `aria-pressed` state management.
