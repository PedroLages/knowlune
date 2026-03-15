# Design Review Report — E11-S01 Spaced Review System

**Review Date**: 2026-03-15
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E11-S01 — Spaced Review System
**Changed Files**:
- `src/app/pages/ReviewQueue.tsx`
- `src/app/components/figma/ReviewCard.tsx`
- `src/app/components/figma/RatingButtons.tsx`
- `src/app/config/navigation.ts` (Review entry added)
- `src/app/routes.tsx` (lazy-loaded ReviewQueue route)

**Affected Pages**: `/review` (Review Queue)
**Tested Viewports**: Desktop 1440px, Tablet 768px, Mobile 375px
**Theme tested**: Dark mode (system default in test environment)

---

## Executive Summary

The Spaced Review System introduces a clean, well-structured review queue with properly implemented ARIA labels on all interactive elements, correct design token usage throughout, and a smooth card exit animation on rating. The interaction model — rate and dismiss — is intuitive and works correctly. Three issues require attention before merge: rating buttons are 32px tall across all viewports (below the 44px minimum touch target), the empty state title uses a `<div>` instead of a semantic heading element, and the note excerpt display bleeds the markdown heading text into the content preview.

---

## What Works Well

- **ARIA on rating buttons**: The `role="group"` wrapper with `aria-label="Rate your recall"` and individual descriptive `aria-labels` (e.g., "Rate as Hard — shorter review interval") are exemplary. This is exactly the pattern specified in the story design guidance.
- **Retention badge accessibility**: `aria-label="Predicted retention: 42%"` is correctly applied, giving screen readers the full context rather than just the bare number.
- **Design token compliance**: All new files use semantic tokens (`bg-brand-soft`, `text-destructive`, `text-warning`, `text-success`, `text-muted-foreground`) with zero hardcoded color values. The ESLint rule is working.
- **`MotionConfig reducedMotion="user"`**: Correctly wraps the entire page, ensuring card animations respect the OS-level `prefers-reduced-motion` preference.
- **`aria-current="page"`**: The `/review` sidebar nav link correctly receives `aria-current="page"` when active — confirmed via computed attribute inspection.
- **No console errors**: Zero application errors across all viewports and interactions. One pre-existing deprecation warning (`apple-mobile-web-app-capable`) unrelated to this story.
- **Card exit interaction**: Clicking a rating button correctly removes the card with a fade-out + slide-up animation and decrements the subtitle count ("3 notes due" → "2 notes due") immediately.
- **Loading state**: `aria-busy="true"` and `aria-label="Loading review queue"` on the skeleton container is a solid accessibility pattern.
- **Responsive layout**: No horizontal overflow at any tested viewport. The `max-w-2xl` container provides appropriate content width at desktop and scales well to mobile.
- **`aria-live="polite"` on next review date**: Correctly applied within the empty state description so screen readers announce the date when it updates dynamically.

---

## Findings by Severity

### Blockers (Must fix before merge)

**B1 — Rating buttons below 44px touch target minimum on mobile**

The rating buttons render at 32px height at all viewports (mobile 375px, tablet 768px, desktop 1440px). WCAG 2.5.5 requires a minimum 44x44px touch target on touch devices. The design guidance for this story explicitly specifies "Rating buttons span full width" on mobile but does not address height. This directly impacts learners reviewing on phones — a primary use case for spaced repetition.

- **Location**: `src/app/components/figma/RatingButtons.tsx:39` — `size="sm"` on the Button renders at 32px height
- **Evidence**: Computed `getBoundingClientRect().height === 32` at 375px viewport
- **Impact**: Learners reviewing notes on mobile will frequently mis-tap between Hard/Good/Easy buttons, corrupting their review history and undermining the core learning experience
- **Suggestion**: Change `size="sm"` to `size="default"` (which renders at 40px) and add `min-h-[44px]` via the `className` prop to meet the 44px requirement. Alternatively, keep `size="sm"` and add `py-3` to override the vertical padding.

---

### High Priority (Should fix before merge)

**H1 — Empty state title is a `<div>`, not a semantic heading**

`EmptyTitle` in `src/app/components/ui/empty.tsx:58` renders as a `<div>` styled to look like a heading. When the review queue shows the empty state, there is no heading between the `<h1>Review Queue</h1>` and the "No reviews due right now" text. Screen reader users navigating by headings will only find one level of structure on this page.

- **Location**: `src/app/components/ui/empty.tsx:58-66` — `EmptyTitle` is a `<div>`; `src/app/pages/ReviewQueue.tsx:139` — usage site
- **Evidence**: Computed `titleTag === "DIV"`, `titleRole === null` — confirmed by DOM inspection
- **Impact**: Screen reader users relying on heading navigation (a common strategy for low-vision users) cannot jump to the empty state's message. The H1 "Review Queue" becomes the only navigational landmark.
- **Suggestion**: The `EmptyTitle` component should render as a `<p>` with `role="heading" aria-level="2"`, or better, change it to render as `<h2>` by default with an optional `as` prop for flexibility. Since this is a shared component, any change should be validated against all other usages in the app.

