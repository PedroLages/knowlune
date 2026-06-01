---
title: "fix: Restore track context in lesson navigation and improve learning track detail UX"
type: fix
status: active
date: 2026-06-01
---

# fix: Restore track context in lesson navigation and improve learning track detail UX

## Overview

Three problems degrade the experience on `/learning-tracks/:trackId`:

1. **Navigation context is lost** — clicking "Continue lesson", the hero CTA, or any course
   in the syllabus sends the user to `/courses/:courseId` (or its lesson sub-route) with no
   memory of which track they came from. The Layout header back-link consequently shows
   "← {courseName}" and routes back to the course overview, not the track.
2. **Progress display is broken and discouraging** — the "Your Progress" ring shows 0 % even
   when lessons have been watched (the `enhancedProgress` override in `LearningTrackDetail`
   incorrectly replaces the hook's lesson-level `completionPct` with a course-completion
   ratio). Additionally, `estimatedRemainingHours` can go negative on corrupted or
   edge-case lesson counts, rendering "−210.5h" in the sidebar.
3. **Cluttered detail UI** — the ContinueLearningBento shows two redundant progress stats
   ("81 % remaining" and "19 % complete") without ever telling the user their position in the
   track ("Course 1 of 55"). The Syllabus "Edit" button carries visual weight equal to
   content-consumption actions. The hero top-padding exposes a very tall photo strip that
   pushes the main content far down the viewport.

## Problem Frame

When a user opens a learning track and presses "Continue lesson" they immediately lose the
structured-journey framing the track provides. There is no breadcrumb back to the track from
the lesson player, and the progress ring back on the track page shows 0 % for the entire
duration of the first course regardless of how many lessons have been watched.

The existing plan `docs/plans/2026-05-31-002-feat-learning-track-detail-hero-ui-plan.md`
already polished the hero surface. This plan addresses the navigation and data layers that
plan left untouched.

## Requirements Trace

- R1. Clicking "Continue lesson", the hero CTA, or any course in the syllabus from
  `/learning-tracks/:trackId` navigates to the course/lesson page while preserving track
  context so the Layout back-link shows "← {trackName}" and navigates to
  `/learning-tracks/:trackId`.
- R2. Track context survives the full lesson-player session (Previous / Next lesson
  navigation stays within the same tab; refreshing the lesson page is allowed to lose state).
- R3. The progress ring in PathProgressSidebar shows lesson-level completion, not a
  course-completion ratio. A track with one course 19 % complete must show > 0 %.
- R4. `estimatedRemainingHours` is never negative. The display guard (`> 0 ? '~Xh' : '0h'`)
  is present in PathProgressSidebar and the computation is clamped at source.
- R5. ContinueLearningBento shows the course's position within the track ("Course X of Y")
  and removes the redundant "% remaining" stat.
- R6. The Syllabus "Edit" button is visually demoted so it does not compete with
  content-consumption actions.
- R7. Hero top-padding is reduced so the ContinueLearningBento is visible without scrolling
  on a standard 1080 p desktop viewport.

## Scope Boundaries

- No new routes, no nested route changes under `/learning-tracks/:trackId/courses/...`.
- Navigation state uses React Router `location.state`; it is intentionally lost on hard
  refresh (acceptable — the user is then on the course page, which is its own valid context).
- No changes to `PathHeroBanner` color palette, cover image, or hero-image treatment (those
  are owned by the 2026-05-31 plan). Top-padding adjustments to fit content above the fold on
  a standard 1080p desktop are in scope for Unit 4 of this plan.
- No changes to `usePathProgress` data model or IndexedDB schema.
- No changes to course/lesson components outside the back-link logic in `Layout.tsx`.
- No redesign of the `PathTimeline` / syllabus layout beyond the Edit button demotion.

### Deferred to Separate Tasks

- Lesson-player deep link back to track (e.g. `?from=track`) — deferred: router state covers
  the in-session case; persistent deep-link back requires URL-param coordination in routes.tsx.
- "Estimated Time Left" using real course durations instead of the 15 min/lesson estimate —
  deferred to a separate data-quality pass.

## Context & Research

### Relevant Code and Patterns

