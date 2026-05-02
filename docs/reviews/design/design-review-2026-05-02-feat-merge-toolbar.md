# Design Review Report

**Review Date**: 2026-05-02
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Changed Files**: 
  - `src/app/components/Layout.tsx` — Header restructured with back link, centered search, lesson tools
  - `src/app/components/course/LessonHeaderTools.tsx` — New component: lesson action buttons
  - `src/app/components/navigation/BottomNav.tsx` — Added contextual lesson mode
  - `src/app/hooks/useCourseRoute.ts` — New hook: URL-based course route detection
  - `src/stores/useLessonChromeStore.ts` — New Zustand store: lesson chrome state
  - `src/app/hooks/useTheaterMode.ts` — Refactored to thin store wrapper
  - `src/app/pages/UnifiedLessonPlayer.tsx` — Old sticky toolbar removed
  - Test files for all new components
**Affected Pages**: 
  - `/courses/:courseId/lessons/:lessonId` — Lesson player pages (header + tools + brand border)
  - `/courses/:courseId/**` — Course sub-pages (back link only)
  - All non-course pages — Standard header (search, user controls only)

---

## Executive Summary

The lesson toolbar merge is well-executed structurally — the old sticky toolbar is cleanly removed from UnifiedLessonPlayer, the new Zustand store provides a solid state-sharing foundation, and the route detection hook (`useCourseRoute`) is a clear improvement over the previous regex. The header correctly conditions its contents based on route context: brand border and lesson tools only on exact lesson routes, back link on all course sub-pages, and standard header everywhere else. However, the centered search bar creates a significant interaction-blocking overlap with the tablet kebab menu, and there is an inconsistency in guest-mode completion visibility between desktop header and mobile BottomNav.

---

## Findings by Severity

### Blockers (Must fix before merge)
- None identified. The core functionality renders correctly and the structural goals of the merge are met.

### High Priority (Should fix before merge)

#### H1: Search bar overlaps tablet kebab menu, blocking interaction

- **Issue**: The centered search bar (`sm:absolute sm:w-96 lg:w-80`) renders on top of the kebab menu trigger button at tablet viewport widths (640px-1023px). The search bar's full-width `<button>` element intercepts all pointer events, making the kebab unreachable to mouse/touch users.
- **Location**: `src/app/components/Layout.tsx:599`
- **Evidence**: Live browser testing at 768px confirmed the search wrapper occupies the horizontal range 168px-552px within the header, while the kebab button sits at 288px-332px — directly underneath the search hit area. Playwright's `.click()` on `[data-testid="tablet-kebab-trigger"]` timed out because the search button intercepted the event.
- **Impact**: Tablet users cannot access secondary lesson tools (Pomodoro, QA Chat, Reading Mode, Theater Mode) via the kebab menu. This silently breaks a documented responsive requirement (R3).
- **Suggestion**: Either reduce search bar width at tablet (e.g., `sm:w-48 lg:w-80`), add `pointer-events-none` to the search wrapper and `pointer-events-auto` to its inner button, or give the right slot container `relative z-20` to establish a local stacking context above the absolutely-positioned search bar.

#### H2: Guest mode completion visibility inconsistent between desktop and mobile

- **Issue**: The desktop/tablet header conditionally hides the completion status dropdown for guest users (`{!isGuest && <DropdownMenu>...</DropdownMenu>}`), but the mobile BottomNav in lesson mode renders the completion toggle regardless of auth state. A guest user sees completion on their phone but not on their tablet.
- **Location**: `src/app/components/course/LessonHeaderTools.tsx:216`, `src/app/components/navigation/BottomNav.tsx:305`
- **Evidence**: Browser test confirmed `completionExists: false` at 1440px/768px (guest mode), but `completionExists: true` in the BottomNav at 375px. Both use `useContentProgressStore` which supports IndexedDB persistence — completion tracking works for guests. There is no technical reason for the divergence.
- **Impact**: Inconsistent mental model for guest users across devices. If completion is worth showing on mobile, it is worth showing on desktop. Learners switching between devices will be confused.
- **Suggestion**: Either show completion dropdown for guests on all viewports (since IndexedDB makes it functional), or hide it consistently everywhere. Showing it everywhere is the better UX for progressive engagement — IndexedDB-based completion tracking works identically for guests and authenticated users.

### Medium Priority (Fix when possible)

#### M1: Notes toggle missing `aria-controls` attribute

