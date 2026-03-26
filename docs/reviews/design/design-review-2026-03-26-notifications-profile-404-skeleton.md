# Design Review Report

**Review Date**: 2026-03-26
**Reviewed By**: Claude Code (design-review agent via Playwright)
**Scope**: Notification Bell, Profile Dropdown, 404 Page, MyClass Loading Skeleton
**Affected Files**:
- `src/app/components/figma/NotificationCenter.tsx`
- `src/app/components/Layout.tsx` (NotificationCenter + DropdownMenu integration)
- `src/app/pages/NotFound.tsx`
- `src/app/pages/MyClass.tsx` (skeleton)

---

## Executive Summary

Four new UI features were reviewed: a notification bell popover, a profile dropdown, a 404 error page, and a loading skeleton for My Class. The implementation is solid overall — design tokens are used correctly, touch targets meet the 44px minimum, responsive behaviour is clean at all three breakpoints, and dark mode works for all new surfaces. The primary concern is a blocker-level onboarding overlay bug that traps keyboard focus indefinitely, and two medium-priority issues around notification UX and accessibility completeness.

---

## What Works Well

- **Design token discipline**: No hardcoded colors found in any of the new components. All semantic tokens (`text-brand`, `bg-brand-soft`, `text-destructive`, `text-muted-foreground`, etc.) are used consistently.
- **Touch targets**: Bell button is exactly 44×44px, profile dropdown trigger and hamburger button both meet the minimum on all viewports.
- **Notification popover containment**: At desktop (1440px) the popover right edge lands at ~1218px — well within the 1440px viewport. At mobile (375px) the popover is 343px wide and stays within bounds with no horizontal overflow.
- **Dark mode**: Background switches correctly to `rgb(26, 27, 38)`, card surfaces to `rgb(36, 37, 54)`, and the notification popover and profile dropdown both render with correct dark-mode styling.
- **No horizontal scroll**: Confirmed at 375px, 768px, and 1440px. `scrollWidth` never exceeds `clientWidth`.
- **Keyboard navigation in profile dropdown**: Arrow keys correctly move focus between menu items; Escape dismisses. Focus lands on `role="menuitem"` elements as expected.
- **404 page heading structure**: `h1` contains "404" and `h2` contains "Page not found" — correct hierarchy. The `MapPinOff` icon has `aria-hidden="true"`. The CTA uses `variant="brand"` correctly.
- **MyClass skeleton implementation**: `Skeleton` components are placed for title, stats, tabs, sort control, and course card grid — good visual coverage.
- **`aria-current="page"`**: Active sidebar nav link correctly carries `aria-current="page"`.
- **Icon button labels**: All 14 icon-only buttons in the app's own code have `aria-label` attributes. The 4 unlabeled ones are in the `agentation` dev-tool package which is excluded from production builds.

---

## Findings by Severity

### BLOCKER — Must Fix Before Merge

**B-01: Onboarding overlay traps keyboard focus when its localStorage key is not set**

The `OnboardingOverlay` renders as `role="dialog" aria-modal="true"` and intercepts all pointer events via a `fixed inset-0 z-50` backdrop. When the Zustand store initialises on mount and finds no persisted completion state, `isActive` becomes `true` and the backdrop blocks every other interactive element in the layout — bell button, profile dropdown, dark mode toggle.

In tests, even after correctly seeding `knowlune-onboarding-v1` in `localStorage` via `addInitScript` (which runs before page scripts), the overlay still appeared on first load in some isolated contexts. The root cause appears to be that the `useCourseImportStore.getState().importedCourses` check happens synchronously during `initialize()` and IndexedDB hydration may not yet be complete, so the store sees zero courses and shows the overlay despite the localStorage flag being present.

The UX consequence: any user whose localStorage is cleared, or any new-tab session where IndexedDB is empty, faces an interstitial that fully blocks the page behind it. The "Skip for now" button text is available, but the close button at `position: absolute top-4 right-4` has only `aria-label="Skip onboarding"` — the two duplicate skip actions ("Skip onboarding" icon button + "Skip for now" text link at the bottom) both call `skipOnboarding()`, which is fine, but the `<button>` text link at line 166 has no `aria-label`. Its visible text "Skip onboarding" serves as the accessible name, so this is not itself a blocker, but the focus trap makes it one when the overlay appears unexpectedly.

**Location**: `src/app/components/onboarding/OnboardingOverlay.tsx:72-90`, `src/stores/useOnboardingStore.ts:72-89`

**Impact**: Learners whose localStorage is cleared (privacy mode, new device) are blocked from reaching any course content until they interact with the overlay. Screen reader users receive no `aria-live` announcement that a blocking dialog has appeared.

