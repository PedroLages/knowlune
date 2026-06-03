---
title: "fix: Learning Track Detail UX/UI fixes (CTA overlap, atmosphere removal, redundancy)"
type: fix
status: active
date: 2026-06-03
deepened: 2026-06-03
---

# fix: Learning Track Detail UX/UI fixes (CTA overlap, atmosphere removal, redundancy)

## Overview

Three UX/UI fixes for the `/learning-tracks/:trackId` detail page, reported from
live screenshots of the "Photography Mastery Roadmap" track:

1. The hero **"Continue Learning" CTA** (plus the avatar stack and "X of N completed"
   text) is partially covered by the `ContinueLearningBento` card because the content
   area deliberately overlaps the hero with a negative top margin.
2. The page has a **cover-derived blurred atmosphere** (brown/orange glow behind the
   cards) that the user wants removed.
3. The current course is shown **twice in immediate succession** — once in the big
   "Continue Learning" card and again as "Module 1" in the Syllabus — which reads as
   redundant.

This work partially **supersedes** the June 1 cinematic redesign (PR #587), which
introduced both the negative overlap and the page-scoped atmosphere as intentional
design decisions. The overlap is *reduced* (not removed) to preserve the cinematic
"cards rise over the stage" feel while guaranteeing interactive content stays clear;
the atmosphere is removed entirely per user request.

## Problem Frame

In `src/app/pages/LearningTrackDetail.tsx`, the content area below the hero uses a
negative top margin to lift the cards onto the hero's lower edge:

```
<div className="-mt-8 sm:-mt-10 lg:-mt-12 relative z-10">
  <PathCinematicAtmosphere coverUrl={path.coverImageUrl} coverPreset={path.coverPreset} />
  ...
```

The hero (`PathHeroBanner`) anchors its content (title → description → CTA row →
avatars → "X of N completed") to the **bottom** of the stage via `flex flex-col
justify-end` with only `p-4 sm:p-6 lg:p-8` padding. Because the overlap (32/40/48px)
**exceeds the hero's bottom padding** (16/24/32px), the rising cards land directly on
top of the CTA row instead of on empty cover space above it. That is the collision in
the screenshot.

The brown/orange backdrop is `PathCinematicAtmosphere` — a blurred, low-opacity copy
of `path.coverImageUrl` rendered behind the content column (`absolute inset-0 -z-10`).

The "0 of 55 completed" text is already dynamic (`completedCount={completedEntries.length}`),
counting fully-completed (100%) modules; it reads 0 because no module is fully complete
yet while the ring shows 1% and the current course shows 23%. **User decision: leave it
as-is** — the progress ring (radial indicator) shows overall progress including partial
completions, while the "X of N completed" count shows only fully-completed (100%) modules.
These are different metrics measuring different things; both are valid and informative, so
no change is needed to the count display.

## Requirements Trace

- R1. The hero CTA, avatar stack, and "X of N completed" row are never visually
  overlapped by the `ContinueLearningBento` card or the Syllabus card, at desktop
  (1440px), tablet (768px), and mobile (375px). A modest cinematic overlap onto the
  hero's empty cover area is retained.
- R2. The cover-derived blurred atmosphere is removed from the detail page; the content
  area renders over the plain theme background.
- R3. (Resolved — no change) The hero completion count keeps its existing dynamic value
  and copy.
- R4. (Polish) Reduce the *perceived* redundancy of the current course appearing in both
  the Continue card and the Syllabus, **without** breaking roadmap completeness, the
  `Module N` numbering, or the "N Courses" header count.
  - R4a. (Scope addition from deepening) Round `estimatedRemainingHours` to a whole number
    in sidebar and summary panel displays for cleaner presentation. This was included in
    the original Unit 3 approach but lacked an explicit requirement — added here to close
    the traceability gap.

## Scope Boundaries

- The full Syllabus continues to list **every** module in order, including the current
  one. We are **not** using `PathTimeline`'s `skipCourseId` to hide the current course
  (see Key Technical Decisions for rationale).
- The cinematic hero itself (cover image, fixed dark scrim, WCAG contrast guarantee,
  Ken Burns entrance, brand CTA) is unchanged. Only the content-area overlap amount and
  the hero's bottom padding may change.
- No data-model, store, or progress-calculation changes.
- No new npm packages.

### Deferred to Separate Tasks

- Broader terminology unification across the page ("courses" vs "modules" vs "syllabus")
  is out of scope here; only the in-progress module label/button copy is touched (R4).

## Context & Research

### Relevant Code and Patterns

- `src/app/pages/LearningTrackDetail.tsx` (lines ~536–693) — renders the full-width
  hero breakout (`-mx-4 -mt-4 sm:-mx-6 sm:-mt-6`), then the content wrapper
  (`-mt-8 sm:-mt-10 lg:-mt-12 relative z-10`) containing `PathCinematicAtmosphere`, the
  `ContinueLearningBento`, the Syllabus card with `PathTimeline`, and the
  `PathProgressSidebar`.
- `src/app/components/learning-path/PathHeroBanner.tsx` — hero stage. Content surface is
  `data-testid="hero-content-surface"` with `relative z-10 p-4 sm:p-6 lg:p-8`; the CTA is
  `data-testid="hero-cta"`; the lower band (`max-w-3xl`) holds chips/title/description/
  CTA row/avatars/"X of N completed".
- `src/app/components/learning-path/PathCinematicAtmosphere.tsx` — the blurred cover
  backdrop to remove. **Only consumer is `LearningTrackDetail.tsx`** (verified by repo
  grep) — safe to delete the component file.
- `src/app/components/learning-path/PathTimeline.tsx` + `TimelinePrimitives.tsx` —
  timeline cards. `isInProgress` is a single boolean; `hasRealProgress`
  (`completionPct > 0 && < 100`) is computed in `PathTimeline` (lines ~606 & ~676) but
  **not** passed down. Status label "Up Next" and button "Start Module" are derived from
  `isInProgress` only, so an in-progress-with-real-progress module currently shows the
  same "Up Next" / "Start Module" as a not-yet-started next module.
- `src/app/components/learning-path/PathProgressSidebar.tsx` (line ~40) — formats
  `Estimated Time Left` as `~${estimatedRemainingHours}h`, where the hook returns one
  decimal (e.g. `~210.3h`).

### Institutional Learnings

- `docs/solutions/best-practices/learning-track-detail-cinematic-redesign-implementation-lessons-2026-06-01.md`
  — documents the negative overlap (`-mt-8 sm:-mt-10 lg:-mt-12`) and the
  `PathCinematicAtmosphere` (adapted from `AudiobookPlayerAtmosphere`) as **intentional**
  PR #587 decisions. Reducing the overlap and removing the atmosphere knowingly
  supersedes parts of this; the doc should be updated post-merge (see Documentation Notes).
- The same doc + `learning-track-hero-cover-readability-contrast-testing-2026-06-01.md`
  establish the **fixed dark scrim** WCAG guarantee — untouched by this work, so contrast
  tests stay green.
- `PathHeroBanner.test.tsx` asserts `'2 of 5 completed'` copy and that the cover image is
  full-bleed (not the rejected blurred-atmosphere treatment) — both remain valid since we
  don't change the count copy and don't touch the hero cover image.

### External References

- None. This is well-patterned Tailwind/React layout work with strong local precedent;
  no external research needed.

## Key Technical Decisions

- **Reduce the overlap, don't remove it (R1).** Preserve the PR #587 cinematic effect by
  keeping a small overlap onto the hero's *empty* lower cover area. The fix is an
  invariant: **content overlap must be ≤ the hero's bottom padding below the CTA row.**
  Achieve it by (a) increasing the hero content surface's bottom padding so the CTA row
  sits higher above the hero's bottom edge, and/or (b) shrinking the content wrapper's
  negative margin. Exact px tuned during implementation via screenshots at all three
  breakpoints.
- **Remove the atmosphere entirely and delete the component (R2).** User decision. It has
  no other consumers, so leaving it as dead code adds maintenance cost. Keep the
  `relative z-10` on the content wrapper (still needed so cards stack above the hero's
  overlapped edge).
- **No change to the completion count (R3).** It is already dynamic; user is satisfied.
- **Keep the full Syllabus; do not dedupe with `skipCourseId` (R4).** A roadmap should
  show all modules in order. `skipCourseId` would break `Module N` numbering continuity,
  mismatch the "N Courses" header, and remove the auto-scroll "you are here" anchor.
  Instead, reduce perceived redundancy by making the in-progress module a clear
  "Continue" anchor (label "In Progress" + button "Continue Module" when it has real
  progress), so the card and the syllabus row read as "shortcut" vs "map" rather than a
  raw duplicate.

## Open Questions

### Resolved During Planning

- Overlap fix approach → **reduce** (keep a small cinematic overlap, raise the CTA row).
- Atmosphere → **remove entirely**.
- Completion count → **no change** (already dynamic).
- Dedupe current course → **no** (keep full syllabus; improve in-progress labeling instead).

### Deferred to Implementation

- Exact padding/margin px values for the overlap fix — tuned visually per breakpoint so
  the cards just kiss the hero's lower edge without touching the CTA row.
- Whether the in-progress label/button copy change (R4) needs the new `hasRealProgress`
  prop threaded into both `CourseTimelineEntry` and `SortableCourseTimelineEntry`, or only
  the read-only variant — confirm both render paths during implementation.

## Implementation Units

- [ ] **Unit 1: Reduce hero/content overlap so the CTA row is never covered**

**Goal:** Eliminate the collision between the rising content cards and the hero's
CTA/avatars/"X of N completed" row, while keeping a modest cinematic overlap.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/LearningTrackDetail.tsx` (the `-mt-8 sm:-mt-10 lg:-mt-12 relative z-10` wrapper, ~line 559)
- Modify: `src/app/components/learning-path/PathHeroBanner.tsx` (bottom padding of the lower content band / `hero-content-surface`, ~lines 188 & 233–316)
- Test: `tests/e2e/learning-track-hero.spec.ts` (add a no-overlap geometry assertion)

**Approach:**
- Enforce the invariant *content overlap ≤ hero bottom padding below the CTA row*.
- Lever A (preferred): add extra bottom padding to the hero's lower band (e.g. a
  `pb-*`/`lg:pb-*` on the `max-w-3xl` content block or `hero-content-surface`) so the CTA
  row floats above the hero's bottom edge by more than the overlap distance.
- **Short-hero upper bound:** On hero images with short natural height (portrait or
  cropped covers), excessive bottom padding may push the CTA uncomfortably high above the
  fold. Apply a reasonable upper bound — total bottom padding should not exceed ~64px on
  desktop or ~48px on mobile. Consider conditioning the padding increase on the hero cover
  image's aspect ratio (e.g., no extra padding boost for images with height < `min-h-[400px]`
  at desktop) if implementation complexity is acceptable.
- Lever B (optional): reduce the wrapper's negative margin (e.g. `-mt-8 sm:-mt-10 lg:-mt-12`
  → a smaller value) if Lever A alone doesn't fully clear mobile.
- Verify the full-width breakout (`-mx-4 -mt-4 sm:-mx-6 sm:-mt-6`) and `relative z-10`
  stacking are preserved (no horizontal scroll, cards still above the hero edge).

**Patterns to follow:**
- Existing breakpoint-scaled spacing in `LearningTrackDetail.tsx` and `PathHeroBanner.tsx`.
- `data-testid` locators (`hero-cta`, `hero-content-surface`, `hero-section`) per KI-099.

**Test scenarios:**
- Happy path (E2E, desktop 1440px): seed a path with ≥1 in-progress course so both the
  `hero-cta` and the `ContinueLearningBento` card render; assert `hero-cta` bounding-box
  bottom ≤ the Continue card's bounding-box top (no vertical overlap).
- Edge case (E2E, tablet 768px and mobile 375px): same no-overlap assertion; also assert
  no horizontal scroll (`scrollWidth ≤ innerWidth + 2`, matching existing specs).
- Regression: existing `PathHeroBanner.test.tsx` assertions (CTA present, brand-filled,
  44px touch target, "X of N completed" copy) remain green.

**Verification:**
- At all three breakpoints, the CTA / avatars / "X of N completed" row is fully visible
  and not covered; a small overlap onto the hero's empty cover area remains.

- [ ] **Unit 2: Remove the cover-derived atmosphere from the detail page**

**Goal:** Remove the blurred brown/orange backdrop so the content renders over the plain
theme background.

**Requirements:** R2

**Dependencies:** Unit 1 (advisory — edits the same `LearningTrackDetail.tsx` wrapper block; sequencing after avoids merge conflicts but is not a semantic dependency)

**Files:**
- Modify: `src/app/pages/LearningTrackDetail.tsx` (remove the `<PathCinematicAtmosphere ... />` render, ~lines 560–564, and its import, ~line 12)
- Delete: `src/app/components/learning-path/PathCinematicAtmosphere.tsx` (no other consumers)

**Approach:**
- Remove the component render and its import.
- Keep the wrapper's `relative z-10` (still needed for card stacking over the hero edge);
  only the `-z-10` atmosphere child goes away.
- Confirm no test imports `PathCinematicAtmosphere` before deleting (repo grep showed only
  the page consumes it; re-verify, then delete to avoid dead code and an unused-export lint).

**Patterns to follow:**
- Clean component removal — delete file + import + usage together so lint stays clean.

**Test scenarios:**
- Test expectation: none — purely decorative removal with no behavioral change.
- Verification is via build/lint (no unused import or dangling reference) and a visual
  check that the page background is the plain theme background.

**Verification:**
- The detail page no longer shows the blurred cover glow; `npm run build` and lint pass
  with no unused-import/dead-export warnings.

- [ ] **Unit 3 (In-progress module labeling + sidebar polish): Make the in-progress module a clear "Continue" anchor**

**Goal:** Reduce the perceived redundancy of the current course showing in both the
Continue card and the Syllabus by distinguishing an in-progress module from a
not-yet-started one, and round the sidebar "Estimated Time Left" to a whole number.

**Requirements:** R4 (including R4a below)

**Dependencies:** None (independent of Units 1–2)

**Files:**
- Modify: `src/app/components/learning-path/PathTimeline.tsx` (thread `hasRealProgress` into the timeline entry, both read-only and editable/`Sortable` render paths, ~lines 603–631 & 673–701)
- Modify: `src/app/components/learning-path/TimelinePrimitives.tsx` (`EntryActionButton`: "Start Module" → "Continue Module" when the module has real progress)
- Modify: `src/app/components/learning-path/SortableCourseTimelineEntry.tsx` (accept/pass the new flag if it renders its own label/button)
- Modify: `src/app/components/learning-path/PathProgressSidebar.tsx` (round `estimatedRemainingHours` for display, ~line 40)
- Modify: `src/app/components/learning-path/PathSummaryPanel.tsx` (round `estimatedRemainingHours` for display consistency, ~line 48)
- Test: `src/app/components/learning-path/__tests__/PathTimeline.test.tsx`
- Test: `src/app/components/learning-path/__tests__/ContinueLearningBento.test.tsx` (only if labels there change — likely not)

**Approach:**
- Pass the already-computed `hasRealProgress` boolean down to the entry card so the
  status label can read "In Progress" (real progress) vs "Up Next" (next unlocked,
  unstarted), and `EntryActionButton` can read "Continue Module" vs "Start Module".
- Apply to **both** the read-only `CourseTimelineEntry` and the editable
  `SortableCourseTimelineEntry` paths so edit mode matches.
- Sidebar and SummaryPanel: format as `~${Math.round(estimatedRemainingHours)}h`
  (display-only; do not change the hook so the list page is unaffected). Use a
  defensive guard in both: `estimatedRemainingHours > 0 ? Math.round(estimatedRemainingHours) : 0`
  to avoid `~NaNh` if the hook returns null/undefined.
- Round **both** `PathProgressSidebar` and `PathSummaryPanel` consistently — they
  consume `estimatedRemainingHours` from the same `usePathProgress` hook; rounding
  only one would create a display inconsistency.

**Patterns to follow:**
- Existing `statusLabel` / `EntryActionButton` status switch in
  `TimelinePrimitives.tsx` and the `isCompleted`/`isInProgress` prop flow in
  `PathTimeline.tsx`.

**Test scenarios:**
- Happy path: module with `completionPct` between 1–99 → status label "In Progress" and
  action button "Continue Module".
- Edge case: next-unlocked module with 0% progress (and no prior progress in the track) →
  retains "Up Next" / "Start Module".
- Edge case: completed module (100% or manually completed) → still "Completed" / "Review"
  (unchanged).
- Edge case: sidebar formats `210.3` as `~210h` and `0` as `0h` (existing zero path).
- Edge case: SummaryPanel formats `210.3` as `~210h` (consistency with sidebar).
- Edge case (NaN guard): hook returns null/undefined `estimatedRemainingHours` → both
  sidebar and SummaryPanel show `0h` instead of `~NaNh`.
- Regression: locked modules still render no action button and the "Locked" pill.

**Verification:**
- The current (in-progress) syllabus module visibly reads as a "Continue" anchor distinct
  from later "Up Next" modules; sidebar shows a whole-number hour estimate.

## System-Wide Impact

- **Interaction graph:** Units 1–2 touch only `LearningTrackDetail.tsx` layout and the
  `PathHeroBanner` padding; no data flow changes. Unit 3 adds one derived boolean prop
  through the timeline rendering paths.
- **API surface parity:** `PathTimeline` / timeline cards are also used in edit mode and
  potentially elsewhere — Unit 3 must update both render paths so behavior is consistent.
  (`PathCinematicAtmosphere` is single-consumer, so its removal has zero blast radius.)
- **Unchanged invariants:** The cinematic hero, fixed dark scrim, WCAG contrast guarantee,
  hero cover image, completion-count copy (`"X of N completed"`), `skipCourseId` behavior,
  module numbering, and the "N Courses" header all stay exactly as they are.
- **Integration coverage:** The no-overlap fix is geometric and best proven by an E2E
  bounding-box assertion across breakpoints, which unit tests cannot cover.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Reducing overlap on mobile leaves a too-large or too-small gap | Tune per breakpoint with screenshots; assert no-overlap via E2E bounding boxes at 1440/768/375px |
| Deleting `PathCinematicAtmosphere` breaks an unseen import | Re-grep for the symbol immediately before deletion; rely on build/lint to catch dead refs |
| Unit 3 label change misfires (shows "Continue" on an unstarted module) | Gate strictly on `hasRealProgress` (`completionPct > 0 && < 100`), with explicit unit tests for the 0% next-unlocked case |
| Superseding PR #587 decisions without a paper trail | Update the cinematic-redesign solution doc post-merge to note overlap reduced + atmosphere removed |

## Documentation / Operational Notes

- Post-merge, update
  `docs/solutions/best-practices/learning-track-detail-cinematic-redesign-implementation-lessons-2026-06-01.md`
  to record that the negative overlap was reduced and `PathCinematicAtmosphere` was
  removed, so the learning doc doesn't drift from the code.

## Sources & References

- User report: live screenshots of `/learning-tracks/:trackId` ("Photography Mastery Roadmap"), 2026-06-03
- Related code: `src/app/pages/LearningTrackDetail.tsx`, `src/app/components/learning-path/PathHeroBanner.tsx`, `PathCinematicAtmosphere.tsx`, `PathTimeline.tsx`, `TimelinePrimitives.tsx`, `PathProgressSidebar.tsx`
- Related learnings: `docs/solutions/best-practices/learning-track-detail-cinematic-redesign-implementation-lessons-2026-06-01.md`, `learning-track-hero-cover-readability-contrast-testing-2026-06-01.md`
- Related (not origin) requirements: `docs/brainstorms/2026-05-09-learning-track-ux-improvements-requirements.md`
- Related tests: `tests/e2e/learning-track-hero.spec.ts`, `tests/e2e/learning-track-detail.spec.ts`, `src/app/components/learning-path/__tests__/PathHeroBanner.test.tsx`, `PathTimeline.test.tsx`
- Prior PR: https://github.com/PedroLages/knowlune/pull/587