- `src/app/hooks/useCourseRoute.ts` — reads `useLocation().pathname` to derive
  `isCourseRoute`, `isLessonRoute`, `courseId`, `lessonId`, `courseName`. Uses `useLocation()`
  directly, so adding `location.state` reading here is the natural extension point.
- `src/app/components/Layout.tsx` lines 583-591 — the `isCourseRoute` back-link block
  unconditionally links to `/courses/${courseId}` with `{courseName}` as label. This is where
  `fromTrack` state should override destination and label.
- `src/app/components/learning-path/ContinueLearningBento.tsx` lines 31-33 — constructs
  `lessonPath` and uses it in two `<Link>` elements (play button and "Continue lesson" button)
  with no state passed.
- `src/app/components/learning-path/PathHeroBanner.tsx` lines 239-245 — the CTA `<Link>`
  navigates to the target lesson with no state.
- `src/app/pages/LearningTrackDetail.tsx` lines 571-578 — `onCourseClick` handler calls
  `navigate(...)` with no state.
- `src/app/pages/LearningTrackDetail.tsx` lines 221-229 — `enhancedProgress` incorrectly
  overrides `completionPct` with `(completedCourses / totalCourses) * 100` (course-level)
  instead of preserving the lesson-level value from `pathProgress.completionPct`.
- `src/app/hooks/usePathProgress.ts` lines 148, 153-154 — `remainingLessons` and
  `estimatedRemainingHours` are not clamped; can be negative if `completedLessons` exceeds
  `totalLessons` due to data inconsistency.
- `src/app/components/learning-path/PathProgressSidebar.tsx` line 40-41 — `formattedTime`
  guard: `estimatedRemainingHours > 0 ? '~Xh' : '0h'`. Must remain present.

### Institutional Learnings

- `docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md`
  — Pattern 4 (`backUrl` prop) documents the existing approach for URL-namespace-aware back
  links. The track-context problem is the same pattern applied one level deeper: not just
  "which list to go back to" but "which track the user came from when entering a course".
- Router `location.state` is established in the codebase for lightweight session flags:
  `__viaPalette`, `autoPlay`, `__fromMiniPlayer`, `fromNote`, `returnTab` — all read and
  consumed without persisting across refreshes. Adding `fromTrack` follows this exact pattern.

### External References

None required. The codebase has direct precedent for every change in this plan.

## Key Technical Decisions

- **Router state, not URL params, for track context.** Adding `?from=/learning-tracks/:id`
  to every lesson URL is noisy and leaks into copy-pasted links. Router state is invisible,
  session-scoped (lost on refresh — intentional and acceptable), and consistent with every
  other flag in the codebase (`autoPlay`, `__viaPalette`, etc.).
- **Extend `useCourseRoute` to expose `fromTrack`.** This keeps `Layout.tsx` clean; it reads
  one hook and makes one decision about the back-link destination. The alternative (reading
  `useLocation().state` directly in `Layout`) creates a second location-reading site that
  diverges from `useCourseRoute`'s single source of truth.
- **Fix `enhancedProgress` to stop overriding `completionPct`.** The `pathProgress.completionPct`
  from `usePathProgress` is lesson-level and meaningful from the first watched video. The
  current override with `(completedCourses / totalCourses) * 100` is wrong: it should only
  ever return non-zero once a course reaches 100 %, leaving the ring at 0 % for the entire
  duration of the first course.
- **Remove "% remaining" from ContinueLearningBento; add course position.** "81 % remaining"
  is mathematically redundant with "19 % complete" and is framed negatively. Replacing it
  with the course's ordinal position in the track ("Course 1 of 55") gives orientation
  instead of redundant math.

## Open Questions

### Resolved During Planning

- **Will losing track state on hard refresh cause user confusion?** Acceptable — a page
  refresh on `/courses/:id/lessons/:id` is a valid standalone URL. The user is on the course
  page and the course back-link is correct in that context.
- **Should Previous/Next lesson navigation preserve track state?** Yes — but it requires
  explicit forwarding. React Router's `navigate(lessonPath)` calls in `UnifiedLessonPlayer`
  (lines ~592, ~603) navigate to a different pathname and do **not** carry forward the current
  `location.state` automatically. Each call must spread `location.state` to preserve
  `fromTrack`. The same applies to `handleAutoAdvance` and `handleCelebrationContinue` in
  `useCompletionFlow.ts`, which build their own state objects and must merge `fromTrack` in.