**Suggestion**: Before calling `set({ isActive: true })`, await the IndexedDB hydration signal (or check the Zustand store's `_hasHydrated` flag if using zustand-persist). Add an `aria-live="assertive"` announcement when the overlay opens so screen readers surface it immediately. Alternatively, defer `initialize()` by one tick to let stores hydrate: `setTimeout(() => initialize(), 0)`.

---

### HIGH — Should Fix Before Merge

**H-01: "View all notifications" is a dead-end — it only closes the popover**

At `NotificationCenter.tsx:257`, the "View all notifications" footer button calls `setOpen(false)` and does nothing else. There is no `/notifications` route, no scroll-to-section, and no toast. A learner clicking it expects to be taken somewhere but instead the popover simply closes.

**Location**: `src/app/components/figma/NotificationCenter.tsx:249-260`

**Impact**: Creates a confusing experience — learners will wonder if their click was registered. Breaks the principle "immediate visual response to all clicks/taps" from the design principles.

**Suggestion**: Either remove the "View all notifications" button until a dedicated page exists, or replace it with an explanatory disabled state ("Notifications history coming soon"). Do not leave a button that silently closes the popover with no feedback.

**H-02: Notification message text is single-line clamped — critical context is hidden**

`line-clamp-1` on the notification body text (`NotificationCenter.tsx:232-235`) cuts off messages after the first line. The message "You earned the 'Quick Learner' badge for completing 5 lessons in one day." becomes "You earned the 'Quick Learner' badge for completing 5 lessons i…" with no affordance to expand or read the rest. Clicking the item marks it as read but does not reveal the full text.

**Location**: `src/app/components/figma/NotificationCenter.tsx:232`

**Impact**: Learners may miss important information in notifications (course completion scores, deadline warnings). The truncation is especially problematic on the study reminder message which contains actionable advice.

**Suggestion**: Allow `line-clamp-2` for the body text within the 350px scroll area. The icon+title+timestamp row is compact enough that two lines of body text still fit within the 350px `ScrollArea` height with 6 items. Alternatively, add a tooltip on hover that surfaces the full message.

**H-03: `aria-live` missing on notification count changes**

When "Mark all as read" is clicked, the bell's `aria-label` changes from "Notifications (3 unread)" to "Notifications" and the red dot disappears. However, there is no `aria-live` region announcing this change. Screen reader users who activate "Mark all as read" receive no confirmation that the action succeeded.

**Location**: `src/app/components/figma/NotificationCenter.tsx:122-138`

**Impact**: Screen reader users have no way to confirm the "Mark all as read" action completed successfully — a silent failure from their perspective.

**Suggestion**: Add a visually-hidden `aria-live="polite"` region inside the `NotificationCenter` component that announces the state change, e.g. "All notifications marked as read."

**H-04: MyClass skeleton uses an artificial 500ms delay rather than real loading state**

`MyClass.tsx:23-28` uses `useState(true)` + `setTimeout(() => setIsLoading(false), 500)`. This always shows the skeleton for exactly 500ms regardless of whether data is actually loading. On fast devices where the Zustand store (`useCourseStore`) is already hydrated, the skeleton appears as a flash of placeholder content. On slow devices where hydration takes >500ms, the skeleton disappears before real content is ready.

**Location**: `src/app/pages/MyClass.tsx:23-28`

**Impact**: The skeleton exists to prevent content shift and reduce perceived wait time. A hardcoded timer achieves neither — it creates an artificial delay on fast connections and may still flash incomplete content on slow ones.

**Suggestion**: Replace the `setTimeout` with a derived loading state from the store itself: `const isLoading = useCourseStore(s => !s.hasHydrated)` (or equivalent). If the store does not expose a hydration flag, derive it from whether the courses array is `undefined` vs empty.

---

### MEDIUM — Fix When Possible

**M-01: "Skip for now" text in onboarding buttons lacks consistent ARIA naming**

The onboarding overlay (from the keyboard test) shows "Skip for now" and "Close" as focusable button text, but the "Close" is the icon-only `<Button>` with `aria-label="Skip onboarding"` while the bottom text link says "Skip onboarding" as its visible label. These two buttons perform the same action but have different accessible names and different visible labels, which is confusing for screen readers.

**Location**: `src/app/components/onboarding/OnboardingOverlay.tsx:139-173`

**Suggestion**: Unify to one dismiss action. If both buttons must exist, ensure their accessible names match their visible labels (or remove the icon button and keep only the text link).

**M-02: Notification popover has no `aria-labelledby` connecting it to the "Notifications" heading**

The `<PopoverContent>` contains an `<h3>Notifications</h3>` heading but the popover itself has no `aria-labelledby` pointing to it. The Radix `Popover` primitive renders `role="dialog"` implicitly but without a label, screen readers announce it as an unlabeled dialog.

**Location**: `src/app/components/figma/NotificationCenter.tsx:162-260`

**Suggestion**: Add `aria-labelledby` to the `PopoverContent` or its first child: assign an `id` to the `<h3>` and reference it on the popover root.

**M-03: 404 page renders inside the Layout (with sidebar and header) on desktop**

The 404 screenshot shows the full sidebar and header still present when the `NotFound` component renders. The content is correctly centered within the main content area. This is acceptable for authenticated routes but may be confusing for truly lost users who see a full application frame on an error page. This is a design philosophy question rather than a bug.

**Location**: `src/app/routes.tsx:362-365`

**Suggestion**: Consider whether the 404 should render outside the Layout (standalone full-screen error page) or continue rendering within it (as currently). Either is valid — just be intentional. The current approach maintains context for authenticated users, which may be preferable.

**M-04: Notification unread indicator uses `aria-label="Unread"` on a non-interactive `<span>`**

At `NotificationCenter.tsx:225-228`, the blue dot next to unread notification titles has `aria-label="Unread"` on a `<span>`. `aria-label` on non-interactive, non-landmark elements has inconsistent support across screen readers — some will read it, many will not, because the element has no accessible role. The unread count is already conveyed through the bell button's `aria-label` ("Notifications (3 unread)"), so this indicator is effectively decorative.

**Location**: `src/app/components/figma/NotificationCenter.tsx:225-228`

**Suggestion**: Change `aria-label="Unread"` to `aria-hidden="true"` on the dot `<span>`. The unread state is already communicated semantically via the bold `font-semibold` title class and the bell button label.

---

### NITPICKS — Optional

**N-01: Notification timestamp font size `text-[11px]` is below the 12px readability minimum**

`NotificationCenter.tsx:237` uses `text-[11px]` for relative timestamps. At this size, contrast is more difficult to maintain and the text is harder to read for users with moderate visual impairment even with valid contrast ratios.

**Suggestion**: Bump to `text-xs` (12px) to align with the minimum readable body size.

**N-02: The "View all notifications" button is visually identical to a link but semantically a `<button>`**

It renders as a full-width ghost button but behaves like a footer link. This creates a minor semantic mismatch — users expect footer text links to navigate, not buttons that close things.

**N-03: 404 page card uses inline `rounded-[24px]` rather than the `Card` default**

`NotFound.tsx:9` applies `rounded-[24px]` directly on the `<Card>` element. The `Card` component's default styling already applies the correct border radius via its base class. This duplication is harmless but slightly redundant.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Pass | Design tokens used; no hardcoded colors |
| Text contrast ≥4.5:1 (dark mode) | Pass | Dark body `rgb(26,27,38)`, card `rgb(36,37,54)` — tokens swap correctly |
| Keyboard navigation | Partial | Profile dropdown arrow-key nav works; bell opens correctly; onboarding overlay traps focus (B-01) |
| Focus indicators visible | Pass | Box-shadow rings visible on all custom button elements; outline-width 2px on nav links |
| Heading hierarchy | Pass | H1 → H2 → H3 hierarchy observed on Overview. 404 uses H1 "404" + H2 "Page not found" correctly |
| ARIA labels on icon buttons (app code) | Pass | All 14 app-authored icon buttons have aria-label |
| ARIA labels on icon buttons (third-party) | Pass (dev only) | 4 unlabeled buttons from `agentation` package — excluded from production build |
| `aria-current="page"` on active nav | Pass | Confirmed present on Overview link |
| Semantic HTML | Pass | `<header role="banner">`, `<main id="main-content">`, `<nav aria-label="Main navigation">` all present |
| `aria-live` on dynamic content | Fail | Notification count changes and "mark all read" confirmation have no live region (H-03) |
| `aria-labelledby` on notification popover | Fail | Popover dialog lacks accessible name (M-02) |
| `aria-hidden` on decorative indicators | Fail | Unread dot uses `aria-label` instead of `aria-hidden` (M-04) |
| Form labels associated | N/A | No new form inputs in this scope |
| `prefers-reduced-motion` | Not checked | `animate-ping` on the bell's red dot pulsing animation does not check `prefers-reduced-motion`. Low severity since it's a small peripheral animation. |
| Skip link present | Pass | "Skip to content" sr-only link is present at top of Layout |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass. No horizontal overflow (`scrollWidth` 364 < `clientWidth` 375). Bottom navigation visible. Header visible at 316px width. Notification popover stays within bounds (left: 0, right: 343, width: 343px vs 375px viewport).
- **Tablet (768px)**: Pass. No horizontal overflow. Hamburger button present and meets 44×44px minimum. Sidebar accessible via sheet.
- **Desktop (1440px)**: Pass. Sidebar persistent and correctly shown. Notification popover at 380px wide, right edge at 1218px — 222px clear of viewport edge. Profile dropdown 224px wide, no overflow.

---

## Recommendations (Prioritised)

1. **Fix the onboarding focus-trap issue (B-01)** — defer `initialize()` by one tick so IndexedDB hydration can complete before the overlay decision is made. Add `aria-live="assertive"` for the dialog appearance.
2. **Fix or remove the "View all notifications" dead-end (H-01)** — a button that does nothing but close is actively misleading. Remove it until a notifications page exists.
3. **Add `aria-live` region for notification state changes (H-03)** — this is a one-liner addition and significantly improves screen reader UX.
4. **Replace the artificial `setTimeout` skeleton with a real hydration check (H-04)** — this makes the skeleton meaningful rather than decorative.

---

*Report generated by design-review agent. Screenshots archived at `/tmp/design-review/`.*
