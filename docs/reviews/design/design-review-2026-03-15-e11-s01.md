# Design Review Report — E11-S01 Spaced Review System

**Review Date**: 2026-03-15
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E11-S01 — Spaced Review System
**Review Round**: 2 (post-fix verification — all prior findings addressed in commit `0c07cac`)
**Changed Files**:
- `src/app/pages/ReviewQueue.tsx`
- `src/app/components/figma/ReviewCard.tsx`
- `src/app/components/figma/RatingButtons.tsx`
- `src/app/config/navigation.ts` (Review entry added)
- `src/app/routes.tsx` (lazy-loaded ReviewQueue route)
- `src/stores/useReviewStore.ts`

**Affected Pages**: `/review` (Review Queue)
**Tested Viewports**: Desktop 1440px, Tablet 768px, Mobile 375px
**Theme tested**: Light mode (switched via header toggle; dark mode available)

---

## Executive Summary

All blockers and high-priority findings from the prior review have been resolved in commit `0c07cac`. The Spaced Review System is in a shippable state. Rating buttons now meet the 44px touch target requirement, the empty state title renders as a semantic `<h2>`, review cards are wrapped in `<motion.article>` elements with descriptive `aria-label` values, and the note excerpt cleanly strips markdown heading lines. One medium-priority pre-existing issue with collapsed sidebar accessibility remains open but is out of scope for this story. One new low-priority contrast observation is noted below.

---

## What Works Well

- **Touch targets now correct**: Rating buttons measure exactly `44px` height at all viewports — meets WCAG 2.5.5. The `size="default"` change was applied correctly.
- **Semantic article landmark**: Each review card is a `<motion.article>` with `aria-label` drawn from the note excerpt, giving screen readers a named, navigable list of review items.
- **Exemplary ARIA on rating buttons**: `role="group" aria-label="Rate your recall"` wraps three buttons each carrying a full descriptive label (e.g., "Rate as Hard — shorter review interval"). This is the gold standard for this pattern.
- **Retention badge accessibility**: `aria-label="Predicted retention: X%"` provides context beyond the bare number for screen reader users.
- **Complete design token compliance**: Zero hardcoded hex colors or raw Tailwind palette values in all new files. Semantic tokens (`bg-brand-soft`, `text-destructive`, `text-warning`, `text-success`, `text-muted-foreground`) used throughout.
- **`prefers-reduced-motion` layered correctly**: `MotionConfig reducedMotion="user"` wraps the page, CSS has `@media (prefers-reduced-motion)` rules present, and the button hover scale uses `motion-safe:hover:scale-[1.02]` — three layers of defence.
- **Empty state heading hierarchy**: `<h2>No reviews due right now</h2>` correctly follows the page `<h1>Review Queue</h1>`, giving a clean two-level structure for this state.
- **`aria-live` for dynamic content**: Both the subtitle count (`aria-live="polite"` on the notes-due paragraph) and the next review date in the empty state announce changes to screen readers without interrupting.
- **`aria-busy` on loading skeleton**: The skeleton container correctly uses `aria-busy="true"` and `aria-label="Loading review queue"`.
- **Card exit animation**: Clicking a rating button produces a smooth fade-out + slide-up exit (`opacity: 0, y: -16, duration: 0.2s`), the count immediately decrements in the subtitle, and focus moves to the next card's first button (or back to the H1 heading when the queue empties).
- **No console errors**: Zero application errors across all viewports and interactions. The three orphaned-review warnings (`rr-1`, `rr-2`, `rr-3` referencing test fixture notes) are expected behaviour — the component gracefully skips them with a `console.warn`.
- **Responsive layout clean**: No horizontal scroll at any breakpoint. `max-w-2xl` card container scales appropriately. Mobile bottom nav touch targets are 56×73px — well above minimum.
- **Background color correct**: Body background is `rgb(250, 245, 238)` = `#FAF5EE` — matches design token exactly.
- **Card border radius**: Cards measure `24px` border radius — matches the `rounded-[24px]` specification.
- **CLS zero**: Cumulative Layout Shift logged as `0.00` — no layout instability during card entry or exit.
- **Focus management after rating**: After dismissing a card via keyboard, focus correctly advances to the first button of the next card (via `requestAnimationFrame` + `querySelector`), then falls back to the H1 heading when the queue empties. This is a strong keyboard UX pattern.

---

## Findings by Severity

### Blockers (Must fix before merge)

None. All prior blockers resolved.

---

### High Priority (Should fix before merge)

None. All prior high-priority findings resolved.

---

### Medium Priority (Fix when possible)

**M1 — Muted text contrast is 3.88:1 on white card — below WCAG AA for 12px text**

The `text-xs` (12px) metadata fields — course name, topic tag, and "Due now" / time-until-due — render `rgb(125, 129, 144)` on the white card background `rgb(255, 255, 255)`. Computed contrast ratio: **3.88:1**. WCAG AA requires 4.5:1 for normal text at this size. The same token is used system-wide as `text-muted-foreground`, so this is a systemic issue rather than specific to the review cards.