- **Should the course position be passed as a prop or computed in the bento?** Passed as a
  prop from `LearningTrackDetail`, which already has `courseEntries` and knows the index.

### Deferred to Implementation

- Whether `usePathProgress` needs a more accurate `estimatedRemainingHours` using
  `totalDuration` from imported courses vs the 15 min/lesson estimate.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not
> implementation specification. The implementing agent should treat it as context, not code
> to reproduce.*

```
Track Detail page
  LearningTrackDetail
    ↓ navigate({ state: { fromTrack: { trackId, trackName } } })
    ↓
  ContinueLearningBento   → <Link to="/courses/X/lessons/Y"
                               state={{ fromTrack: { trackId, trackName } }}>
  PathHeroBanner CTA      → <Link to="/courses/X/lessons/Y"
                               state={{ fromTrack: { trackId, trackName } }}>
  PathTimeline click      → navigate("/courses/X/lessons/Y",
                               { state: { fromTrack: { trackId, trackName } } })

Lesson Player page
  Layout
    useCourseRoute()
      → reads location.state.fromTrack
      → exposes fromTrack in CourseRouteInfo
    back-link:
      if fromTrack  → "← {trackName}"  href="/learning-tracks/{trackId}"
      else          → "← {courseName}" href="/courses/{courseId}"   (existing)
```

## Implementation Units

- [ ] **Unit 1: Preserve track context through course/lesson navigation**

**Goal:** When the user navigates from `/learning-tracks/:trackId` to any course or lesson,
pass `{ fromTrack: { trackId, trackName } }` in router state so that the Layout back-link
can reconstruct a "← {trackName}" link back to the track.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/app/hooks/useCourseRoute.ts`
- Modify: `src/app/components/Layout.tsx`
- Modify: `src/app/components/learning-path/ContinueLearningBento.tsx`
- Modify: `src/app/components/learning-path/PathHeroBanner.tsx`
- Modify: `src/app/pages/LearningTrackDetail.tsx`
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx`
- Modify: `src/app/hooks/useCompletionFlow.ts`
- Test: `src/app/components/learning-path/__tests__/ContinueLearningBento.test.tsx`
- Test: `src/app/hooks/__tests__/useCourseRoute.test.ts`
- Test: `tests/e2e/learning-tracks.spec.ts`

**Approach:**

_useCourseRoute.ts_
- Extend `CourseRouteInfo` to add `fromTrack?: { trackId: string; trackName: string }`.
- Read `useLocation().state` and narrow it to the shape `{ fromTrack?: { trackId: string; trackName: string } }`.
- Return the `fromTrack` field alongside existing fields.

_Layout.tsx_ (lines 583–591)
- After destructuring `useCourseRoute()`, also destructure `fromTrack`.
- When `isCourseRoute && fromTrack`, render `<Link to={'/learning-tracks/' + fromTrack.trackId}>← {fromTrack.trackName}</Link>` instead of the current `/courses/${courseId}` link.
- When `isCourseRoute && !fromTrack`, keep the existing behavior unchanged.

_ContinueLearningBento.tsx_
- Add optional `trackId?: string` and `trackName?: string` props.
- Pass `state={{ fromTrack: { trackId, trackName } }}` on both `<Link>` elements (play button and "Continue lesson" button) when `trackId` is present.

_PathHeroBanner.tsx_
- Add optional `trackId?: string` and `trackName?: string` props.
- Pass `state={{ fromTrack: { trackId, trackName } }}` on the CTA `<Link>` when `trackId` is present.

_LearningTrackDetail.tsx_
- Pass `trackId={trackId}` and `trackName={path.name}` to `ContinueLearningBento` and `PathHeroBanner`.
- In the `onCourseClick` handler, add `{ state: { fromTrack: { trackId, trackName: path.name } } }` to the `navigate()` call.