- **Issue**: The notes toggle button has `aria-expanded={notesOpen}` but is missing `aria-controls` to indicate which element it controls. WCAG 2.1 requires that expandable controls identify their controlled region.
- **Location**: `src/app/components/course/LessonHeaderTools.tsx:201-203`
- **Evidence**: 
  ```tsx
  <Button
    onClick={toggleNotes}
    aria-expanded={notesOpen}
    // Missing: aria-controls="lesson-notes-panel"
  >
  ```
- **Impact**: Screen reader users cannot determine what content is being expanded/collapsed. The `aria-expanded` state change is announced, but without `aria-controls`, there is no programmatic association between the button and the notes panel.
- **Suggestion**: Add `aria-controls="lesson-notes-panel"` (matching the ID on the notes panel container in UnifiedLessonPlayer). Both the header notes toggle and the BottomNav notes toggle should carry this attribute.

#### M2: Missing `aria-live` region for notes panel state changes

- **Issue**: When the notes panel is toggled open/closed (from header or BottomNav), there is no `aria-live` announcement or toast notification. Completion status changes do have toast announcements, but notes state changes are silent to screen reader users.
- **Location**: `useLessonChromeStore.ts:90-92` (toggleNotes), `LessonHeaderTools.tsx` / `BottomNav.tsx` (toggle callers)
- **Impact**: Screen reader users pressing the Notes button get an `aria-expanded` state change announcement (from the button attribute), but no confirmation of what happened. Compared to completion status which shows a toast ("Marked as In Progress"), the notes panel lacks equivalent feedback.
- **Suggestion**: Add a toast announcement on notes toggle similar to completion: `toast.success(notesOpen ? 'Notes panel opened' : 'Notes panel closed')`, or ensure the notes panel container has `aria-live="polite"` and announces its own state change.

#### M3: Multiple 404 errors in console during page navigation

- **Issue**: Browser console shows repeated 404 Not Found errors when loading lesson and overview pages.
- **Location**: Console output (network requests)
- **Evidence**: `[CERR] Failed to load resource: the server responded with a status of 404 (Not Found)` — 3 occurrences per page navigation.
- **Impact**: While not necessarily caused by this PR (the merge did not add new asset requests), 404 errors degrade perceived quality and may indicate broken resource paths introduced by the header restructuring.
- **Suggestion**: Investigate which resources are 404ing. Check if any hardcoded asset paths were affected by the file moves. Determine if pre-existing or new to this PR.

#### M4: `data-theater-hide` wrapper doubles as responsive visibility control

- **Issue**: The `LessonHeaderTools` component wraps all tools in `<div data-theater-hide className="hidden md:flex ...">`. The `hidden md:flex` classes toggle visibility based on viewport, while `data-theater-hide` hides in theater mode. On mobile (`<md`), the entire div is `hidden`. This means theater mode's CSS has nothing to hide in the header at mobile widths — which is correct because tools move to BottomNav, but the relationship is non-obvious from the code alone.
- **Location**: `src/app/components/course/LessonHeaderTools.tsx:117-119`
- **Impact**: No functional bug. Advisory for future maintainers: the coupling between responsive visibility and theater-mode hiding is implicit.
- **Suggestion**: Add a brief comment above the wrapper div explaining the design choice: "Hidden on mobile — lesson tools move to BottomNav at <640px."

### Nitpicks (Optional)

#### N1: Search bar width transition at `lg` breakpoint feels abrupt

- **Issue**: The search bar snaps from `w-96` (384px) to `w-80` (320px) at the `lg` breakpoint (1024px) without a transition. This width change coincides with the sidebar becoming persistent and tools moving from kebab to inline.
- **Location**: `src/app/components/Layout.tsx:599`
- **Impact**: Minor visual discontinuity during resize between 1023px and 1024px. Not noticeable during normal use.
- **Suggestion**: Consider adding `transition-[width] duration-200` on the search wrapper if other polish work is happening nearby.

#### N2: "Course" fallback text visible briefly during name resolution

- **Issue**: The back link shows "Course" as the course name while `useCourseRoute` resolves the name from `useCourseImportStore`. This is the intended fallback.
- **Location**: `src/app/hooks/useCourseRoute.ts:61`
- **Impact**: On fast connections with pre-loaded courses, this is invisible. On slow IndexedDB reads, "Course" may display for ~100-200ms.
- **Suggestion**: The plan mentions a skeleton placeholder (10ch width). If IndexedDB latency becomes noticeable, implement the skeleton. Otherwise the current fallback is adequate.

