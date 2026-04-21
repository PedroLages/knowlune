---
title: "Course Cards: Research-Grounded Cross-Platform Refinements"
type: refactor
status: active
date: 2026-04-20
origin: docs/plans/2026-04-19-022-refactor-unified-course-card-visual-language-plan.md
---

# Course Cards: Research-Grounded Cross-Platform Refinements

## Overview

Apply concrete, evidence-backed refinements to Knowlune's course-facing card components (`CourseCard`, `ImportedCourseCard`) based on a cross-platform review of how Netflix, YouTube, Apple TV+, Disney+, Udemy, Coursera, MasterClass, and Spotify design their content cards in 2025–26.

The prior refactor ([2026-04-19-022-refactor-unified-course-card-visual-language-plan.md](docs/plans/2026-04-19-022-refactor-unified-course-card-visual-language-plan.md), commit `01cbeacc`) unified the card visual language. This follow-up sharpens the details that emerged from research and from review of the shipped UI — aspect-ratio consistency, Netflix-style inner-image scale on `ImportedCourseCard` (the one card that missed the pattern), a corner duration chip (YouTube/Vimeo convention), and resolution-as-overlay rather than stats-row item.

Because `CourseCard` and `ImportedCourseCard` are rendered by six consumer surfaces (MyClass, Courses, Overview, AuthorProfile, Authors, RecommendedNext), every refinement to the two components automatically propagates to all pages. No per-page edits required.

## Problem Frame

**Observed after the unified refactor shipped:**
- The cover uses a fixed height (`h-44`, ~176px) with no aspect-ratio enforcement. As grid column widths change across breakpoints (1/2/3/4/5 columns), the cover proportions drift. The industry convention for video-native content is a fixed aspect ratio, not a fixed height (YouTube/Udemy: 16:9; Apple TV+/Netflix portrait: 2:3).
- `ImportedCourseCard` skipped the `group-hover:scale-105` inner-image effect that `CourseCard` and `BookCard` already use. Netflix, Apple TV+, and MasterClass all rely on this micro-interaction. The asymmetry is visible when switching between catalog and imported grids.
- Duration is rendered inside the stats row (`134h 36m`), competing with videos/PDFs/resolution for visual weight. YouTube and Vimeo place runtime as a corner chip on the thumbnail — glanceable, out of the metadata hierarchy.
- Resolution (`4K`) is a solid `Badge` in the stats row next to icon-led stats, creating two information classes in one row. YouTube HDR/4K badges are typically thumbnail-corner overlays.

**Why it matters:** My Courses, Courses, Overview, and Author pages are the primary scan surfaces. Card-level consistency compounds — every micro-asymmetry multiplies across hundreds of grid impressions.

## Requirements Trace

- **R1.** All course covers render with a consistent aspect ratio across every breakpoint and every consumer page. The ratio is `aspect-video` (16:9) on course cards, matching YouTube and Udemy (the dominant sources of imported content).
- **R2.** `ImportedCourseCard` applies the same `group-hover:scale-105 transition-transform duration-500` to the cover `<img>` that `CourseCard` and `BookCard` already use. Pattern parity across all three cards.
- **R3.** Duration moves from the stats row to a bottom-right corner chip on the cover, using the existing scrim overlay pattern. The stats row drops from 3–4 items to 1–2 (videos, PDFs when non-zero). `course-card-duration` testid preserved on the new chip.
- **R4.** Resolution (`4K`/`1080p`) moves from stats row to a bottom-left corner chip on the cover when resolution ≥ 1080p (otherwise hidden — sub-HD is not a selling point). `course-card-resolution` testid preserved.
- **R5.** No regressions to any of the six consumer pages that render these cards (MyClass, Courses, Overview, AuthorProfile, Authors, RecommendedNext). No per-page edits required — refactor is component-local.
- **R6.** `CoverProgressBar` z-ordering remains correct below the new corner chips (progress bar visible, chips sit above it).
- **R7.** Existing testids remain stable: `course-card-duration`, `course-card-resolution`, `course-card-video-count`, `course-card-pdf-count`, `imported-course-card`, `status-badge`, `completion-badge`, `course-card-title`, `course-card-author`, `start-course-btn`. Tests that asserted text inside the stats row for duration/resolution update to the new DOM location (same testid, different parent).
- **R8.** WCAG AA preserved: corner chip contrast passes 4.5:1 via the same scrim tokens used for the status pill (`bg-black/60 text-white backdrop-blur-sm border border-white/10`). No change to keyboard nav, ARIA, or focus behavior.
- **R9.** `prefers-reduced-motion` disables the new `scale-105` hover transform (Knowlune already applies `motion-reduce:transition-none` on the existing card lift).