_UnifiedLessonPlayer.tsx_ — Prev/Next inline navigation (lines ~592, ~603) and autoPlay state-wipe effect (line ~110)
- **Prev button navigate call** (line ~592): change from
  `navigate(\`/courses/${courseId}/lessons/${prevLesson.id}\`)` to
  `navigate(\`/courses/${courseId}/lessons/${prevLesson.id}\`, { state: { ...location.state } })`
  so that `fromTrack` is carried forward across lesson navigation.
- **Next button navigate call** (line ~603): same pattern —
  `navigate(\`/courses/${courseId}/lessons/${nextLesson.id}\`, { state: { ...location.state } })`.
- **autoPlay state-wipe effect** (line ~110): change
  `navigate(location.pathname, { replace: true, state: {} })` to
  `navigate(location.pathname, { replace: true, state: { ...location.state, autoPlay: undefined } })`
  so the effect clears only the `autoPlay` flag and preserves `fromTrack` (and any other
  session flags) in the location state. Without this fix, the effect that fires on every
  lesson load would silently wipe `fromTrack`, breaking the back-link even though the explicit
  navigate calls above correctly forwarded it.

_useCompletionFlow.ts_ — `handleAutoAdvance` (line ~165) and `handleCelebrationContinue` (line ~197)
- **`handleAutoAdvance`**: merge `fromTrack` from the current location state into the
  navigation state object using conditional spreading so the key is omitted entirely when
  absent (keeps the TypeScript type contract clean — `fromTrack?: { trackId; trackName }`
  is `undefined`, not `null`):
  ```ts
  navigate(`/courses/${courseId}/lessons/${nextLesson.id}`, {
    state: {
      ...(autoPlay ? { autoPlay: true } : {}),
      ...(location.state?.fromTrack ? { fromTrack: location.state.fromTrack } : {}),
    },
  })
  ```
- **`handleCelebrationContinue`**: same conditional-spread pattern:
  ```ts
  navigate(`/courses/${courseId}/lessons/${nextLesson.id}`, {
    state: {
      ...(autoPlay ? { autoPlay: true } : {}),
      ...(location.state?.fromTrack ? { fromTrack: location.state.fromTrack } : {}),
    },
  })
  ```
- Both hooks already import and call `navigate`; add `useLocation` import and destructure
  `location` to read `location.state?.fromTrack`.
- **`useCallback` dependency arrays** — both `handleAutoAdvance` and `handleCelebrationContinue`
  use `useCallback`; after adding `useLocation`, add `location.state` (or a stable
  intermediate `const fromTrack = location.state?.fromTrack ?? undefined` via `useMemo`) to
  each callback's dependency array to satisfy the `react-hooks/exhaustive-deps` ESLint rule
  and prevent CI failures. Prefer the `useMemo` intermediate if the `location` object
  reference changes on every render and causes excess re-renders. Do not use
  `// eslint-disable` unless both approaches are confirmed unworkable.

**Patterns to follow:**
- `docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md`
  Pattern 4 (backUrl prop) and the `location.state` convention in `src/app/pages/UnifiedLessonPlayer.tsx`.
- `src/app/components/figma/SearchCommandPalette.tsx` for `navigate(path, { state: { ... } })` syntax.

**Test scenarios:**
- Happy path: from `/learning-tracks/:trackId`, clicking "Continue lesson" in ContinueLearningBento
  navigates to a lesson page and the Layout back-link shows "← {trackName}" and href
  `/learning-tracks/:trackId`.
- Happy path: clicking the hero CTA ("Start Learning" / "Continue Learning") similarly
  populates the back-link.
- Happy path: clicking a course row in the syllabus/timeline navigates to the course page
  and the back-link reads "← {trackName}".
- Edge case: navigating directly to `/courses/:courseId/lessons/:lessonId` (no state) keeps
  the existing back-link showing "← {courseName}" → `/courses/:courseId`.
- Edge case: pressing Previous/Next lesson inside `UnifiedLessonPlayer` does not clear the
  `fromTrack` state (verify the back-link stays as "← {trackName}" after navigating between lessons).
- Edge case: `useCourseRoute` with `location.state = null` or an unexpected shape returns
  `fromTrack: undefined` without throwing.