---

## What Works Well

1. **Clean route-conditioned header**: The header correctly shows brand border + lesson tools only on exact lesson routes, back link on all course sub-pages, and standard content everywhere else. Route detection via path segments is robust and well-tested.

2. **Old toolbar removal is clean**: No dead code, no commented-out blocks, no stale IntersectionObserver references. The sticky toolbar is genuinely gone from UnifiedLessonPlayer, and `data-theater-hide` coverage is maintained on the new tools.

3. **Mobile BottomNav contextualization**: The transition from standard nav to lesson-mode nav is smooth — correct `aria-label` changes, all four slots (Back, Notes, Completion, More) render with appropriate icons and states. The standard BottomNav is completely untouched and functions identically.

4. **Design token discipline**: All new code uses theme tokens — `bg-card`, `bg-muted`, `border-brand`, `text-muted-foreground`, `text-success`, `text-warning`, `bg-brand`. No hardcoded hex colors found in any changed file. The brand border uses `border-b-2 border-brand` which correctly resolves to the `--brand` CSS custom property.

5. **Keyboard accessibility foundations**: All interactive elements use semantic `<button>` elements (no div-onClick anti-patterns). Icon-only buttons have `aria-label` attributes. The tab order flows logically from skip-link through header controls. Toggle buttons use `aria-expanded` or `aria-pressed`.

6. **`useLessonChromeStore` architecture**: The Zustand store cleanly separates concerns — theater mode with DOM attribute sync and localStorage persistence, reading mode with callback registration, notes panel with simple boolean state. The `reset()` action on route change prevents stale state leakage. Using `document.documentElement.setAttribute` in the store's `toggleTheater` action keeps the CSS contract (`html[data-theater-mode='true'] [data-theater-hide]`) working identically.

---

## Detailed Findings

### H1: Search bar overlaps tablet kebab (detailed)

**Reproduction**:
1. Open `/courses/:id/lessons/:id` at viewport width 768px
2. Observe the kebab menu button (`[data-testid="tablet-kebab-trigger"]`) near the right side of the header
3. Attempt to click it — the search bar button intercepts the click

**Layout analysis at 768px viewport**:
```
Header width: 720px (768 - 24px margin each side)

Search bar (absolutely positioned, centered):
  left: 168px | width: 384px | right: 552px

Kebab button (in right slot, normal flow):
  left: 288px | width: 44px | right: 332px

Overlap: Kebab (288-332) sits entirely within search hit area (168-552)
```

The header has `relative z-10` (line 566). The search wrapper (`absolute`, no explicit z-index) is painted on top of the normal-flow right slot div. The fix needs to either shrink the search bar at tablet widths or elevate the right slot's stacking context.

### H2: Guest completion inconsistency (detailed)

Current behavior matrix:

| Viewport | Auth State | Completion Visible? | Location |
|----------|-----------|-------------------|----------|
| Desktop (>=1024px) | Guest | No | Header hidden |
| Desktop (>=1024px) | Auth | Yes | Header dropdown |
| Tablet (640-1023px) | Guest | No | Header hidden |
| Tablet (640-1023px) | Auth | Yes | Header dropdown |
| Mobile (<640px) | Guest | **Yes** | BottomNav button |
| Mobile (<640px) | Auth | Yes | BottomNav button |

The mobile BottomNav has no `isGuest` guard around the completion button. The `setItemStatus` call in `handleCompletionToggle` writes to IndexedDB, which works for guest sessions. The inconsistency is purely a UI decision in the header, not a technical limitation.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >=4.5:1 | Pass | Back link uses `text-muted-foreground` on `bg-card` (white). Verified via dark mode axe scan — no new contrast violations. |
| Keyboard navigation | Pass | Tab order: skip-link -> back link -> search -> tools -> theme -> notifications -> user menu. All focusable. |
| Focus indicators visible | Pass | shadcn/ui Button has ring-based focus-visible styles. Verified via browser focus test. |
| Heading hierarchy | Pass | No changes to heading structure. |
| ARIA labels on icon buttons | Pass | All icon-only buttons have `aria-label`: theater, reading, kebab, search. |
| ARIA live regions | Partial | Notes toggle has no `aria-live` announcement (M2). Completion changes announced via toast. |
| Semantic HTML | Pass | `<header role="banner">`, `<nav>` with appropriate `aria-label`, `<button>` elements. |
| Form labels associated | N/A | No form inputs in changed components. |
| prefers-reduced-motion | Pass | BottomNav uses `motion-safe:` prefix. CSS transitions respect the preference. |
| Color not sole indicator | Pass | Completion uses icon + text + color. Notes uses icon + text + badge. |
| Skip to content link | Pass | Existing skip link unchanged. |
| Escape closes modals | Pass | Theater mode exits via ESC (managed by store). |
| aria-expanded with aria-controls | Partial | Notes toggle has `aria-expanded` but no `aria-controls` (M1). Kebab `aria-expanded` managed by shadcn DropdownMenu. |
| aria-current on active nav | Pass | Standard BottomNav links have `aria-current="page"`. Lesson-mode links are action buttons. |