- **Location**: `src/app/components/figma/ReviewCard.tsx:75–79` (`text-muted-foreground` on `course-name` and `topic-name`); line 102 (`text-muted-foreground` on `time-until-due`). Root cause: `--color-muted-foreground` token value in `src/styles/theme.css`.
- **Evidence**: Computed via `relativeLuminance()` in browser: muted foreground lum = 0.213, white lum = 1.0, ratio = `(1.05) / (0.263)` = **3.88:1**. `passesAA: "FAIL"` at 12px.
- **Impact**: Learners with low vision or in bright-light conditions may struggle to read the course name, topic, and due-time metadata. These fields are important for contextualising the note being reviewed.
- **Suggestion**: Two options: (1) Update the `--color-muted-foreground` token to a slightly darker value (approximately `rgb(107, 111, 126)` or darker achieves 4.5:1 on white — verify in `theme.css`). (2) Promote these specific labels to `text-foreground` or `text-sm` size (14px counts as "large text" at bold weight and requires only 3:1). Option 1 is preferred as it fixes the token globally. Note: validate that any token change passes contrast in dark mode too.

**M2 — "Unknown Course" displays for all imported-course notes**

Notes attached to imported courses (not in the `allCourses` static map) show "Unknown Course" as the course name. The code comment at `ReviewQueue.tsx:22` acknowledges this: "only covers static courses — imported courses not yet supported." In a live session where the primary content is imported, every card shows "Unknown Course," degrading the context learners need to situate their recall.