- Edge case: navigating to a lesson with both `{ autoPlay: true, fromTrack: { trackId, trackName } }`
  in location state — after the `autoPlay` state-wipe effect fires, assert that the Layout
  back-link still shows "← {trackName}" and routes to `/learning-tracks/:trackId` (i.e.,
  `fromTrack` was preserved and only `autoPlay` was cleared). This is the highest-risk
  regression scenario.
- Unit (`useCompletionFlow`): verify `handleAutoAdvance` passes `fromTrack` through to
  navigation state when `location.state.fromTrack` is set.
- Unit (`useCompletionFlow`): verify `handleCelebrationContinue` does the same.
- Integration (E2E): seed a track with one course and one lesson; navigate from the track
  detail through ContinueLearningBento into the lesson player; assert the Layout back-link
  text contains the track name and its href is `/learning-tracks/:trackId`.

**Verification:**
- Layout back-link shows the track name and links to the track when entering from a track.
- Layout back-link keeps the existing course-name/course-link behavior when entering from elsewhere.
- `useCourseRoute` unit tests pass for both state-present and state-absent cases.

---

- [ ] **Unit 2: Fix progress ring and estimated time**

**Goal:** Make the "Your Progress" ring show a meaningful (non-zero) percentage from the
first watched lesson, and eliminate the negative "Estimated Time Left" value.

**Requirements:** R3, R4

**Dependencies:** None (independent of Unit 1)

**Files:**
- Modify: `src/app/pages/LearningTrackDetail.tsx`
- Modify: `src/app/hooks/usePathProgress.ts`
- Modify: `src/app/components/learning-path/PathProgressSidebar.tsx`
- Test: `src/app/hooks/__tests__/usePathProgress.test.ts`

**Approach:**

_LearningTrackDetail.tsx_ — `enhancedProgress` memo
- Remove the `completionPct: (completedCourses / totalCourses) * 100` override.
- Keep only `completedCourses: pathProgress.completedCourses + manualCompletionsNotInAuto`
  and `totalCourses: Math.max(pathProgress.totalCourses, 1)`.
- The spread `...pathProgress` already brings `completionPct` (lesson-level) through; the
  explicit override was always wrong. After removal, the ring receives the hook's
  lesson-level percentage.

_usePathProgress.ts_ — `estimatedRemainingHours` computation (both single-path and
multi-path variants)
- Before computing `estimatedRemainingHours`, clamp:
  `const clampedRemaining = Math.max(0, remainingLessons)`.
- Use `clampedRemaining` in the hours formula.

_PathProgressSidebar.tsx_
- Verify the `estimatedRemainingHours > 0 ? '~Xh' : '0h'` guard exists (it is in the
  current source). No change needed if it's present; restore it if it was accidentally removed.
- Optionally: if `completionPct` rounds to 0 but is non-zero, render "< 1 %" instead of
  "0 %" to avoid the ring looking stuck.

**Patterns to follow:**
- Existing `MINUTES_PER_LESSON` constant and lesson-level aggregation in `usePathProgress.ts`.

**Test scenarios:**
- Happy path: a track with one 50-lesson course where 5 lessons are complete shows
  `completionPct = 10 %` in the sidebar ring.
- Happy path: a track with 55 courses where only 9.5 lessons of the first 50-lesson course
  are complete shows `completionPct ≈ 0.35 %` — not 0 %.
- Edge case: a track where `completedLessons > totalLessons` (data anomaly) produces
  `estimatedRemainingHours = 0`, never negative.
- Edge case: manually marking all 55 courses complete via `onMarkComplete` brings
  `completionPct` close to 100 % (the ring and the count align).
- Edge case: a track with zero courses shows 0 % without dividing by zero.

**Verification:**
- `usePathProgress` tests pass for corrupted-count and normal scenarios.
- Storybook or component snapshot for `PathProgressSidebar` shows the ring > 0 % when
  `completionPct = 0.35` is passed.
- No negative time value can appear in the sidebar.

---

- [ ] **Unit 3: Improve ContinueLearningBento with course position and cleaner stats**

**Goal:** Replace the redundant "81 % remaining" stat with the course's ordinal position in
the track ("Course 1 of 55"), giving users orientation without duplicating information.

**Requirements:** R5

**Dependencies:** Unit 1 (the bento already receives `trackId`/`trackName` props; extend
the same props update to carry `coursePosition` and `totalCourses`).

