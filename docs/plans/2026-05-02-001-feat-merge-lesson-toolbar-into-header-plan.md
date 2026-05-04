---
title: feat: Merge lesson toolbar into Layout header
type: feat
status: active
date: 2026-05-02
---

# feat: Merge lesson toolbar into Layout header

## Overview

Merge the two stacked navigation bars on lesson pages — the Layout header and the UnifiedLessonPlayer sticky toolbar — into a single contextual header. The Layout header gains course-aware slots: a back link on the left, search in the center, and lesson tools (pomodoro, chat, reading mode, theater, notes, completion) on the right. The old sticky toolbar is removed from UnifiedLessonPlayer. Responsive collapse tiers handle tablet and mobile. A 2px brand bottom border signals "course mode."

## Problem Frame

On lesson pages (`/courses/:courseId/lessons/:lessonId`), users see two bars stacked vertically:

1. **Layout header** — search, trial indicator, sync status, theme toggle, notifications, user avatar
2. **Sticky lesson toolbar** — back link, pomodoro, QA chat, reading mode toggle, theater mode toggle, notes toggle, completion status

This wastes ~48px of vertical space, creates two separate mental models for "the bar at the top," and adds complexity (two `data-theater-hide` elements to coordinate, two separate scroll behaviors). Consolidating into one header simplifies the chrome, reclaims space, and follows the pattern used by Notion, Linear, and VS Code — a single header that adapts to the current context.

## Requirements Trace

- R1. Lesson tools (pomodoro, QA chat, reading mode, theater mode, notes, completion status) render inside the Layout header on lesson player pages
- R2. A back link with course name appears on all course sub-pages (overview, lesson player, flashcards, quiz)
- R3. Desktop (≥1024px): all tools visible in header; Tablet (640-1023px): secondary tools collapse into a kebab menu, Notes + Completion stay visible; Mobile (<640px): header is back icon + search + user; BottomNav becomes contextual
- R4. Theater mode hides all course tools (they carry `data-theater-hide`)
- R5. Reading mode exit remains accessible via the status bar inside UnifiedLessonPlayer
- R6. A 2px brand-colored bottom border appears on the header on lesson pages
- R7. The old sticky toolbar (with its IntersectionObserver, sentinel, and stuck-state logic) is removed from UnifiedLessonPlayer
- R8. Search bar is centered in the header on all pages

## Scope Boundaries

- The sidebar behavior (collapsible desktop, sheet on tablet, hidden on mobile) is unchanged
- The Focus mode overlay and its interaction with reading mode is unchanged
- The AudioMiniPlayer and its bottom-padding logic is unchanged
- The import progress overlay, quality score dialog, and other Layout-level modals are unchanged
- Course page hero (`CourseHeader`) and breadcrumb (`CourseBreadcrumb`) are unchanged

### Deferred to Separate Tasks

- Floating "Exit theater" affordance (hover-reveal top zone): separate UX refinement after merge is stable
- Pomodoro timer cross-route persistence: keep current unmount-on-navigate behavior; reassess after merge

## Context & Research

### Relevant Code and Patterns