## Scope Boundaries

- **Non-goals:**
  - No changes to `BookCard` — already the reference.
  - No changes to prototype cards (`SwissCourseCard`, `HybridCourseCard`) — not shipped to users.
  - No new card variant; no changes to the three existing `CourseCard` variants (`library`, `overview`, `progress`).
  - No changes to the `CardCover` / `CoverProgressBar` / `PlayOverlay` / `CompletionOverlay` primitives in `CourseCardShell.tsx`. They already enforce everything we need; they just receive a new `heightClass` value.
  - No changes to `useCourseCardPreview` hover-video preview behavior.
  - No changes to data models, routing, or state stores.
  - No portrait (2:3) poster variant exploration. That's a future consideration — current YouTube-dominant content source argues for 16:9.

### Deferred to Separate Tasks

- **Portrait 2:3 variant for book-style courses (MasterClass-style):** If we later source content with portrait art (e.g., MasterClass imports or curated courses), a variant flag on `CardCover` can switch between `aspect-video` and `aspect-[2/3]`. Deferred until the use case materializes.
- **Autoplay video preview on hover (Netflix-style 500–800ms delayed trailer):** Partially exists via `useCourseCardPreview` but has known crop issues. Separate investigation.
- **Removing the resolution chip entirely for imports without resolution metadata:** Handled as part of this plan (hide when < 1080p or unknown).

## Context & Research

### Relevant Code and Patterns

- **Primary card files:**
  - [src/app/components/figma/ImportedCourseCard.tsx](src/app/components/figma/ImportedCourseCard.tsx) — line 303 passes `heightClass="h-44"`; line 314 renders the `<img>` without `group-hover:scale`; lines 625–673 define the stats row containing `data-testid="course-card-duration"` (line 639) and `course-card-resolution` (lines 665–671).
  - [src/app/components/figma/CourseCard.tsx](src/app/components/figma/CourseCard.tsx) — line 415 passes `heightClass="h-44"` (library/progress) and `h-32` (overview); lines 429, 456, 473 already apply `group-hover:scale-105` on the image.
  - [src/app/components/figma/CourseCardShell.tsx](src/app/components/figma/CourseCardShell.tsx) — `CardCover` accepts `heightClass: string`. Accepting an aspect-ratio class (e.g., `aspect-video`) works without any change to the primitive.
  - [src/app/components/figma/BookCard.tsx](src/app/components/figma/BookCard.tsx) — reference pattern: `aspect-square` (audiobooks, line 91), `aspect-[2/3]` (EPUB, line 202), `group-hover:scale-105 duration-500` on `<img>` (lines 97, 208).
- **Consumer pages (unchanged by this plan, but validated as unaffected):**
  - [src/app/pages/MyClass.tsx](src/app/pages/MyClass.tsx) — six render sites, lines 250, 269, 293, 314, 352, 386, 428.
  - [src/app/pages/Courses.tsx](src/app/pages/Courses.tsx) — line 269 (ImportedCourseCard in virtualized grid).
  - [src/app/pages/Overview.tsx](src/app/pages/Overview.tsx) — line 371 (CourseCard overview variant).
  - [src/app/pages/AuthorProfile.tsx](src/app/pages/AuthorProfile.tsx) — lines 268, 276.
  - [src/app/pages/Authors.tsx](src/app/pages/Authors.tsx) — lines 534, 542.
  - [src/app/components/RecommendedNext.tsx](src/app/components/RecommendedNext.tsx) — line 131.
- **Scrim pattern:** `OVERLAY_SCRIM_CLASS` constant at [src/app/components/figma/ImportedCourseCard.tsx:98](src/app/components/figma/ImportedCourseCard.tsx) — `bg-black/60 text-white backdrop-blur-sm border border-white/10`, already used for the status pill with a narrowly-scoped `eslint-disable-next-line design-tokens/no-hardcoded-colors`. Reuse for corner chips.

### Institutional Learnings