**Files:**
- Modify: `src/app/components/learning-path/ContinueLearningBento.tsx`
- Modify: `src/app/pages/LearningTrackDetail.tsx`
- Test: `src/app/components/learning-path/__tests__/ContinueLearningBento.test.tsx`

**Approach:**

_ContinueLearningBento.tsx_
- Add optional `coursePosition?: number` and `totalCourses?: number` props.
- In the stats row (currently `<Clock> {100 - pct}% remaining · {pct}% complete`):
  - Remove the `{100 - pct}% remaining` span entirely.
  - Keep `{pct}% complete`.
  - When `coursePosition` and `totalCourses` are provided, add a
    `Course {coursePosition} of {totalCourses}` badge/pill before or after the % stat.

_LearningTrackDetail.tsx_
- Compute `coursePosition` for `currentEntry`: `courseEntries.indexOf(currentEntry) + 1`.
- Pass `coursePosition` and `courseEntries.length` to `ContinueLearningBento`.

**Patterns to follow:**
- Existing `Clock` / `ArrowRight` icon usage in `ContinueLearningBento`.
- Pill/badge pattern: `<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">`.

**Test scenarios:**
- Happy path: when `coursePosition=1` and `totalCourses=55`, the bento renders
  "Course 1 of 55" and does NOT render a "% remaining" element.
- Happy path: when `coursePosition` is omitted, the bento renders "19 % complete" with no
  crash and no "Course X of Y" label.
- Edge case: `coursePosition=55, totalCourses=55` renders "Course 55 of 55" (last course).
- Regression: the play button and "Continue lesson" button still navigate to the correct
  lesson path (Unit 1 behavior is unchanged).

**Verification:**
- Component renders "Course X of Y" badge.
- "% remaining" text is absent from the rendered output.
- All existing navigation-related tests from Unit 1 continue to pass.

---

- [ ] **Unit 4: Reduce visual noise in the detail page layout**

**Goal:** Demote the Syllabus "Edit" button and trim the hero top-padding so the
ContinueLearningBento is visible without scrolling on a 1080 p desktop.

**Requirements:** R6, R7

**Dependencies:** Units 1–3 preferred first (reduces diff scope per review).

**Files:**
- Modify: `src/app/pages/LearningTrackDetail.tsx`
- Modify: `src/app/components/learning-path/PathHeroBanner.tsx`
- Test: `tests/e2e/learning-tracks.spec.ts`

**Approach:**

_LearningTrackDetail.tsx_ — Syllabus card header (lines 545–559)
- Change the "Edit" / "Done" `<Button>` from `variant="outline"` to `variant="ghost"` when
  not actively editing, so it reads as a secondary control rather than a primary action.
- Keep `variant="brand"` when `isEditing` is true (the active-edit state needs prominence).

_PathHeroBanner.tsx_ — hero container padding (line 104)
- Reduce `pt-24 sm:pt-36` to `pt-16 sm:pt-24` so more of the hero content is above the fold
  on a standard 1080 p desktop without removing the expressive photo strip entirely.
- Verify the cover image is still recognizable and the content surface does not float too
  close to the top of the hero.

**Technical design:** The current hero with `pt-36` (`144 px`) exposes the cover above the
content surface; reducing to `pt-24` (`96 px`) still gives a clear cover band while
recovering ~48 px of vertical real-estate.

**Patterns to follow:**
- `variant="ghost"` is already used in Layout and other secondary controls.
- `docs/solutions/best-practices/learning-track-hero-cover-readability-contrast-testing-2026-06-01.md`
  on preserving cover visibility during padding changes.

**Test scenarios:**
- Happy path: E2E at 1920×1080 viewport — after the hero loads, `hero-content-surface` is
  visible above the fold (viewport-clipped bounding rect top < 600 px).
- Happy path: Edit button renders without the `outline` border ring in non-editing state
  (assert `variant` prop or computed style).
- Regression: cover image still has nonzero height visible above the content surface after
  the padding reduction (screenshot / bounding-rect check).
- Regression: the hero back-link and CTA remain reachable by keyboard and meet 44×44 px
  touch targets at the reduced padding.