- **Layout header**: `src/app/components/Layout.tsx` lines 564-724 — the main header with search, user controls
- **Sticky lesson toolbar**: `src/app/pages/UnifiedLessonPlayer.tsx` lines 514-547 — back link + PlayerHeader inside scrollable content
- **PlayerHeader**: `src/app/components/course/PlayerHeader.tsx` — renders the lesson action buttons, receives all state as props
- **useTheaterMode**: `src/app/hooks/useTheaterMode.ts` — manages `isTheater` boolean + `data-theater-mode` DOM attribute + localStorage
- **useReadingMode**: `src/hooks/useReadingMode.ts` — manages `.reading-mode` class on `<html>`, keyboard shortcuts, aria announcements
- **useContentProgressStore**: `src/stores/useContentProgressStore.ts` — Zustand store for lesson completion status (already globally accessible)
- **BottomNav**: `src/app/components/navigation/BottomNav.tsx` — fixed mobile bottom tab bar with 4 primary slots + More drawer
- **Navigation config**: `src/app/config/navigation.ts` — defines primary nav paths and progressive disclosure groups
- **CSS theater/reading mode**: `src/styles/theme.css` lines 856-878 — `html[data-theater-mode='true'] [data-theater-hide]` and `html.reading-mode [data-theater-hide]` selectors
- **useIsMobile/useIsTablet/useIsDesktop**: `src/app/hooks/useMediaQuery.ts` — responsive breakpoint hooks
- **Route detection**: `Layout.tsx` line 449 — `isLessonPlayerRoute` regex: `/\/courses\/[^/]+\/lessons\/[^/]+$/`
- **Course adapter**: `useCourseAdapter(courseId)` in UnifiedLessonPlayer — resolves course name from IndexedDB
- **useCourseImportStore**: `src/stores/useCourseImportStore.ts` — imported courses list, already available in Layout

### Institutional Learnings

- **Pure router-shell structural refactoring** (`docs/solutions/best-practices/pure-router-shell-structural-refactoring-2026-04-21.md`): move effect blocks verbatim when ordering is implicit; use children prop to preserve provider scope; set a line-count budget for Layout.tsx
- **Extract shared primitive on second consumer** (`docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`): extract lesson tools to a shared component; consumers own layout while the primitive renders the tools; name for role not implementation
- **Tailwind v4 JIT class literal constraint** (`docs/solutions/best-practices/tailwind-v4-jit-class-literal-resolver-2026-04-25.md`): conditional classes must use complete string literals, never template strings; verify with `grep` in `dist/assets/*.css` after build
- **WCAG 2.4.11 Focus Not Obscured** (`docs/solutions/best-practices/2026-04-25-wcag-2-4-11-focus-not-obscured-mobile-bottom-nav.md`): if header becomes sticky on lesson pages, add `scroll-padding-top` on `:root`
- **Additive token pattern** (`docs/solutions/2026-04-25-focus-ring-token-additive-migration.md`): prefer adding a sibling token (e.g., `--header-lesson-border`) over mutating existing tokens

## Key Technical Decisions

- **State sharing via Zustand store**: Theater mode state moves from `useTheaterMode` hook into a new `useLessonChromeStore` Zustand store. This follows the `useContentProgressStore` pattern and lets both Layout header (toggle button) and UnifiedLessonPlayer (`data-theater-mode` DOM sync) access the same state without prop drilling or duplicate hook instances.

- **Notes panel state also in the store**: `notesOpen` and `hasNotes` are added to `useLessonChromeStore` so the header toggle button can read and write notes panel state, while UnifiedLessonPlayer's resizable panel responds to the same store.

- **Reading mode hook stays in UnifiedLessonPlayer**: `useReadingMode` depends on `isLessonPage` and renders UI elements (ReadingModeStatusBar, ReadingProgressBar) inside the player. The Layout header toggle button reads `isReadingMode` from the store but calls `toggleReadingMode` via the store (not the hook directly). The header button being hidden during reading mode (via `data-theater-hide`) is acceptable — the ReadingModeStatusBar inside UnifiedLessonPlayer provides the visible exit path.

- **Route detection via URL params, not regex**: Layout parses `courseId` and `lessonId` from the URL using React Router's `useParams`-equivalent pattern matching, replacing the fragile `isLessonPlayerRoute` regex. A new `useCourseRoute` hook returns `{ isLessonRoute, isCourseRoute, courseId, lessonId, courseName }`.

- **Course tools only on exact lesson player match**: `/courses/:courseId/lessons/:lessonId` with no trailing sub-routes. Quiz, results, and review pages get the back link but no course tools.

## Open Questions

### Resolved During Planning