**H2 — Note excerpt shows markdown heading text duplicated in content**

The `getNoteExcerpt()` function strips markdown syntax (`##`, `**`, etc.) but does not remove the heading text itself. Notes stored with `## Title\n\nBody` render the excerpt as "Title Body content..." — the heading and body text flow together without a separator. Combined with the card's lack of a dedicated note title field, learners see the same text twice conceptually.

- **Location**: `src/app/components/figma/ReviewCard.tsx:30-44` — `getNoteExcerpt()`, line 94 — usage
- **Evidence**: Observed excerpt "React Hooks Hooks allow function components to use state..." — "React Hooks" is the markdown heading text, "Hooks allow..." is the body
- **Impact**: The excerpt is meant to help learners recall the note's content before rating. Seeing the heading merged into the body is confusing and reduces the excerpt's utility as a memory cue. Learners may struggle to identify whether they're seeing context or content.
- **Suggestion**: Two options: (1) Strip the first heading line entirely from the excerpt (`content.replace(/^#{1,6}\s.+\n?/, '').trim()`), letting the body speak for itself. (2) Display the note's `title` field separately above the excerpt as a `<strong>` or visually distinct element, so learners see structured title + body preview. Option 2 is preferable for clarity.

**H3 — `ReviewCard` contains no `<article>` or landmark role**

Each review card represents a discrete item of content (a note to review). Wrapping with a `<motion.div>` and `<Card>` (which renders as `<div>`) means screen reader users hear a generic container rather than a named content item. A learner using a screen reader cannot quickly scan "how many review cards are there and what are their titles."

- **Location**: `src/app/components/figma/ReviewCard.tsx:57-106`
- **Evidence**: Accessibility snapshot shows `generic [ref=e131]` for each card with no semantic role
- **Impact**: Screen reader users cannot efficiently navigate between review items. The `<main>` contains an unlabeled list of anonymous containers.
- **Suggestion**: Wrap the card's `<Card>` in an `<article>` element with `aria-label` set to the note title (e.g., `aria-label={note.title}`). This gives screen readers a scannable list of named articles. The `motion.div` can remain as the animation wrapper outside the `article`.

---

### Medium Priority (Fix when possible)

**M1 — Sidebar nav links have no accessible name in collapsed mode**

When the sidebar is collapsed (72px width, icon-only mode), all nav links lose their visible text label. The Tooltip renders the name on mouse hover, but the underlying `<Link>` element has no `aria-label`, no `title`, and no text content — only an SVG icon with `aria-hidden="true"`. Screen readers announce these as unlabeled links.

- **Location**: `src/app/components/Layout.tsx:38-54` — the `NavLink` component; `src/app/config/navigation.ts:40` — Review entry
- **Evidence**: Confirmed via computed `link.ariaLabel === null`, `link.textContent === ""` on all 12 nav links in collapsed state
- **Impact**: This is a pre-existing system-wide issue — not introduced by E11-S01. However, the new Review nav link inherits the same gap. Screen reader users navigating the collapsed sidebar cannot identify any navigation destination.
- **Suggestion**: Add `aria-label={item.name}` to the `<Link>` element when `iconOnly` is true (line 39 of Layout.tsx). This ensures screen readers announce "Review" regardless of the Tooltip state. Fix applies to all nav items at once.
- **Note**: This is pre-existing — flag to the team but low urgency for this specific story merge.

**M2 — Hardcoded Tailwind blue colors in active nav link state**

In `Layout.tsx:47`, the active nav link uses hardcoded `bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400` instead of design tokens `bg-brand-soft` / `text-brand`. This is a pre-existing issue that the new Review link inherits.

- **Location**: `src/app/components/Layout.tsx:47`
- **Evidence**: Code inspection — no ESLint error because the ESLint rule may not apply retroactively to existing files not touched in this story
- **Impact**: If the brand color changes in `theme.css`, the active nav state won't update automatically. Low visual impact today.
- **Suggestion**: Replace with `bg-brand-soft dark:bg-brand/10 text-brand` for both light and dark modes. Pre-existing issue — can be addressed in a separate cleanup story.

**M3 — No visible note title in ReviewCard**

Each card shows course name and topic tag but not the note's own `title` field. Learners see "React" (topic) and "Unknown Course" (course) but no specific note identifier. The excerpt starts with the stripped heading text, which partially compensates, but a dedicated title display would significantly improve card scannability.

- **Location**: `src/app/components/figma/ReviewCard.tsx:64-80` — the card header section
- **Evidence**: Card header shows only course name and topic; no `note.title` is rendered
- **Impact**: When reviewing multiple notes from the same course and topic, learners cannot quickly distinguish them by scanning the cards. This forces them to read the full excerpt for every card.
- **Suggestion**: Add a `<p className="font-medium text-sm text-foreground">{note.title}</p>` below the course/topic metadata in the header section. This also resolves H2 if the excerpt then strips the heading line.