**Verification:**
- ContinueLearningBento is visible without scrolling at 1920×1080.
- "Edit" button is visually recessive in non-editing state.
- Hero cover image still exposes a recognizable band above the content card.

---

## System-Wide Impact

- **Interaction graph:** `LearningTrackDetail` → `PathHeroBanner` + `ContinueLearningBento`
  + `PathTimeline` (onCourseClick) all gain `fromTrack` state-passing. `useCourseRoute` and
  `Layout` are the consumers. No new components, no new routes.
- **Error propagation:** No new async paths. Router state is read synchronously.
- **State lifecycle risks:** `fromTrack` state is session-only and lost on refresh. This is
  intentional. The only regression risk is a navigation call that accidentally clears state
  (e.g., `navigate(path, { replace: true, state: {} })` in `UnifiedLessonPlayer`'s autoPlay
  clear effect). Verify that effect only touches `autoPlay` and leaves `fromTrack` intact —
  or that the `state: {}` wipe is narrowed to `{ autoPlay: undefined }`.
- **API surface parity:** `ContinueLearningBento` and `PathHeroBanner` gain new optional
  props. All new props are optional with undefined-safe defaults; no existing caller is broken.
- **Unchanged invariants:** The CTA in `PathHeroBanner` still navigates to the course/lesson
  URL (not the track). `backUrl="/learning-tracks"` in `PathHeroBanner` is unchanged. The
  `PathTimeline` drag-and-drop reorder logic is unchanged.
- **Integration coverage:** Unit tests alone cannot prove that the Layout back-link picks up
  `location.state` from a real navigation; the E2E test in `learning-tracks.spec.ts` is the
  only meaningful coverage for Units 1 and 4.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `UnifiedLessonPlayer`'s `navigate(pathname, { replace: true, state: {} })` for autoPlay clearing wipes `fromTrack` state | **Addressed in Unit 1.** The effect is narrowed to `{ ...location.state, autoPlay: undefined }` so only the `autoPlay` flag is removed; `fromTrack` and other session flags are preserved. Covered by the "Previous/Next lesson" edge case test in Unit 1. |
| `completionPct` from `usePathProgress` is very small (0.3 %) and rounds to "0 %" in the ring display | Add the "< 1 %" display guard to `PathProgressSidebar` for non-zero tiny values (Unit 2 approach note). |
| Hero padding reduction makes the cover feel compressed on tall-aspect photo covers | Keep `pt-24` minimum; verify with a portrait-ratio cover screenshot. |
| Tailwind v4 purges ghost/brand conditional classes if generated dynamically | Use complete literal class strings per `docs/solutions/best-practices/tailwind-v4-jit-class-literal-resolver-2026-04-25.md`. |

## Documentation / Operational Notes

- No database or storage changes; no deployment action beyond normal CI.
- The known-issues file (`docs/known-issues.yaml`) may have entries for the negative time
  and 0 % ring — mark them resolved once this plan ships.
- The `autoPlay` state-wipe narrowing (Risks table, addressed in Unit 1) should be
  documented in `docs/solutions/` once shipped, as it is a non-obvious React Router v7
  pattern affecting any hook that clears a single location-state flag.

## Sources & References

- User screenshots (2026-06-01): `/learning-tracks/:id` page showing "-210.5h", "0 %
  COMPLETE", "0/55 Modules Completed", and the lesson player showing "← P1-01 ..." back-link
  to the course instead of the track.
- Related plan: `docs/plans/2026-05-31-002-feat-learning-track-detail-hero-ui-plan.md`
- Related learning: `docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md`
- Related learning: `docs/solutions/best-practices/learning-track-hero-cover-readability-contrast-testing-2026-06-01.md`
- Related code: `src/app/hooks/useCourseRoute.ts`
- Related code: `src/app/components/Layout.tsx` lines 583-591
- Related code: `src/app/components/learning-path/ContinueLearningBento.tsx`
- Related code: `src/app/components/learning-path/PathHeroBanner.tsx`
- Related code: `src/app/pages/LearningTrackDetail.tsx` lines 221-229, 571-578
- Related code: `src/app/hooks/usePathProgress.ts` lines 148, 153-154
- Related code: `src/app/components/learning-path/PathProgressSidebar.tsx` lines 40-41