- **State sharing mechanism**: Zustand store (`useLessonChromeStore`) for theater mode and notes panel state — consistent with existing codebase patterns
- **Route-to-tools matrix**: Course tools only on `/courses/:courseId/lessons/:lessonId` exact; back link on all `/courses/:courseId/**` routes; quiz sub-routes get back link only
- **Reading mode exit**: The ReadingModeStatusBar (inside UnifiedLessonPlayer) remains the visible exit; header button being hidden in reading mode matches current behavior
- **BottomNav contextualization scope**: Only on `/courses/:courseId/lessons/:lessonId` exact match; standard BottomNav on all other routes including course overview, flashcards, and quiz
- **Pomodoro cross-route behavior**: Keep current behavior — timer unmounts when navigating away from lesson (no cross-route persistence)
- **Back link loading state**: Skeleton placeholder (10ch width) while course name loads; `'Course'` as final fallback

### Deferred to Implementation

- Exact CSS for brand bottom border (which design token to use, whether it transitions on route change)
- Exact tablet kebab menu contents and ordering
- BottomNav transition animation when switching between standard and contextual modes
- Exact width of the search bar in centered layout (depends on available space after left/right slots)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Header layout by breakpoint and route

```
DESKTOP (>=1024px), lesson page:
┌──────────────────────────────────────────────────────────────────┐
│ ← Back to Course  │     Search bar      │ 🍅 💬 📖 ⛶ ✏ ✓ │ 🔔 👤 │
└──────────────────────────────────────────────────────────────────┘
                     ↑ brand border (2px)

DESKTOP, course sub-page (overview/flashcards/quiz):
┌──────────────────────────────────────────────────────────────────┐
│ ← Back to Course  │     Search bar      │          │ 🔔 👤     │
└──────────────────────────────────────────────────────────────────┘

DESKTOP, non-course page:
┌──────────────────────────────────────────────────────────────────┐
│                   │     Search bar      │          │ 🔔 👤     │
└──────────────────────────────────────────────────────────────────┘

TABLET (640-1023px), lesson page:
┌──────────────────────────────────────────────────────────────────┐
│ ☰ ← Course │   Search bar   │ ✓ ✏ ••• │ 🔔 👤 │
└──────────────────────────────────────────────────────────────────┘
                                ↑ kebab: 🍅 💬 📖 ⛶

MOBILE (<640px), lesson page:
┌──────────────────────────────────────────────────────────────────┐
│ ← │ 🔍 │ 👤                                                      │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│  ← Back   │  Notes   │  ✓ Done   │  ••• More                     │
└──────────────────────────────────────────────────────────────────┘
  ↑ contextual BottomNav (replaces standard BottomNav)
```

### State flow

```
useLessonChromeStore (Zustand)
  ├── isTheater, toggleTheater()     ← replaces useTheaterMode hook
  ├── notesOpen, toggleNotes()       ← lifted from useLessonPlayerState
  ├── hasNotes, setHasNotes()        ← synced by UnifiedLessonPlayer
  ├── isReadingMode (read-only)      ← synced by useReadingMode hook
  └── toggleReadingMode()            ← delegates to useReadingMode

Layout header reads: isTheater, isReadingMode, notesOpen, hasNotes
Layout header calls: toggleTheater(), toggleReadingMode(), toggleNotes()
UnifiedLessonPlayer: syncs isReadingMode into store, manages notes panel from store
```

## Implementation Units

- [x] **Unit 1: Create `useLessonChromeStore` Zustand store**

**Goal:** Provide a single source of truth for theater mode, reading mode, and notes panel state that both Layout header and UnifiedLessonPlayer can access.

**Requirements:** R1, R4, R5

**Dependencies:** None

**Files:**
- Create: `src/stores/useLessonChromeStore.ts`
- Modify: `src/app/hooks/useTheaterMode.ts` (thin wrapper around store, or deprecate)
- Test: `src/stores/__tests__/useLessonChromeStore.test.ts`