- **Location**: `src/app/pages/ReviewQueue.tsx:23–27` (`getCourseName()` function) and lines 167 (`courseName={getCourseName(note.courseId)}`).
- **Evidence**: All three review cards in the test session displayed "Unknown Course" — confirmed via `[data-testid="course-name"]` computed text.
- **Impact**: Spaced repetition is most valuable when reviewing notes from imported study materials. Seeing "Unknown Course" on every card reduces the contextual value of the metadata row and may confuse learners who have not seen this label before.
- **Suggestion**: Extend `getCourseName()` to also query the `importedCourses` Dexie table (or pass the note's `courseTitle` field if it exists). This could be done reactively by loading the imported courses map in `ReviewQueue` alongside `allReviews` and `notes`. If that is out of scope for this story, replace "Unknown Course" with a softer fallback like "Imported material" or simply omit the course name row when it cannot be resolved.

**M3 — Collapsed sidebar nav links have no accessible name (pre-existing)**

When the sidebar is collapsed (icon-only mode), all nav links — including the new `/review` entry — have empty `textContent`, no `aria-label`, and no `title` attribute. Screen readers announce these as unlabeled links. This is a pre-existing system-wide issue not introduced by this story.

- **Location**: `src/app/components/Layout.tsx` — the collapsed `NavLink` render path. `src/app/config/navigation.ts:40` — the Review entry that inherits the same gap.
- **Evidence**: Confirmed for all 12 nav links: `link.ariaLabel === null`, `link.textContent === ""` in collapsed state.
- **Impact**: Keyboard and screen reader users navigating the collapsed sidebar cannot identify any destination. This affects all pages, not just `/review`.
- **Suggestion**: Add `aria-label={item.name}` to the `<Link>` rendered when the sidebar is in icon-only mode. A one-line fix in `Layout.tsx` resolves the issue globally. Queue as a separate patch story if needed.

---

### Nitpicks (Optional)

**N1 — Note title absent from card header**

The card header shows course name and topic tag but does not display `note.title`. When reviewing multiple notes from the same course and topic, learners must read the excerpt to distinguish cards. A brief `note.title` line above the excerpt would improve at-a-glance scannability.

- **Location**: `src/app/components/figma/ReviewCard.tsx:66–80` — card header section.
- **Suggestion**: Add `<p className="font-medium text-sm text-foreground truncate">{note.title}</p>` as a third line in the metadata block, below topic tag.

**N2 — `getNextReviewDate()` computed unconditionally on every render**

`nextReviewDate` (line 99–105 of `ReviewQueue.tsx`) sorts all `allReviews` on every render even when `validReviews.length > 0` and the value is only consumed in the empty state. Minor performance consideration.

- **Suggestion**: Conditionally derive it: `const nextReviewDate = useMemo(() => validReviews.length === 0 ? ... : null, [validReviews, allReviews])`. This is a micro-optimisation — only worth changing if the review list grows large.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (body text) | Pass | H1: 15.37:1 on body bg; excerpt text: 15.37:1 on card |
| Text contrast ≥4.5:1 (small/muted text) | Fail | `text-xs` muted text: 3.88:1 on white card — below AA |
| Keyboard navigation | Pass | All rating buttons reachable via Tab; focus advances after rating |
| Focus indicators visible | Pass | Ring applied via box-shadow on all interactive elements |
| Heading hierarchy | Pass | H1 "Review Queue" → H2 "No reviews due right now" (empty state) |
| ARIA labels on icon buttons | Pass | Rating buttons have full descriptive `aria-label` values |
| ARIA group on rating buttons | Pass | `role="group" aria-label="Rate your recall"` present |
| Retention badge ARIA | Pass | `aria-label="Predicted retention: X%"` present |
| Semantic HTML for cards | Pass | `<motion.article aria-label={excerpt}>` wraps each card |
| Semantic HTML for empty state | Pass | Empty state title is `<h2>` |
| Loading state accessible | Pass | `aria-busy="true"`, `aria-label="Loading review queue"` on skeleton |
| `aria-live` for dynamic content | Pass | Count subtitle and next review date both have `aria-live="polite"` |
| Focus management after interaction | Pass | Focus advances to next card's button or H1 after rating |
| `prefers-reduced-motion` | Pass | `MotionConfig reducedMotion="user"` + CSS media query + `motion-safe:` prefix |
| Touch targets ≥44×44px | Pass | Rating buttons: 44px height (corrected from prior review) |
| Mobile nav touch targets | Pass | Bottom nav items: 56×73px |
| Form labels associated | N/A | No form inputs in this feature |
| No horizontal scroll | Pass | Confirmed at 375px, 768px, 1440px |
| Collapsed sidebar nav labels | Fail | Pre-existing — all nav links unlabeled in collapsed state |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass — No horizontal scroll. Single-column card stack. Rating buttons fill card width (`flex-1`) at 44px height. Bottom tab bar includes Review in the "More" drawer. Main content has 80px bottom padding to clear the nav bar.
- **Tablet (768px)**: Pass — No horizontal scroll. Card container 672px. Sidebar correctly collapsed to icon-only.
- **Desktop (1440px)**: Pass — Content centred with `max-w-2xl`. Strong use of whitespace. Card staggered entrance animation smooth. Retention badge right-aligned in header. Hover shadow on cards works correctly.

---

## Interaction Testing

| Interaction | Result | Notes |
|-------------|--------|-------|
| Rate as Hard (click) | Pass | Card exits with fade + slide-up, count decrements immediately |
| Rate as Good (click) | Pass | Same — queue empties correctly when last card rated |
| Empty state renders after all rated | Pass | "No reviews due right now" with next review date shown |
| Queue count subtitle updates | Pass | `aria-live="polite"` — screen readers notified |
| Empty state "no reviews ever" text | Pass (code verified) | "Rate a note after studying to start building your review queue." |
| Console errors | Pass | 0 errors |
| Console warnings | Pass | 3 orphaned-review warns (expected test data); 1 pre-existing meta tag deprecation |
| CLS | Pass | 0.00 — no layout shift |
| LCP | Pass | ~556ms (good rating per performance monitor) |
| TTFB | Pass | 12ms (excellent) |

---

## Prior Findings Resolution Status

| Finding | Severity | Status |
|---------|----------|--------|
| B1 — Rating buttons 32px touch target | Blocker | Resolved — now 44px (`size="default"`) |
| H1 — EmptyTitle was `<div>` not heading | High | Resolved — now `<h2>` |
| H2 — Note excerpt showed merged heading+body text | High | Resolved — heading lines stripped in `getNoteExcerpt()` |
| H3 — ReviewCard had no semantic landmark | High | Resolved — `<motion.article aria-label={...}>` |
| M1 — Sidebar nav links unlabeled (pre-existing) | Medium | Open — pre-existing, out of scope |
| M2 — Hardcoded blue in Layout active state (pre-existing) | Medium | Open — pre-existing, out of scope |
| M3 — No visible note title in card | Medium | Partially addressed — heading text now stripped from excerpt; title field still not displayed |
| N1 — Loading skeleton `p-1` padding | Nitpick | Acknowledged, intentional |
| N2 — `forceRender` Zustand workaround | Nitpick | Acknowledged, commented |
| N3 — `getNextReviewDate()` unconditional | Nitpick | Open — acceptable |

---

## Recommendations

1. **Address muted text contrast (M1)**: Darken the `--color-muted-foreground` token in `src/styles/theme.css` to achieve ≥4.5:1 on white. This is a one-token change that improves contrast across the entire app, not just the review cards. Verify dark mode contrast after the change.
2. **Resolve "Unknown Course" for imported notes (M2)**: Either extend `getCourseName()` to query the Dexie `importedCourses` table, or substitute a softer fallback. This is the most visible UX gap in a real usage scenario where the primary study material is imported.
3. **Add sidebar aria-labels (M3)**: Add `aria-label={item.name}` to collapsed nav links in `Layout.tsx` — a single-line fix that resolves screen reader accessibility for all navigation items across the entire app.
4. **Add note title to card (N1)**: A low-effort card header improvement that significantly aids scannability when multiple notes share the same course and topic.