- **Unified shell pattern works:** [docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md](docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md) — the shared `CourseCardShell` primitives successfully propagated visual changes across pages with no per-consumer edits. This plan relies on that same property.
- **Design-token guardrails:** The single scrim exception with an explicit eslint-disable has held up well. The pattern: one constant, one disable, reused everywhere. Continue that pattern for corner chips — do not add new disables scattered through the file.

### External References (Cross-Platform Research)

Documented in the prior conversation turn; key findings integrated here:

- **YouTube** — [YouTube Thumbnail Size Guide (1280×720, 16:9)](https://piktochart.com/blog/youtube-thumbnail-size/). Runtime overlay chip bottom-right, `4K`/`HDR` badges as corner chips.
- **Udemy** — [Course Image Quality Standards (2048×1152, 16:9)](https://support.udemy.com/hc/en-us/articles/229232347-Course-Image-Quality-Standards).
- **Apple TV+** — [Artwork Requirements (2:3 portrait)](https://tvpartners.apple.com/support/3708-artwork-requirements) and [iOS 26 portrait shift](https://bendodson.com/weblog/2025/09/22/portrait-artwork-ios-26-apple-tv-app/). Shows industry drift toward portrait; relevant to R1's "Deferred" note.
- **Spotify** — [Cover Art Size Guide (1:1 square)](https://www.linearity.io/blog/spotify-size-guide/). Not directly applicable but confirms aspect-ratio enforcement as universal practice.
- **General card design** — [UX Design Institute Card Guide](https://www.uxdesigninstitute.com/blog/card-design-for-ui/) and [Card UI Best Practices 2026](https://bricxlabs.com/blogs/card-ui-design-examples). Fixed aspect ratio is called out explicitly as a card fundamental.

## Key Technical Decisions

- **Use `aspect-video` (16:9), not a portrait ratio.** Rationale: Knowlune's primary import sources are YouTube and Udemy, both native 16:9. Forcing portrait would require generating or cropping portrait art for imported content, which is out of scope. Revisit if/when the source mix shifts (see Deferred).
- **Pass the new ratio via `heightClass`, don't change `CardCover`'s API.** The primitive already accepts a string; `aspect-video` is a valid Tailwind utility. Zero changes needed to shell primitives; consumers simply pass `"aspect-video"` instead of `"h-44"`. Minimizes blast radius.
- **Move duration and resolution to cover corners, keep videos/PDFs in the stats row.** Rationale: duration and resolution are *attributes of the video asset* (glanceable next to the thumbnail); videos/PDFs are *inventory counts* (belong to the metadata row where they can have icons and context). This split mirrors YouTube, Vimeo, and Plex.
- **Hide resolution chip below 1080p.** Sub-HD is not a selling point; showing `480p` is noise. Matches YouTube HDR/4K-only badging.
- **Preserve all existing testids at their new DOM locations.** Tests that grep by testid keep working; tests that assert a testid is inside a specific parent will need minor updates. Listed explicitly in Unit 3.
- **Keep the `CourseCard` overview variant on its smaller height.** The overview variant today uses `h-32`. Switching it to `aspect-video` would either shrink or enlarge it depending on column width. Leave overview on `aspect-video` anyway — it becomes consistent rather than compact, which is the goal. Spot-check the Overview page after the change.
- **Do not introduce new design tokens for the chip scrim.** Reuse the existing `OVERLAY_SCRIM_CLASS` constant. If the constant needs to live outside `ImportedCourseCard.tsx` for reuse by `CourseCard.tsx`, promote it into `CourseCardShell.tsx` as an exported constant (non-component, colocated with the other shell primitives).

## Open Questions

### Resolved During Planning

- **Does every consumer page need a separate edit?** No — all six consumers pass only `course`/`variant`/data props; none override `heightClass` or the stats row. Component-level refactor propagates everywhere.
- **Does the overview variant (`h-32`) need special treatment?** No — switching it to `aspect-video` unifies behavior. Verified in Overview.tsx that the container column width is reasonable for a 16:9 cover.
- **What ratio should we use?** 16:9 (`aspect-video`). Decided above under Key Technical Decisions.
- **Do the existing scale-105 timings on `CourseCard` and `BookCard` agree?** Mostly — `BookCard` uses `duration-500`, `CourseCard` uses `duration-200`. Pick `duration-500` for the new `ImportedCourseCard` hover-scale to match `BookCard`'s softer feel, since imported content covers are photographs (longer, gentler animation reads nicer on photos). Also update `CourseCard`'s three sites from `duration-200` to `duration-500` for consistency across the three cards.

### Deferred to Implementation

- **Do existing unit tests assert `course-card-duration` is inside the stats row DOM?** Grep at implementation time; if yes, update to assert it's inside the cover container instead (same testid, different parent).
- **Will any e2e test screenshot the card in a way that changes because of the aspect-ratio swap?** Visual regression at implementation time via `/design-review`.
- **Exact pixel position of the corner chips:** `bottom-2 left-2` / `bottom-2 right-2` with `z-30` (above `CoverProgressBar`'s z-20). Final tuning may happen at implementation time if the chips clip the progress bar — in that case bump progress bar to `bottom-6` or stack chips above it.

## Implementation Units

- [ ] **Unit 1: Cover aspect ratio — swap `h-44`/`h-32` for `aspect-video`**

**Goal:** Enforce consistent 16:9 covers across all course cards at every breakpoint and consumer page.

**Requirements:** R1, R5.

**Dependencies:** None.

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx` (line 303 — change `heightClass="h-44"` to `heightClass="aspect-video w-full"`)
- Modify: `src/app/components/figma/CourseCard.tsx` (line 415 — replace all three variant height values with `"aspect-video w-full"`)
- Test: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx` (may need updates if any tests assert on fixed height)
- Test: `src/app/components/figma/__tests__/CourseCardShell.test.tsx`

**Approach:**
- The `CardCover` primitive already accepts the class string and applies it via `cn()`. `aspect-video` + `w-full` is a valid combination; the cover becomes `width * 9/16` tall.
- Inspect each consumer page at dev-time to confirm the new proportions look right in 1/2/3/4/5-column grids.
- No change to `CourseCardShell.tsx` is required for this unit.

**Patterns to follow:**
- [BookCard](src/app/components/figma/BookCard.tsx) — uses `aspect-square` and `aspect-[2/3]` via the same mechanism.

**Test scenarios:**
- Happy path: card renders with a 16:9 cover at mobile (375px), tablet (768px), desktop (1440px).
- Happy path: cover proportions identical between `CourseCard` (all variants) and `ImportedCourseCard`.
- Edge case: long titles still wrap cleanly below the cover with `line-clamp-2`.
- Integration: each of the six consumer pages (MyClass, Courses, Overview, AuthorProfile, Authors, RecommendedNext) renders without layout breakage.

**Verification:**
- Visual check in dev at `/my-class`, `/courses`, `/`, `/authors`, and an author profile page.
- Unit tests green; e2e regression suite green for card-related specs listed in Sources.

- [ ] **Unit 2: Inner-image `scale-105` hover on `ImportedCourseCard`**

**Goal:** Parity with `CourseCard` and `BookCard` — photographic thumbnails subtly zoom on hover, matching Netflix/Apple TV convention.

**Requirements:** R2, R9.

**Dependencies:** None (independent of Unit 1).

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx` (line 314 — add `group-hover:scale-105 transition-transform duration-500 motion-reduce:transition-none` to the `<img>` className)
- Modify: `src/app/components/figma/CourseCard.tsx` (lines 429, 456, 473 — change `duration-200` to `duration-500` for consistency)
- Test: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx`

**Approach:**
- The parent `CardCover` already has `overflow-hidden`, so the scaled image gets clipped cleanly.
- `motion-reduce:transition-none` (or `motion-reduce:scale-100`) respects `prefers-reduced-motion`.
- Apply to the `<img>` element only, not the video preview overlay (video stays 1:1 when active).

**Patterns to follow:**
- [BookCard.tsx:97](src/app/components/figma/BookCard.tsx) — `group-hover:scale-105 transition-transform duration-500`.
- [CourseCard.tsx:429](src/app/components/figma/CourseCard.tsx) — existing imperfect version to normalize.

**Test scenarios:**
- Happy path: hovering a card scales the `<img>` to 1.05x and returns on leave.
- Edge case: `prefers-reduced-motion: reduce` disables the transform.
- Edge case: hover-triggered video preview replaces the `<img>`; the video element is not scaled.
- Integration: works on touch devices (no hover — scale simply doesn't apply, no regressions).

**Verification:**
- Dev-time hover check.
- `/design-review` at mobile/tablet/desktop to confirm the transform is smooth.

- [ ] **Unit 3: Duration corner chip — promote from stats row to cover overlay**

**Goal:** Duration becomes a glanceable chip on the cover (bottom-right), freeing the stats row and matching YouTube/Vimeo convention.

**Requirements:** R3, R6, R7, R8.

**Dependencies:** Unit 1 (cover is now `aspect-video`, which gives the chip predictable positioning).

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`
  - Render a `<span data-testid="course-card-duration">` inside `CardCover`, positioned `absolute bottom-2 right-2 z-30`, using the scrim styling.
  - Remove the duration item from the stats row (the block at ~line 639).
- Modify: `src/app/components/figma/CourseCard.tsx` — same treatment for all three variants that currently render duration (lines 538, 673).
- Modify: `src/app/components/figma/CourseCardShell.tsx` — promote `OVERLAY_SCRIM_CLASS` here as an exported constant so both card files import it (also extract a tiny `CoverCornerChip` component that accepts `position: 'bottom-left' | 'bottom-right'` and `children` — prevents drift between the duration chip and the resolution chip in Unit 4).
- Modify: `src/app/components/figma/ImportedCourseCard.tsx` — remove the local `OVERLAY_SCRIM_CLASS` constant (line 98) and import from the shell.
- Test: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx` — update any assertion that scopes `course-card-duration` to the stats row.
- Test: `src/app/components/figma/__tests__/CourseCardShell.test.tsx` — add coverage for the new `CoverCornerChip`.

**Approach:**
- The chip uses `formatCourseDurationCompact` (already exists from the prior refinement pass) — drop minutes when `hours >= 10`.
- Z-order: chip `z-30`, `CoverProgressBar` `z-20`, `<img>` base. At `bottom-2`, the chip sits 8px above the progress bar (which is `h-1.5` on the bottom edge). Visually check: if overlap, use `bottom-3` on the chip.
- `status-badge` already uses `top-3 right-3 z-30`; corner chips at `bottom-2` don't collide.

**Patterns to follow:**
- Existing status pill: [ImportedCourseCard.tsx:360–395](src/app/components/figma/ImportedCourseCard.tsx) — same scrim, same positioning mechanism.
- YouTube runtime chip (external reference, visual-only).

**Test scenarios:**
- Happy path: course with `134h 36m` duration renders `134h` in the bottom-right chip of the cover.
- Happy path: course with `28m` duration renders `28m` in the chip.
- Edge case: course with zero duration (imported mid-progress) hides the chip entirely.
- Error path: `formatCourseDurationCompact` returns empty string → chip not rendered.
- Integration: chip does not overlap with `CoverProgressBar` at any progress value (0%, 50%, 100%).
- Integration: chip does not collide with `status-badge` (top-right) or category badge (top-left) at any card width.
- Accessibility: chip contrast ≥4.5:1 against a white photo background (test with a bright thumbnail).

**Verification:**
- Dev-time visual check at `/my-class` with courses of varying duration.
- Existing `course-card-duration` testid resolves; new parent is inside `CardCover`.

- [ ] **Unit 4: Resolution corner chip — promote from stats row; hide when sub-HD**

**Goal:** Resolution becomes a corner overlay (bottom-left) only when it's worth calling out (≥1080p). Matches YouTube `4K`/`HDR` corner badges.

**Requirements:** R4, R6, R7, R8.

**Dependencies:** Unit 3 (reuses the `CoverCornerChip` component).

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx` — render `<CoverCornerChip position="bottom-left" data-testid="course-card-resolution">` when `getResolutionLabel()` returns `'4K'`, `'1440p'`, or `'1080p'`; hide otherwise. Remove the resolution badge from the stats row (~line 665–671).
- Test: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx` — update resolution assertions.

**Approach:**
- Reuse `CoverCornerChip` from Unit 3.
- The `getResolutionLabel()` helper already handles mapping (e.g., 2160p → `4K`); add a predicate `isShowworthyResolution()` or inline the `>= 1080` check.
- Hide entirely when resolution is undefined or below 1080p.

**Patterns to follow:**
- Unit 3's duration chip.
- YouTube 4K/HDR corner badges.

**Test scenarios:**
- Happy path: 4K course shows `4K` chip bottom-left.
- Happy path: 1080p course shows `1080p` chip bottom-left.
- Edge case: 720p course → chip hidden.
- Edge case: unknown resolution → chip hidden.
- Integration: chip doesn't collide with other overlays (bottom-right duration, top-left category badge) at any card width.

**Verification:**
- Dev-time visual check with courses at varying resolutions.
- Existing `course-card-resolution` testid resolves.

- [ ] **Unit 5: Stats row cleanup — single coherent information class**

**Goal:** Stats row contains only icon-led inventory counts (videos, PDFs). Duration and resolution are already gone (Units 3, 4). Confirms visual coherence.

**Requirements:** R3, R4.

**Dependencies:** Units 3, 4.

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx` — inspect the stats row block (~lines 598–642) and confirm it contains only video count, PDF count (both already hide on zero). No other changes.
- Modify: `src/app/components/figma/CourseCard.tsx` — same audit, apply any cleanup to match.

**Approach:**
- This unit is primarily a validation/cleanup pass after the cover overlay work. If the stats row is already clean (no orphaned dividers, no empty flex children that push spacing), it's a no-op.
- If a leading divider dot or icon was duration-specific, remove it.

**Patterns to follow:**
- None specific — apply YAGNI here.

**Test scenarios:**
- Happy path: stats row shows `211 videos · 0 PDFs` hidden → `211 videos` alone for a video-only course.
- Edge case: course with no videos and no PDFs → stats row fully empty (should collapse gracefully; verify no extra whitespace).

**Verification:**
- Dev-time visual check.
- Unit tests green.

- [ ] **Unit 6: Visual regression sweep across all consumer pages**

**Goal:** Confirm the refactor propagates cleanly to every page without layout breakage.

**Requirements:** R5.

**Dependencies:** Units 1–5.

**Files:**
- No source edits expected.
- Test: `tests/e2e/regression/story-1-2-course-library.spec.ts`
- Test: `tests/e2e/regression/story-1-3-organize-by-topic.spec.ts`
- Test: `tests/e2e/regression/lesson-player-course-detail.spec.ts`
- Test: `tests/e2e/regression/story-e07-s01.spec.ts`
- Test: `tests/e2e/regression/story-e07-s04.spec.ts`
- Test: `tests/e2e/regression/story-e23-s05.spec.ts`
- Test: `tests/e2e/regression/e01-s06-delete-imported-course.spec.ts`

**Approach:**
- Run `/design-review` at mobile (375px), tablet (768px), desktop (1440px) on each consumer page: MyClass, Courses, Overview, AuthorProfile, Authors.
- Run the full unit + e2e regression suite.
- Spot-check the `VirtualizedGrid` on Courses.tsx — aspect-ratio covers inside virtualized rows need the grid's row-height calculation to be based on measured height (confirm no fixed row-height assumption in `VirtualizedGrid`).

**Test scenarios:**
- Integration: all six consumer pages render course grids without breakage.
- Integration: `VirtualizedGrid` on Courses.tsx scrolls without flicker or empty slots.
- Integration: hover effects work on every page (lift, image scale, play overlay, status dropdown).
- Accessibility: keyboard tab order unchanged across grids.

**Verification:**
- Unit tests green (`npm run test:unit`).
- E2E tests green for the listed specs.
- `/design-review` reports no new blockers or high-severity findings.
- Manual verification on the five production pages (prototypes excluded).

## System-Wide Impact

- **Interaction graph:** No changes to callbacks, middleware, or event flow. All changes are presentational.
- **Error propagation:** No new failure modes. Chips render or don't; no network or data dependencies.
- **State lifecycle risks:** None. Pure UI refactor.
- **API surface parity:** No public APIs change. Component props unchanged; only styling classes and internal DOM structure shift. The `CardCover` `heightClass` prop continues to accept any string.
- **Integration coverage:** Six consumer pages need dev-time visual verification. Virtualized grid (`Courses.tsx`) needs scroll-stability check.
- **Unchanged invariants:**
  - All testids (`course-card-duration`, `course-card-resolution`, `course-card-video-count`, `course-card-pdf-count`, `course-card-title`, `course-card-author`, `imported-course-card`, `status-badge`, `completion-badge`, `start-course-btn`) remain, even though some move to different DOM parents.
  - Keyboard activation behavior unchanged.
  - Status dropdown, edit/delete menu, hover-video preview, tag editor — all unchanged.
  - `CardCover` / `CoverProgressBar` / `PlayOverlay` / `CompletionOverlay` primitive APIs unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Aspect-video covers at narrow widths (mobile 1-column) become too tall | Spot-check mobile at 375px; if too tall, acceptable fallback is `aspect-[16/10]` or `aspect-[3/2]` — adjust in Unit 1 before committing. |
| Tests that scope duration/resolution testids to the stats row parent break | Catch at implementation time via test suite; update parent selector. Testids themselves preserved. |
| Corner chips overlap `CoverProgressBar` at 100% progress | Progress bar is `h-1.5` at bottom edge; chips at `bottom-2` sit above it. If visual overlap appears, bump chips to `bottom-3` or progress bar z-ordering takes precedence (chip fades over it). Resolve at implementation time. |
| `VirtualizedGrid` row-height calculation breaks because covers no longer have fixed height | `VirtualizedGrid` uses measured row heights (not fixed) per established Knowlune pattern; confirm in Unit 6. If it uses fixed heights, fall back to `min-h-[176px]` on card root. |
| Overview variant (`h-32` today) becomes too large at `aspect-video` inside the Overview grid | Spot-check the Overview page. If the grid columns are narrow enough that the covers look balanced, ship. If too tall, a one-off `aspect-[16/10]` override on the overview variant is acceptable. |
| Scrim corner chips reduce the visible area of the cover photo | Chips are ~24×24px + small padding — ≤5% of cover area. Accepted trade; industry standard. |

## Documentation / Operational Notes

- Update [docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md](docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md) after this plan ships, adding a note about: (a) aspect-ratio enforcement via `heightClass`, (b) the promoted `OVERLAY_SCRIM_CLASS` + `CoverCornerChip` primitives, (c) the corner-chip pattern and when to use it.
- No user-facing release note required — this is continuous polish.
- Run `/design-review` as part of `/review-story` before shipping.

## Sources & References

- **Origin plan:** [docs/plans/2026-04-19-022-refactor-unified-course-card-visual-language-plan.md](docs/plans/2026-04-19-022-refactor-unified-course-card-visual-language-plan.md)
- **Related solution doc:** [docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md](docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md)
- **Related code:**
  - [src/app/components/figma/ImportedCourseCard.tsx](src/app/components/figma/ImportedCourseCard.tsx)
  - [src/app/components/figma/CourseCard.tsx](src/app/components/figma/CourseCard.tsx)
  - [src/app/components/figma/CourseCardShell.tsx](src/app/components/figma/CourseCardShell.tsx)
  - [src/app/components/figma/BookCard.tsx](src/app/components/figma/BookCard.tsx)
- **Consumer pages:**
  - [src/app/pages/MyClass.tsx](src/app/pages/MyClass.tsx)
  - [src/app/pages/Courses.tsx](src/app/pages/Courses.tsx)
  - [src/app/pages/Overview.tsx](src/app/pages/Overview.tsx)
  - [src/app/pages/AuthorProfile.tsx](src/app/pages/AuthorProfile.tsx)
  - [src/app/pages/Authors.tsx](src/app/pages/Authors.tsx)
  - [src/app/components/RecommendedNext.tsx](src/app/components/RecommendedNext.tsx)
- **External research:**
  - [YouTube Thumbnail Size Guide (16:9)](https://piktochart.com/blog/youtube-thumbnail-size/)
  - [Udemy Course Image Quality Standards (16:9)](https://support.udemy.com/hc/en-us/articles/229232347-Course-Image-Quality-Standards)
  - [Apple TV Artwork Requirements (2:3)](https://tvpartners.apple.com/support/3708-artwork-requirements)
  - [Apple TV iOS 26 portrait shift](https://bendodson.com/weblog/2025/09/22/portrait-artwork-ios-26-apple-tv-app/)
  - [Spotify Cover Art Guide (1:1)](https://www.linearity.io/blog/spotify-size-guide/)
  - [Card UI Best Practices 2026 (Bricx)](https://bricxlabs.com/blogs/card-ui-design-examples)
  - [UX Design Institute — Card Design Guide](https://www.uxdesigninstitute.com/blog/card-design-for-ui/)
  - [Modern Card Hover Animation Patterns](https://dev.to/kadenwildauer/modern-card-hover-animations-css-and-javascript-3cg3)