**Approach:**
- Store holds: `isTheater`, `toggleTheater`, `isReadingMode`, `toggleReadingMode`, `notesOpen`, `toggleNotes`, `hasNotes`, `setHasNotes`, `syncReadingMode`
- `toggleTheater` manages `data-theater-mode` attribute on `<html>` and persists to `lesson-theater-mode` localStorage key — same logic currently in `useTheaterMode` hook + UnifiedLessonPlayer's useEffect
- `toggleReadingMode` dispatches to a callback registered by `useReadingMode` hook via `registerReadingModeToggle(fn)`
- `notesOpen` / `toggleNotes` / `hasNotes` / `setHasNotes` are simple state with no persistence
- Store resets to defaults when not on a lesson page (guarded by a `reset()` action called on route change)
- `useTheaterMode` hook becomes a thin re-export of store selectors for backward compatibility in UnifiedLessonPlayer

**Patterns to follow:**
- `useContentProgressStore` (src/stores/useContentProgressStore.ts) — Zustand store structure, selector pattern
- `useTheaterMode` (src/app/hooks/useTheaterMode.ts) — localStorage read/write with try/catch and type validation

**Test scenarios:**
- Happy path: `toggleTheater()` sets `isTheater` to true, sets `data-theater-mode="true"` on `<html>`, persists to localStorage
- Happy path: `toggleNotes()` toggles `notesOpen` boolean
- Happy path: `syncReadingMode(true)` updates `isReadingMode` without side effects (DOM managed by `useReadingMode` hook)
- Happy path: `reset()` clears all state to defaults
- Edge case: corrupted localStorage value → falls back to `false`
- Edge case: `toggleReadingMode` called before callback registered → no-op (no crash)
- Edge case: rapid double-toggle → state is consistent (toggle is idempotent based on current value)
- Integration: `useTheaterMode` hook returns same values as store selectors

**Verification:**
- Store tests pass
- Calling `toggleTheater()` from any component updates every subscriber
- `data-theater-mode` attribute is set/removed synchronously with store state

---

- [x] **Unit 2: Create `useCourseRoute` hook**

**Goal:** Replace the fragile `isLessonPlayerRoute` regex in Layout with a typed hook that extracts course context from the URL and resolves the course name.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Create: `src/app/hooks/useCourseRoute.ts`
- Modify: `src/app/components/Layout.tsx` (replace `isLessonPlayerRoute` regex with hook)
- Test: `src/app/hooks/__tests__/useCourseRoute.test.ts`

**Approach:**
- Uses `useLocation` from React Router to get the current pathname
- Matches against known course route patterns:
  - `isLessonRoute`: path matches `/courses/:courseId/lessons/:lessonId` exactly (no trailing sub-routes)
  - `isCourseRoute`: path starts with `/courses/:courseId`
- Extracts `courseId` by splitting the pathname (avoids needing `useParams` which only works inside the route component)
- Resolves `courseName` from `useCourseImportStore` (synchronous lookup by ID) with `'Course'` fallback
- Returns `{ isLessonRoute, isCourseRoute, courseId, lessonId, courseName }`

**Patterns to follow:**
- `useIsMobile/useIsTablet/useIsDesktop` in `src/app/hooks/useMediaQuery.ts` — simple hook returning derived booleans
- The `isLessonPlayerRoute` regex in Layout.tsx line 449 — same matching logic, moved into the hook

**Test scenarios:**
- Happy path: `/courses/abc123/lessons/def456` → `isLessonRoute: true`, `isCourseRoute: true`, `courseId: "abc123"`, `lessonId: "def456"`
- Happy path: `/courses/abc123` → `isCourseRoute: true`, `isLessonRoute: false`, `courseId: "abc123"`
- Happy path: `/courses/abc123/flashcards` → `isCourseRoute: true`, `isLessonRoute: false`
- Happy path: `/courses/abc123/lessons/def456/quiz` → `isCourseRoute: true`, `isLessonRoute: false`
- Happy path: `/overview` → all flags false, all IDs null
- Edge case: malformed URL without courseId → graceful nulls, no crash
- Edge case: courseId present but course not in import store → `courseName` falls back to `'Course'`
- Edge case: rapid route transitions → hook returns correct values for current route (no stale closure)

