## Test Coverage Review: feat-merge-toolbar — Merge Lesson Toolbar into Layout Header

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/8 ACs tested (partials counted as tested) — **50%**

**Strict Coverage (fully vs partial):** 2/8 fully covered, 2 partially covered, 4 untested — **25%**

**COVERAGE GATE:** BELOW 80% — Advisory Only (structural refactoring with primarily unit-level test files; E2E coverage for visual/behavioral ACs was not in scope for the unit test suite). See recommendations.

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| R1 | Lesson tools render inside Layout header on lesson pages | `LessonHeaderTools.test.tsx:122-133` (renders all tool buttons) | None | Covered (unit) |
| R2 | Back link with course name on all course sub-pages | `useCourseRoute.test.ts:114-125` (detects /flashcards as course route); `BottomNav.lesson.test.tsx:137-147` (Back button in lesson mode) | None | Covered (unit) |
| R3 | Responsive collapse: desktop all visible, tablet kebab, mobile BottomNav contextual | `BottomNav.lesson.test.tsx:137-147` (lesson mode primary slots); `BottomNav.lesson.test.tsx:229-261` (lesson drawer contents) | None | Partial — BottomNav contextual mode tested; no viewport-specific (tablet kebab, mobile header) or responsive layout assertions |
| R4 | Theater mode hides all course tools via `data-theater-hide` | `LessonHeaderTools.test.tsx:212-216` (container attribute existence) | None | Partial — attribute existence verified; CSS-driven visibility behavior not tested |
| R5 | Reading mode exit accessible via status bar inside UnifiedLessonPlayer | None | None | Gap — preservation of existing exit path not verified |
| R6 | 2px brand bottom border on header on lesson pages | None | None | Gap — `border-b-2 border-brand` className application not verified |
| R7 | Old sticky toolbar removed from UnifiedLessonPlayer | None | None | Gap — absence of old toolbar and IntersectionObserver not verified |
| R8 | Search bar centered in header on all pages | None | None | Gap — `sm:absolute sm:left-1/2 sm:-translate-x-1/2` centering not verified |

**Coverage**: 2/8 fully covered | 2 partial | 4 gaps

### Test Quality Findings

#### High Priority

- **`src/stores/useLessonChromeStore.ts` integration gap (confidence: 85)**: The store defines `syncReadingMode()`, `toggleReadingMode()`, and `registerReadingModeToggle()` but no production code calls `syncReadingMode` or `registerReadingModeToggle`. Grep confirms only the store definition and test file reference these methods. The `LessonHeaderTools` reading mode toggle button calls `toggleReadingMode()` from the store, which is a permanent no-op because no callback is registered. The `isReadingMode` state in the store will always be `false` because nothing calls `syncReadingMode(true)`. The `useReadingMode` hook in `src/hooks/useReadingMode.ts` manages its own `useState` for `isReadingMode` and never syncs with the store. This means the reading mode toggle in the Layout header is non-functional. Suggested fix: Add a `useEffect` in `UnifiedLessonPlayer` (or in `useReadingMode` itself) that calls `useLessonChromeStore.getState().registerReadingModeToggle(toggleReadingMode)` on mount, and syncs `isReadingMode` changes via `syncReadingMode`. The test `useLessonChromeStore.test.ts:209-236` verifies the store API works but cannot detect that the integration wire is never connected.

- **No E2E test for cross-component theater flow (confidence: 82)**: The plan explicitly states (Unit 3 Verification and System-Wide Impact): "Cross-layer scenario: entering theater mode via Layout header toggle -> store updates -> UnifiedLessonPlayer's data-theater-mode effect runs -> CSS hides all [data-theater-hide] elements -> pressing ESC -> store toggles back -> everything reappears. This flow must be tested end-to-end." No E2E or integration test covers this path. The existing E2E test `tests/e2e/regression/story-e91-s03.spec.ts` may reference `useTheaterMode`, but the new code path (store -> header toggle -> DOM attribute -> CSS) is not covered by any browser-visible assertion.