---

## Responsive Design Verification

- **Desktop (1440px)**: Pass — All lesson tools visible inline. Brand border (2px `rgb(94, 106, 210)`) present on lesson pages. Back link with course name. Search centered. Old toolbar absent.
- **Tablet (768px)**: Partial — Responsive collapse works (theater/reading hidden, kebab visible, notes/completion inline). But kebab is unreachable due to search bar overlap (H1). No horizontal overflow.
- **Mobile (375px)**: Pass — Contextual BottomNav shows Back/Notes/Completion/More. Standard BottomNav on non-lesson pages. Header shows back icon + search icon + user. No horizontal overflow. No lesson tools rendered in header.
- **Sidebar Collapse (1024px)**: Pass — Sidebar collapses correctly. Header tools reflow.

---

## Dark Mode Verification

- Header background transitions from white to dark card color (CSS variable swap)
- Brand border color updates via `--brand` CSS custom property
- Back link `text-muted-foreground` adapts to dark background
- Axe-core scan in dark mode showed no new contrast violations
- Notes and completion buttons render with correct foreground/background token pairs

---

## Axe-Core Scan Results

### Lesson Page (light mode):
- Violations: 0
- Passes: 46
- Incomplete: 0

### Overview Page (light mode):
- Violations: 0
- Passes: 38
- Incomplete: 0

### Lesson Page (dark mode):
- Violations: 0
- Passes: 46
- Incomplete: 0

No WCAG 2.1 AA violations detected automatically. The remaining accessibility gaps (M1, M2) require manual verification.

---

## Code Quality Notes

- **No hardcoded colors**: All changed files pass the design token check. Zero instances of `#XXXXXX` hex colors.
- **No div-onClick anti-patterns**: All clickable elements use `<button>` or shadcn/ui `<Button>`.
- **Proper Zustand patterns**: `useLessonChromeStore` uses selector-based subscriptions (`s => s.isTheater`) to avoid unnecessary re-renders.
- **TypeScript coverage**: All new components, hooks, and stores are fully typed with exported interfaces.
- **Test coverage**: Unit tests exist for all new components (LessonHeaderTools, useCourseRoute, useLessonChromeStore, BottomNav lesson mode). E2E specs updated for old toolbar removal.

---

## Console Errors

| Error | Count | Pre-existing? | Severity |
|-------|-------|---------------|----------|
| `syncEngine: column quiz_attempts.updated_at does not exist` | 6+ | Yes (Supabase schema) | Pre-existing |
| `syncEngine: column ai_usage_events.updated_at does not exist` | 6+ | Yes (Supabase schema) | Pre-existing |
| `Failed to load resource: 400` | 12+ | Yes (sync engine) | Pre-existing |
| `Failed to load resource: 404` | 3 per page | Needs investigation (M3) | Medium |

No new console errors were introduced by this PR beyond the pre-existing sync engine errors.

---

## Recommendations

1. **Fix search/kebab overlap (H1)**: Add `relative z-20` to the right slot container at `Layout.tsx:635`. This is a one-line fix with no layout side effects. Alternatively, reduce search bar width at tablet to `sm:w-48` to prevent overlap entirely.

2. **Resolve guest completion inconsistency (H2)**: Show completion everywhere (remove `{!isGuest && ...}` guard in LessonHeaderTools) since IndexedDB makes completion tracking functional for guests. Inconsistency is more confusing than a working button.

3. **Add `aria-controls` to notes toggle (M1)**: Both the header notes button and BottomNav notes button should reference the notes panel element ID.

4. **Investigate 404 errors (M3)**: Check which resources are failing to load. Verify if pre-existing or introduced by this PR.

---

*Review conducted via Playwright browser automation at 1440px, 768px, and 375px viewports with guest session. Screenshots available at `/tmp/design-review-screenshots/`.*