**Verification:**
- Hook tests pass
- `isLessonPlayerRoute` regex removed from Layout.tsx
- All existing lesson page behaviors (scroll, bottom padding, theater mode) still work

---

- [x] **Unit 3: Create `LessonHeaderTools` component and integrate into Layout header**

**Goal:** Extract lesson action buttons into a self-contained component, then wire it into the Layout header alongside the back link and centered search bar.

**Requirements:** R1, R2, R6

**Dependencies:** Unit 1 (store), Unit 2 (hook)

**Files:**
- Create: `src/app/components/course/LessonHeaderTools.tsx`
- Modify: `src/app/components/Layout.tsx` (header section, lines 564-724)
- Test: `src/app/components/course/__tests__/LessonHeaderTools.test.tsx`

**Approach:**
- `LessonHeaderTools` is a self-contained component that reads from `useLessonChromeStore` and `useContentProgressStore`
- Renders: `PomodoroTimer`, `QAChatPanel` (lazy), reading mode toggle, theater mode toggle (hidden below `lg`), notes toggle (hidden below `lg`), completion status dropdown
- Each tool calls store actions directly — no props needed from parent
- Completion status uses `courseId`/`lessonId` from `useCourseRoute` hook + `useContentProgressStore`
- All tools carry `data-theater-hide` attribute for theater/reading mode compatibility
- Component is only rendered when `isLessonRoute` is true (parent Layout controls this)

**Layout header restructuring:**
- Left slot: back link with course name (conditionally rendered when `isCourseRoute` is true)
- Center slot: search bar (always rendered, but now centered via `flex-1` + centering rather than `flex-1 max-w-md`)
- Right slot: `LessonHeaderTools` (when `isLessonRoute`) + existing app controls (trial, sync, theme, notifications, user)
- 2px brand bottom border: `border-b-2 border-brand` added to the header element when `isLessonRoute` is true
- The header element keeps its `data-theater-hide` attribute (theater mode hides everything)

**Patterns to follow:**
- `PlayerHeader` (src/app/components/course/PlayerHeader.tsx) — button layout, icons, tooltip patterns
- Layout header (src/app/components/Layout.tsx lines 564-724) — existing header structure, spacing, responsive classes

**Technical design:**
> Directional guidance — the implementer should treat this as context, not code to reproduce.

```
LessonHeaderTools (no props):
  <div data-theater-hide className="flex items-center gap-2">
    <PomodoroTimer />
    <Suspense><QAChatPanel /></Suspense>
    <ReadingModeToggle />        // reads isReadingMode + toggleReadingMode from store
    <TheaterModeToggle />        // hidden lg:flex; reads isTheater + toggleTheater from store
    <NotesToggle />              // hidden lg:flex; reads notesOpen/hasNotes + toggleNotes from store
    <CompletionDropdown />       // reads from useContentProgressStore + useCourseRoute
  </div>
```

**Test scenarios:**
- Happy path: On lesson route, `LessonHeaderTools` renders all tool buttons
- Happy path: Clicking theater toggle calls `toggleTheater()` on the store and updates `data-theater-mode`
- Happy path: Clicking notes toggle calls `toggleNotes()` on the store
- Happy path: Completion dropdown shows current status from `useContentProgressStore`
- Edge case: Not on lesson route → `LessonHeaderTools` is not rendered (controlled by parent)
- Edge case: Guest user → completion dropdown hidden, other tools visible
- Edge case: Header layout doesn't break when `LessonHeaderTools` is absent (non-lesson pages)
- Integration: `data-theater-hide` on all tools → theater mode hides them via CSS
- Integration: Back link appears on `/courses/:id`, `/courses/:id/flashcards`, `/courses/:id/lessons/:id/quiz`