- **Reading mode keyboard shortcut regression (confidence: 78)**: Layout.tsx previously had a `useEffect` (lines 435-447, removed in this PR) that listened for Cmd+Option+R on non-lesson pages and showed a toast: "Reading mode is available on lesson pages." This was removed with the plan's expectation that `useReadingMode` would handle it. However, `useReadingMode` is only mounted inside `UnifiedLessonPlayer`, which only renders on lesson pages. On non-lesson pages, Cmd+Option+R now does nothing (no toast). No test covers this behavioral change. Suggested test: E2E test navigating to `/overview`, pressing Cmd+Option+R, and asserting the toast appears. Or alternatively, document this as intentional removal.

- **R6 (brand border) untested — visual regression risk (confidence: 75)**: The Layout header conditionally applies `border-b-2 border-brand` when `isLessonRoute` is true (Layout.tsx line ~307). No test verifies this. A future refactor could remove or change this class without any test catching it. Suggested test: E2E test that navigates to a lesson page and asserts the header element has the `border-brand` class or equivalent visual styling.

- **R7 (old toolbar removal) untested — regression risk (confidence: 72)**: The diff confirms the old sticky toolbar, IntersectionObserver sentinel, `isToolbarStuck` state, and `PlayerHeader` import are all removed from `UnifiedLessonPlayer.tsx`. No test verifies that: (a) the old toolbar DOM is absent, (b) no IntersectionObserver console errors occur, (c) no visual gap exists where the toolbar used to be. The existing E2E tests in `tests/e2e/regression/lesson-player-*.spec.ts` may catch visual breakage but don't explicitly assert the toolbar's absence.

#### Medium

- **`BottomNav.lesson.test.tsx:174-175` (confidence: 65)**: The notes indicator test uses a CSS class selector (`.size-2.rounded-full`) to find the indicator dot element. This is brittle — a Tailwind class change would break the test even if behavior is correct. Fix: Add a `data-testid` attribute (e.g., `data-testid="bottomnav-notes-indicator"`) to the indicator dot span in `BottomNav.tsx` and use `getByTestId` in the test instead.

- **`BottomNav.lesson.test.tsx:308-313` (confidence: 60)**: The safe area inset test asserts on `className` string `toContain('pb-[env(safe-area-inset-bottom)]')`. This is an implementation-detail assertion — the test would pass even if the padding were visually broken due to CSS cascade issues. Consider an E2E visual assertion instead, or at minimum use a `data-testid` approach rather than inspecting className.

- **`LessonHeaderTools.test.tsx:122-133` (confidence: 55)**: The "renders all tool buttons" test uses `toBeInTheDocument()` for each tool but never asserts that tools are in the correct DOM order or layout position. The test would pass if all tools were rendered inside a `<div style="display:none">`. Suggested: Add an assertion that the container also has specific visibility classes (e.g., `hidden md:flex`) to verify it's not hidden-by-default.

- **`LessonHeaderTools.test.tsx:212-216` (confidence: 55)**: The `data-theater-hide` test uses `closest('[data-theater-hide]')` from a child element. If the attribute were accidentally placed on a sibling instead of a parent, this test could miss it. A stronger assertion: `expect(screen.getByTestId('pomodoro-timer').parentElement).toHaveAttribute('data-theater-hide')` or verify the specific container element directly.

- **No E2E tests for R3 responsive behavior (confidence: 70)**: The plan requires at three viewports: desktop (all tools visible), tablet (kebab menu), mobile (contextual BottomNav). The BottomNav lesson mode unit tests verify the correct items render but do not verify at specific viewport widths. The `LessonHeaderTools` defines `data-testid="tablet-kebab-trigger"` with visibility class `hidden md:inline-flex lg:hidden` but no test clicks or inspects it. Suggested: Playwright E2E tests at `page.setViewportSize({ width: 768, height: 1024 })` for tablet and `{ width: 375, height: 812 }` for mobile.