---

### Nitpicks (Optional)

**N1 — Loading skeleton uses `p-1` padding inconsistently**

The loading state and the loaded state both use `space-y-6 p-1` on their root `<div>`. The `p-1` (4px) is minimal and appears intentional to avoid double-padding with the Layout shell, but it's worth documenting this as a deliberate choice rather than an oversight.

**N2 — `forceRender` workaround for Zustand v5**

The `useState(0)` / `forceRender(c => c + 1)` pattern in `ReviewQueue.tsx:35-45` is a pragmatic workaround for a Zustand v5 `useSyncExternalStore` edge case. The code comment explains it well. This should be removed when the underlying Zustand issue is resolved. Consider adding a TODO comment with a link to the Zustand issue tracker.

**N3 — `getNextReviewDate()` called unconditionally**

`getNextReviewDate()` at line 61 is called on every render regardless of whether `dueReviews.length === 0`. Since it's only needed for the empty state, it could be moved inside the `ReviewEmptyState` component or conditionally computed. Minor performance consideration.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | H1: 14.12:1, muted text: 5.21:1 in dark mode |
| Keyboard navigation | Partial | Rating buttons reachable via Tab; focus ring visible via box-shadow. Nav links unlabeled (pre-existing). |
| Focus indicators visible | Pass | Tailwind ring applied as box-shadow: `oklab(...) 0px 0px 0px 3px` — confirmed present |
| Heading hierarchy | Fail | Only H1 on page. Empty state title is a `<div>`, not H2. Review cards have no heading. |
| ARIA labels on rating buttons | Pass | All three buttons have descriptive `aria-label` values |
| ARIA group on rating buttons | Pass | `role="group" aria-label="Rate your recall"` correctly wraps buttons |
| Retention badge ARIA | Pass | `aria-label="Predicted retention: X%"` present |
| Semantic HTML for cards | Fail | Cards are `<div>` — no `<article>` or equivalent landmark |
| Form labels associated | N/A | No form inputs in this feature |
| `prefers-reduced-motion` | Pass | `MotionConfig reducedMotion="user"` wraps entire page |
| Touch targets ≥44x44px | Fail | Rating buttons: 32px height at all viewports |
| `aria-live` for dynamic content | Pass | Next review date in empty state has `aria-live="polite"` |
| `aria-busy` on loading state | Pass | Skeleton container has `aria-busy="true"` |
| Loading state accessible | Pass | `aria-label="Loading review queue"` on skeleton container |

---

## Responsive Design Verification

- **Mobile (375px)**: Partial — No horizontal scroll. Layout adapts correctly. Rating buttons 80px wide (flex-1 fills card) but 32px tall — fails touch target requirement. Card width 297px fits within viewport.
- **Tablet (768px)**: Pass — No horizontal scroll. Container 672px. Sidebar correctly collapsed. Rating buttons 205px wide, still 32px tall.
- **Desktop (1440px)**: Pass — Content centered with `max-w-2xl`. Proper use of whitespace. Retention badge right-aligned in card header. Card staggered entrance animation smooth.

---

## Interaction Testing

| Interaction | Result | Notes |
|-------------|--------|-------|
| Rate as Hard (click) | Pass | Card exits with fade+slide-up, count decrements |
| Queue subtitle updates | Pass | "3 notes due" → "2 notes due" immediately after rating |
| Empty state renders | Pass | Shows "No reviews due right now" with correct message |
| Empty state with next date | Pass (code verified) | `aria-live="polite"` on next review date span |
| Console errors | Pass | 0 errors, 1 pre-existing deprecation warning |
| CLS (Cumulative Layout Shift) | Pass | CLS: 0.00 logged by performance monitor |
| LCP | Pass | ~740ms (good rating from internal monitor) |

---

## Recommendations

1. **Fix touch targets first (B1)**: Change `size="sm"` to `size="default"` on RatingButtons and add `min-h-[44px]` — this is a one-line change with immediate mobile UX impact.
2. **Fix note excerpt display (H2 + M3 together)**: Add `note.title` as a visible card header element and strip the heading line from `getNoteExcerpt()`. These two changes are coupled and best done together.
3. **Fix EmptyTitle semantic element (H1)**: Either change `EmptyTitle` to render as `<h2>` or add `role="heading" aria-level="2"` — validate against all other empty state usages in the app first.
4. **Address ReviewCard article landmark (H3)**: Wrap card content in `<article aria-label={note.title}>` — this also helps with M3 once the title is available.
5. **Pre-existing sidebar accessibility (M1, M2)**: Queue as a separate story for Layout.tsx cleanup — these affect all pages, not just `/review`.