**Verification:**
- LessonHeaderTools unit tests pass
- Layout header renders correctly on lesson pages, course sub-pages, and non-course pages
- Theater mode hides header completely (via existing CSS)
- Reading mode collapses header (via existing CSS)
- Brand border appears only on lesson pages
- Search bar is centered

---

- [x] **Unit 4: Responsive collapse and BottomNav contextualization**

**Goal:** Implement priority-tiered collapse for tablet and mobile, and make BottomNav contextual on lesson pages.

**Requirements:** R1, R3

**Dependencies:** Unit 2 (hook), Unit 3 (LessonHeaderTools)

**Files:**
- Modify: `src/app/components/course/LessonHeaderTools.tsx` (responsive visibility classes)
- Modify: `src/app/components/Layout.tsx` (tablet kebab menu, mobile BottomNav conditional)
- Modify: `src/app/components/navigation/BottomNav.tsx` (contextual mode support)
- Test: `src/tests/unit/LessonHeaderTools.responsive.test.tsx`

**Approach:**

**Tablet (640-1023px):**
- Secondary tools (Pomodoro, QA Chat, Reading mode, Theater mode) hidden from the inline row via `hidden md:inline-flex lg:hidden` on a kebab menu trigger, `hidden lg:inline-flex` on the tools themselves
- Kebab menu renders a `DropdownMenu` with the secondary tools as items
- Primary tools (Notes toggle, Completion status) remain in the inline row alongside app controls

**Mobile (<640px):**
- Header simplifies to: back icon, search icon, user avatar
- `LessonHeaderTools` is NOT rendered in the header on mobile
- `BottomNav` receives new optional props: `mode?: 'standard' | 'lesson'`, `lessonTools?: { courseId, lessonId }`
- In lesson mode, BottomNav replaces its 4 primary slots with: Back to course, Notes, Completion, More (kebab)
- The "More" kebab opens the same Vaul Drawer, but populated with lesson secondary tools (Pomodoro, Chat, Reading, Theater) instead of standard nav items
- BottomNav keeps its `data-theater-hide` wrapper (theater mode hides it)
- Standard mode renders the existing 4 nav items + More

**Technical design:**
> Directional guidance — context for the implementer.

```
BottomNav props extension:
  mode?: 'standard' | 'lesson'     // defaults to 'standard'
  courseId?: string                 // required when mode='lesson'
  lessonId?: string                 // required when mode='lesson'

When mode='lesson':
  Primary slots: [Back to Course, Notes, Completion, More]
  More drawer: [Pomodoro, Chat, Reading Mode, Theater Mode]
```

**Patterns to follow:**
- BottomNav's existing `primaryNavPaths` from `src/app/config/navigation.ts` — slot definition pattern
- `DropdownMenu` from shadcn/ui — kebab menu pattern
- BottomNav's existing Vaul `Drawer` integration — "More" drawer pattern

**Test scenarios:**
- Happy path: Tablet viewport → secondary tools in kebab menu, primary tools inline
- Happy path: Mobile viewport + lesson route → contextual BottomNav with lesson tools
- Happy path: Mobile viewport + non-lesson route → standard BottomNav
- Happy path: Clicking "Notes" in contextual BottomNav toggles notes panel
- Happy path: Clicking "Completion" in contextual BottomNav marks lesson complete
- Edge case: Navigating from lesson to non-lesson on mobile → BottomNav reverts to standard mode
- Edge case: Theater mode hides contextual BottomNav (existing `data-theater-hide` wrapper)
- Edge case: Safe area insets still respected on notched devices
- Integration: BottomNav in lesson mode + header back link → both navigate to course overview (consistent behavior)

**Verification:**
- Tablet viewport: secondary tools reachable via kebab, primary tools visible
- Mobile viewport: BottomNav shows correct items on lesson vs non-lesson pages
- All existing BottomNav behavior (More drawer, progressive disclosure, safe area) preserved in standard mode

---

- [x] **Unit 5: Remove old sticky toolbar from UnifiedLessonPlayer**