- **`useCourseRoute.test.ts:244-281` (confidence: 60)**: The rapid route change test verifies the hook returns correct values but uses synchronous `rerender()` — it does not simulate React Router's actual navigation lifecycle. The hook depends on `useLocation()` which typically changes via React Router's `navigate()` or `<Link>` clicks. This test would miss bugs related to React Router's internal state update batching. It's a reasonable unit test approximation but should be supplemented with an E2E navigation test.

#### Nits

- **Nit** `useLessonChromeStore.test.ts:119` (confidence: 45): The `localStorage.setItem = () => { throw new Error(...) }` override is not restored in a `try/finally` — it uses a direct restore after the test block. If the test throws an unexpected error, `localStorage.setItem` would remain broken for subsequent tests. Use `vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw ... })` with automatic cleanup instead.

- **Nit** `useLessonChromeStore.test.ts:6-21` (confidence: 40): `beforeEach` uses `vi.resetModules()` and dynamic `import()` to get a fresh store instance. This is correct for Zustand isolation but relies on Vite's module caching behavior. Adding a comment explaining why `vi.resetModules()` is needed (Zustand `create()` runs at module evaluation time) would help maintainers.

- **Nit** `BottomNav.lesson.test.tsx:127` (confidence: 35): Standard mode test asserts only 3 nav items are present but the standard BottomNav has 4 primary items (Overview, Courses, My Class, Notes) + More. The test says "Shows Overview, Courses, My Class, Notes + More" but only asserts Overview, Courses, and More. The comment is misleading — either add assertions for the missing items or update the comment.

### Edge Cases to Consider

- **Reading mode store integration entirely missing**: `useReadingMode` manages `isReadingMode` via `useState` internally and never calls `syncReadingMode` to push state into the store. `registerReadingModeToggle` is never called, so `toggleReadingMode` in the store is dead. The reading mode toggle button in `LessonHeaderTools` and the reading mode drawer item in `BottomNav` will appear to work (toggle calls a no-op), but the actual `.reading-mode` CSS class on `<html>` will not be toggled by these controls. The existing `useReadingMode` keyboard shortcut (Cmd+Option+R) still works because it directly calls `toggleReadingMode` inside the hook, but the header button is decoupled.

- **Brand border on course sub-pages vs lesson pages**: The Layout applies `border-b-2 border-brand` only when `isLessonRoute` is true (exact lesson page). Course overviews, flashcards, and quiz pages do NOT get the brand border. If the design intent changes to show the border on all course pages, this conditional needs updating and testing.

- **Back link vs BottomNav Back button on mobile**: On mobile in lesson mode, both the Layout header (back icon) and BottomNav (Back button) navigate to `/courses/:courseId`. This is intentional (per plan) but no test verifies both navigate to the same destination.

- **`reset()` timing on route change**: Layout.tsx calls `useLessonChromeStore.getState().reset()` in a `useEffect` keyed on `isLessonRoute`. If `isLessonRoute` flickers (rapid route changes), the reset could fire while a lesson is still loading. The store tests verify `reset()` works but not the timing interaction with React Router transitions.

- **Completion status dropdown opens items with async handler**: `handleStatusChange` is async and shows toasts on success/failure. The `LessonHeaderTools` tests mock both `setItemStatus` and `toast` but never test the failure path (what gets rendered if `setItemStatus` throws). The `BottomNav.lesson.test.tsx` also doesn't test the failure toast path.

- **QAChatPanel lazy loading in BottomNav drawer**: The `LessonDrawerContent` wraps `QAChatPanel` in `<Suspense fallback={...}>`. The test `BottomNav.lesson.test.tsx:252-261` asserts `screen.getByTestId('qa-chat-panel')` is in the document after opening the drawer, but the mock resolves synchronously. A real lazy import would show the fallback briefly. No test verifies the fallback renders before the lazy component resolves.

---
ACs: 4 covered / 8 total (2 full, 2 partial) | Findings: 13 | Blockers: 0 | High: 5 | Medium: 6 | Nits: 3