**Goal:** Delete the sticky toolbar rendering, its IntersectionObserver sentinel, and the stuck-state logic from UnifiedLessonPlayer. Clean up related PlayerHeader props wiring.

**Requirements:** R7

**Dependencies:** Unit 3 (tools moved to Layout header)

**Files:**
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx` (remove lines ~513-547, the toolbar JSX + sentinel div + IntersectionObserver)
- Modify: `src/app/components/course/PlayerHeader.tsx` (no changes required — it continues to exist, now referenced by LessonHeaderTools pattern)
- Test: `tests/e2e/lessons/lesson-player.spec.ts` (update selectors if any reference the old toolbar)

**Approach:**
- Remove the `toolbarSentinelRef` and its associated `IntersectionObserver` (the `useEffect` that tracks whether the toolbar is "stuck")
- Remove the `isToolbarStuck` state variable
- Remove the toolbar `<div>` block (lines 515-547): the back link, spacer, and `<PlayerHeader>` rendering
- PlayerHeader component is NOT deleted — it remains as a reference for the `LessonHeaderTools` implementation (Unit 3)
- After Unit 1, the `useTheaterMode` hook becomes a thin re-export of store selectors. UnifiedLessonPlayer imports from the hook as before, but the hook delegates to `useLessonChromeStore` internally. No behavioral change at the call site

**Patterns to follow:**
- The pure-router-shell refactoring pattern: remove code cleanly, don't leave commented-out blocks or dead imports

**Test scenarios:**
- Happy path: Lesson page loads without the old sticky toolbar
- Happy path: Video/PDF content renders correctly without the toolbar spacer
- Happy path: Theater mode still works (T key, ESC) — `data-theater-mode` attribute still managed
- Happy path: Reading mode still works (Cmd+Option+R) — `.reading-mode` class still managed
- Edge case: Scrolling the lesson page doesn't trigger stuck-state logic (removed)
- Edge case: No visual gap where the toolbar used to be
- Integration: LessonHeaderTools in Layout header shows correct state for all tools

**Verification:**
- No sticky toolbar visible on lesson pages
- No IntersectionObserver errors in console
- Theater and reading mode function correctly
- All lesson page content (video, PDF, tabs, notes panel) renders without layout shift

---

- [x] **Unit 6: Clean up duplicate keyboard shortcut handler in Layout**

**Goal:** Remove the duplicate reading mode keyboard shortcut listener in Layout.tsx (lines 435-447) since `useReadingMode` already handles this. Unify into a single source of truth.

**Requirements:** R5 (indirect — ensures reading mode behavior is consistent)

**Dependencies:** Unit 1 (store with `toggleReadingMode`)

**Files:**
- Modify: `src/app/components/Layout.tsx` (remove or refactor lines 435-447)
- Modify: `src/hooks/useReadingMode.ts` (if needed — ensure the hook's own gating works correctly when called from UnifiedLessonPlayer only)

**Approach:**
- The Layout `useEffect` at lines 435-447 listens for Cmd+Option+R and shows a toast on non-lesson routes
- `useReadingMode` (called in UnifiedLessonPlayer) already has the same keyboard shortcut listener gated by `isLessonPage`
- After the merge: remove the Layout listener entirely. `useReadingMode`'s own listener handles both cases (activates on lesson pages, no-ops or shows toast on non-lesson pages)
- If `useReadingMode` doesn't currently show a toast for non-lesson activation, add that to the hook (consolidate the behavior)

**Patterns to follow:**
- Layout.tsx lines 435-447 — the code being removed

**Test scenarios:**
- Happy path: Cmd+Option+R on lesson page → toggles reading mode (via `useReadingMode`)
- Happy path: Cmd+Option+R on non-lesson page → shows toast "Reading mode is available on lesson pages"
- Edge case: No duplicate listeners registered (verify by checking `getEventListeners` or similar)
- Edge case: Rapid Cmd+Option+R presses don't cause state conflicts

**Verification:**
- Reading mode keyboard shortcut works correctly on all pages
- Toast appears on non-lesson pages
- Layout.tsx is ~10 lines shorter (cleanup)

## System-Wide Impact

- **Interaction graph:** Layout header gains awareness of lesson chrome state (via `useLessonChromeStore`). UnifiedLessonPlayer syncs into the store but no longer owns the toolbar. BottomNav gains a lesson mode. The `data-theater-mode` DOM attribute continues to be the single CSS-driven hiding mechanism.
- **Error propagation:** If `useLessonChromeStore` fails to initialize (e.g., localStorage read error), defaults apply — no crash, tools render with default state. Completion status failures are already handled by `useContentProgressStore`.
- **State lifecycle risks:** The `useLessonChromeStore` must be reset when leaving a lesson page to prevent stale state. The `reset()` action is called in a Layout `useEffect` keyed on `isLessonRoute`.
- **API surface parity:** The `PlayerHeader` component's props interface remains unchanged (it's still used as a reference). The new `LessonHeaderTools` component has no props — all state comes from stores.
- **Integration coverage:** Cross-layer scenario: entering theater mode via Layout header toggle → store updates → UnifiedLessonPlayer's `data-theater-mode` effect runs → CSS hides all `[data-theater-hide]` elements → pressing ESC → store toggles back → everything reappears. This flow must be tested end-to-end.
- **Unchanged invariants:** The sidebar, focus mode overlay, AudioMiniPlayer, import progress overlay, and all Layout-level modals are untouched. The `data-theater-hide` CSS contract is preserved — all course tools carry the attribute and respond to theater/reading mode identically to the old toolbar.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Reading mode toggle in header becomes inaccessible during reading mode (header hidden by `data-theater-hide`) | Acceptable — the ReadingModeStatusBar inside UnifiedLessonPlayer provides the visible exit button and ESC key works. Same as current behavior. |
| BottomNav contextualization complexity on mobile — Vaul Drawer needs to switch between nav items and lesson tools | Keep the Drawer component shared; pass different children based on mode. The Drawer's structure (header, list, close button) stays the same. |
| Theater mode exit without visible button — keyboard-only after merge | Keyboard shortcuts (T, ESC) documented in-app. A floating exit affordance is deferred to a separate task. |
| Layout.tsx line-count growth from adding course-aware slots | Mitigated by extracting `LessonHeaderTools` into its own file. The header section in Layout gains ~15 lines for the back link + conditional rendering. Net change to Layout.tsx should be under +20 lines. |
| Tailwind v4 JIT may miss dynamically-constructed class names in conditional header styling | Use a `headerClassResolver(isLessonRoute, isCourseRoute)` helper returning complete string literals. Verify with `grep` in `dist/assets/*.css` after build. |

## Sources & References

- **Header merge discussion:** this session — design decisions (back link left, search center, tools right, priority-tiered collapse, brand border Approach A)
- **Layout header:** `src/app/components/Layout.tsx` lines 564-724
- **Sticky toolbar:** `src/app/pages/UnifiedLessonPlayer.tsx` lines 514-547
- **PlayerHeader:** `src/app/components/course/PlayerHeader.tsx`
- **Theater mode:** `src/app/hooks/useTheaterMode.ts`, `src/styles/theme.css` lines 856-878
- **Reading mode:** `src/hooks/useReadingMode.ts`
- **Content progress:** `src/stores/useContentProgressStore.ts`
- **BottomNav:** `src/app/components/navigation/BottomNav.tsx`
- **Navigation config:** `src/app/config/navigation.ts`
- **Pure router-shell refactoring:** `docs/solutions/best-practices/pure-router-shell-structural-refactoring-2026-04-21.md`
- **Extract shared primitive:** `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`
- **Tailwind v4 JIT constraint:** `docs/solutions/best-practices/tailwind-v4-jit-class-literal-resolver-2026-04-25.md`
- **WCAG focus not obscured:** `docs/solutions/best-practices/2026-04-25-wcag-2-4-11-focus-not-obscured-mobile-bottom-nav.md`
