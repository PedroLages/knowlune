---
title: Unified Course Card Visual Language (audiobook-style)
type: refactor
status: active
date: 2026-04-19
---

# Unified Course Card Visual Language (audiobook-style)

## Overview

Redesign the three course-facing card components — `CourseCard` (library/overview/progress variants) and `ImportedCourseCard` — to share the "album-art" visual language already established by `BookCard` (audiobooks). The goal is visual uniformity across grids while preserving every functional affordance courses genuinely need: author avatar/link, stats row, status transitions, hover video preview, info popover, momentum/at-risk signals.

The redesign is cosmetic and structural — no data model, routing, or behavior changes. On `ImportedCourseCard` (the only card that has this CTA today), the "Start Studying" action becomes a hover-revealed Play overlay on the cover (Option B) instead of an inline body button that causes card-height inconsistency. `CourseCard` has no "Start Studying" CTA today and does not gain one in this plan.

## Problem Frame

**Observed:** Course cards and book cards feel like they belong to different apps. Book cards are cover-first and frameless (cover = card; metadata floats below). Course cards wrap a thumbnail + dense body in a heavy `<Card>` shell with uneven heights between `not-started` (has "Start Studying" CTA button) and `active` (no button) states. A pixelated crop bug in the inline hover-video preview makes the thumbnail look broken on some imported courses.

**User intent (from chat):**
- Unify design language between Books and Courses pages so the product feels cohesive.
- Keep the functional density of course cards — "don't lose what the course card provides today."
- Keep "Start Studying" because it's not redundant; it transitions `not-started → active` (moves the course into the My Class queue).
- Fix the broken hover preview crop as part of the same pass.

**Scope of "uniformity":** shared visual DNA (frameless covers, cover-bottom progress bar, corner-overlay badges, `-translate-y-2` hover lift, same title/author typography). Not shared: information density. Course cards keep author avatars, stats rows, popovers, and momentum badges — these stay, restyled to the new system.

## Requirements Trace

- **R1.** Visual DNA shared with `BookCard`: frameless cover (no `<Card>` chrome wrapping the whole thing), `rounded-2xl` + shadow on the thumbnail itself, `-translate-y-2` + `shadow-brand` hover lift, progress bar fused to cover bottom edge, status badge top-right on cover, type/category badge top-left on cover.
- **R2.** "Start Studying" retained as a hover-revealed Play overlay on the cover for `not-started` courses (Option B). On touch devices the overlay stays visible. Click still calls `handleStatusChange('active')`, then navigates.
- **R3.** All existing information preserved: author avatar + clickable link, stats row (videos / duration / PDFs / resolution / file size), info popover (description, tags, preview), momentum badge, at-risk badge, completion estimate, tag chips + tag editor (ImportedCourseCard only), status dropdown, edit/delete menu.
- **R4.** Card heights within a grid row become consistent regardless of course status — achieved by removing the inline CTA button and moving any conditional content out of the main body flow.
- **R5.** Hover video preview bug (cropped/pixelated rendering on some imported courses) is fixed; preview remains hover-activated with the existing `useCourseCardPreview` dismissal-guard semantics.
- **R6.** All design tokens come from `src/styles/theme.css` (no hardcoded colors). ESLint rule `design-tokens/no-hardcoded-colors` passes.
- **R7.** Existing test-ids remain stable (`course-card-{id}`, `imported-course-card`, `status-badge`, `completion-badge`, `completion-ring`, `start-course-btn`, `course-card-title`, `course-card-author`, `course-card-video-count`, `course-card-duration`, `course-card-pdf-count`, `course-card-resolution`, `course-card-file-size`, `tag-*`, `ai-tagging-indicator`, `delete-confirm-dialog`, `edit-course-menu-item`, `delete-course-menu-item`, `completion-progress-bar`) so downstream tests keep passing without churn.
- **R8.** WCAG AA accessibility preserved: keyboard activation (Enter/Space), focus visible states, ARIA labels on icon-only buttons, touch-target ≥44×44px, reduced-motion respected.

## Scope Boundaries

- **Non-goals:**
  - No changes to data models, routing, navigation, or course/book storage logic.
  - No changes to `BookCard` — it is the reference; we align to it.
  - No new variants. `CourseCard` keeps its three existing variants (`library`, `overview`, `progress`).
  - No changes to the `useCourseCardPreview` hook's public API (returned values, dismissal-guard timing). Internal tweaks allowed only if needed to fix the crop.
  - No tag-editor UX changes on `ImportedCourseCard` beyond visual restyling.
  - No Storybook introduction (none exists today).

### Deferred to Separate Tasks

- **`BookCard` EPUB/other-format restyling**: the EPUB branch already uses the target style; no changes needed.
- **Mobile-specific touch gesture for overlay**: treated as "always visible on touch" via `hover: none` media query — richer touch interactions (long-press menus, swipe) are out of scope.
- **Design-token additions**: if new tokens are needed for the Play overlay background, they are scoped into this plan; broader token work is separate.

## Context & Research

### Relevant Code and Patterns

- **Reference implementation (audiobook style):** `src/app/components/library/BookCard.tsx` (audiobook branch, lines 75–188). Square cover; `-translate-y-2` hover; progress bar overlaid at `absolute bottom-0 left-0 right-0 h-1.5 bg-foreground/10` with inner `bg-brand` strip; status/format badges as `absolute top-{2,3} {left,right}-{2,3}`; metadata below cover is `mt-3 px-1 text-center` with `text-sm font-bold text-foreground leading-tight line-clamp-2 group-hover:text-brand`.
- **Current CourseCard:** `src/app/components/figma/CourseCard.tsx`. Three variants share thumbnail overlays (`renderThumbnailOverlays`), info popover (`renderInfoButton`), and body (`renderBody`). Card wrapper at line 708 is `<Card className="group bg-card border-0 shadow-sm overflow-hidden hover:shadow-xl hover:scale-[1.02] ..." >`.
- **Current ImportedCourseCard:** `src/app/components/figma/ImportedCourseCard.tsx`. Has the "Start Studying" button at lines 545–559 (`course.status === 'not-started' && !readOnly`). Camera overlay for thumbnail replacement at lines 282–293. Status dropdown at lines 327–400.
- **Hover preview hook:** `src/hooks/useCourseCardPreview.ts` wraps `useHoverPreview` (1000ms) and `useReducedMotion`. Returns `previewHandlers`, `showPreview`, `videoReady`, `guardNavigation`, `previewOpen`, `infoOpen`. Public shape must not change.
- **Shared sub-components to keep:** `src/app/components/figma/ProgressRing.tsx`, `MomentumBadge.tsx`, `AtRiskBadge.tsx`, `CompletionEstimate.tsx`, `TagBadgeList.tsx`, `TagEditor.tsx`, `VideoPlayer.tsx`. `src/app/components/library/BookStatusBadge.tsx` and `FormatBadge.tsx` stay BookCard-only.
- **Styling conventions:** Design tokens in `src/styles/theme.css`. Brand color rules in `.claude/rules/styling.md`: use `text-brand-soft-foreground` on `bg-brand-soft`, `variant="brand"` on `<Button>` (not `className="bg-brand"`), theme tokens never hardcoded.
- **Progress bar visual contract (from BookCard):** `h-1.5 bg-foreground/10` container, `bg-brand rounded-full transition-all` inner bar with `style={{ width: \`${progress}%\` }}`. For thicker emphasis on cards that need it, `h-1.5` works; thinner `h-1` is used on EPUB cover.

### Institutional Learnings

- No matching entries in `docs/solutions/`. No prior solution memos exist for card-layout uniformity or hover-preview crop bugs.

### External References

- None needed. The pattern to match is already in-repo (`BookCard`).

## Key Technical Decisions

- **Decision:** Drop the `<Card>` shell on course cards; use a bare `<article>` (keeps semantic role) with the thumbnail as the first visual block. Rationale: matches the frameless aesthetic of `BookCard`; eliminates redundant border/shadow chrome around an already-shadowed thumbnail.
- **Decision:** Keep the three variants of `CourseCard` (`library`, `overview`, `progress`). Rationale: variants are consumed by 9 call-sites with different information needs (Overview shows less; MyClass shows Resume/Review buttons). Collapsing variants is out of scope.
- **Decision:** "Start Studying" becomes a hover-revealed Play overlay (icon-only, large) centered on the thumbnail for `not-started` cards, using `opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity`. On touch devices (`@media (hover: none)`), the overlay is always visible via Tailwind's `hover:none:opacity-100` utility or an explicit CSS rule. Rationale: keeps card heights consistent (removes inline body button), preserves the state transition, improves discoverability on desktop via hover and on touch via persistent visibility.
- **Decision:** Body content becomes left-aligned (not centered like `BookCard`). Rationale: course metadata is information-dense (3–4 lines: title, author+avatar, stats row, progress). Centering denser content looks awkward. Uniformity applies to visual DNA (cover treatment, hover behavior, badge placement), not literal body layout.
- **Decision:** Keep author avatar + clickable author link on `CourseCard` variants. Rationale: authors are a primary browsing axis for courses (Authors page exists). `BookCard` does not have this because audiobooks don't have author pages in the same way.
- **Decision:** Info popover button stays at `absolute bottom-{2,3} right-{2,3}` on the thumbnail, hover-revealed. On `not-started` cards, the Play overlay and Info button coexist — Play is center-cover, Info is corner. Rationale: they serve different purposes (start vs. browse details); co-location on hover is well-patterned in the repo.
- **Decision:** Video preview crop fix — constrain the `<video>` to match the thumbnail's aspect ratio using `object-cover` (already present) plus explicit `width="100%" height="100%"` attributes and ensuring the parent has a fixed `h-44` (library/progress) or `h-32` (overview) instead of allowing the video's intrinsic dimensions to leak through. Likely fix: add `max-w-full max-h-full` and verify the video element's `display: block` rule. Investigate first during implementation; document the actual root cause in the commit.
- **Decision:** Progress bar treatment per variant:
  - `CourseCard.library`: cover-bottom edge bar replaces the under-body `<Progress>` bar.
  - `ImportedCourseCard`: cover-bottom edge bar replaces the under-body `<Progress>` bar.
  - `CourseCard.overview`: cover-bottom edge bar added (no existing body progress bar for in-progress state; the top-right percentage badge remains).
  - `CourseCard.progress` (MyClass): cover-bottom edge bar added AND the existing inline `<Progress value={} showLabel>` body bar is retained. Rationale: the labeled inline bar carries textual percentage that is functionally load-bearing on MyClass; removing it loses information the cover-edge bar cannot convey. Visual consistency applies to the cover-edge treatment; the labeled body bar stays as a functional overlay.

- **Decision:** Completion overlay (`CheckCircle2` full-cover) only on the library + overview `not-started → completed` states, matching `BookCard.status === 'finished'`. `progress` variant already has a completion ring; keep that, add the cover-edge progress bar at 100%.
- **Decision:** Category badge tinting (per-category colors from `categoryColors` in CourseCard.tsx) is preserved on the `library` variant only. Rationale: scannability on the main Courses page; overview/progress variants are context-specific and already carry category info differently.

## Open Questions

### Resolved During Planning

- **Scope of redesign:** All three cards in one pass (CourseCard three variants + ImportedCourseCard) — confirmed by user.
- **"Start Studying" pattern:** Hover-only Play overlay (Option B) — confirmed by user.
- **Hover video preview fate:** Keep + fix crop in this plan — confirmed by user.
- **Preserve vs. drop stats row:** Keep (restyled to match audiobook meta-line typography).
- **Preserve vs. drop author link:** Keep (functional affordance audiobooks don't need).
- **"Imported DATE" line on `ImportedCourseCard`:** Move from body to info popover only; freeing a body line for the stats row.

### Deferred to Implementation

- **Exact Tailwind class choreography for the Play overlay reveal on touch devices:** There are two viable approaches: (a) `hover:none:opacity-100` arbitrary variant if the project has configured `hover: hover` media queries; (b) a `group-[.is-touch]:opacity-100` class toggled via a JS media-query listener. Pick whichever is simpler once touching the code — if the project already has a pattern, follow it.
- **Root cause of the video preview crop bug:** The symptom was described as a "pixelated webcam-like crop." Could be `object-cover` cropping a low-resolution preview, or the `<video>` element taking intrinsic aspect ratio when the source is non-standard. Investigate on-device; the plan commits to fixing the symptom, not to a specific underlying mechanism.
- **Whether to extract a shared `CourseCardShell` primitive** (cover + overlays + body slot) from the 4 card renderings. Defer: easier to refactor after the three variants + ImportedCourseCard share the same structural skeleton. Re-evaluate post-implementation.
- **MyClass `progress` variant button placement** (Resume/Review buttons currently inside body): The redesign keeps these buttons because they're functional; the visual question is whether they sit inside the body or appear on hover. Resolve during implementation by trying body-first; if heights still drift, move to hover.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Shared skeleton (all 4 card renderings):**

```
<article role="link" aria-label={...} className="group ...">
  <div className="relative aspect-[...] rounded-2xl overflow-hidden shadow-card-ambient group-hover:-translate-y-2 group-hover:shadow-[0_10px_30px_var(--shadow-brand)] transition-all duration-300">
    {/* Thumbnail image (picture/srcSet/webp per current impl) */}
    {/* Inline hover video preview (CourseCard + ImportedCourseCard only) */}
    {/* Top-left: category badge (library variant) OR format badge (imported) */}
    {/* Top-right: status badge / completion badge / progress ring */}
    {/* Bottom-left: at-risk badge (library variant, when applicable) */}
    {/* Bottom-right (hover): info popover trigger */}
    {/* Center (hover, not-started only): Play overlay → handleStatusChange('active') + navigate */}
    {/* Bottom edge: <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-foreground/10"><div className="h-full bg-brand ..." style={{width: `${pct}%`}} /></div> */}
    {/* Completion full-cover overlay (status === completed) */}
  </div>
  <div className="mt-3 px-1 [text-alignment varies by variant]">
    {/* Title (line-clamp-2, group-hover:text-brand) */}
    {/* Author row with avatar (CourseCard variants) OR plain author (ImportedCourseCard) */}
    {/* Stats row (muted, icons + counts) */}
    {/* Variant-specific extras: MomentumBadge, AtRiskBadge, CompletionEstimate, tag chips, Resume/Review button (progress variant) */}
  </div>
</article>
```

**Variant body layout deltas:**

| Variant | Body alignment | Stats row shown? | Progress indicator on body? | Variant-only extras |
|---|---|---|---|---|
| `CourseCard.library` | left-aligned | yes (videos, PDFs, hours) | no (cover-edge only) | MomentumBadge, CompletionEstimate |
| `CourseCard.overview` | left-aligned | compact (lessons count + state) | no (cover-edge only when in-progress) | "In Progress" / "Completed" label |
| `CourseCard.progress` | left-aligned | yes | optional body `<Progress>` retained for this variant | Resume/Review button, difficulty badge, last-accessed relative time |
| `ImportedCourseCard` | left-aligned | yes (videos, duration, PDFs, resolution) | no (cover-edge only) | Tag chips + editor, AI tagging indicator, edit/delete menu (via status dropdown) |

**"Start Studying" interaction (Option B):**

```
Hover not-started CourseCard/ImportedCourseCard
  └─ Play icon (size-16) fades in on thumbnail center (opacity 0 → 100, 300ms)
  └─ Click Play icon:
        1. stopPropagation on card click
        2. handleStatusChange('active')   [only ImportedCourseCard uses its internal store; CourseCard doesn't have this CTA today — see per-unit notes]
        3. navigate to course overview
Touch device:
  └─ Play icon always opacity-100 on not-started cards
  └─ Tap still triggers same handler
```

## Implementation Units

- [ ] **Unit 1: Introduce shared design-token utilities for the cover-overlay Play button**

**Goal:** Ensure the Play overlay has a consistent, token-driven background and ring treatment that works on any thumbnail color.

**Requirements:** R1, R6

**Dependencies:** None

**Files:**
- Modify: `src/styles/theme.css` (add `--shadow-brand` if missing; audit `--shadow-card-ambient` usage)
- Modify: `src/styles/tailwind.css` (only if a custom utility is needed; prefer arbitrary values inline)

**Approach:**
- Verify `--shadow-brand` token referenced by BookCard's hover shadow exists in `theme.css`. If not, add it (matches BookCard's inline use).
- No new component files; this unit only confirms/adds tokens so downstream units can reference them without hardcoding.

**Test scenarios:**
- Test expectation: none — this unit is a token audit with no behavioral change. Verification is grep-based.

**Verification:**
- `rg "shadow-brand" src/styles/` returns a defined CSS variable.
- `rg "group-hover:shadow-\[0_10px_30px_var\(--shadow-brand\)\]" src/app/components/library/BookCard.tsx` still resolves (we haven't broken the existing reference).

---

- [ ] **Unit 2: Build shared card skeleton primitives (internal, not exported)**

**Goal:** Extract common JSX patterns (cover container, progress bar overlay, Play CTA overlay) as local helper components/fragments inside a single file — not a public primitive. Reduces duplication across the three `CourseCard` variants and `ImportedCourseCard` without overcommitting to a public API.

**Requirements:** R1, R2, R4

**Dependencies:** Unit 1

**Files:**
- Create: `src/app/components/figma/courseCardShell.tsx` (local, internal helpers — exported from this file, imported only by `CourseCard.tsx` and `ImportedCourseCard.tsx`)

**Approach:**
- Helpers to export: `CardCover` (wraps thumbnail + overlays + progress strip in the frameless cover container with hover lift), `CoverProgressBar` (cover-edge progress overlay), `PlayOverlay` (hover-revealed center Play icon for not-started state), `CompletionOverlay` (full-cover check icon for completed state). Info button and status badge remain per-card because they have card-specific click handlers.
- Keep the file colocated in `figma/` since both consumers already live there.
- Use design tokens throughout: `bg-foreground/10` for progress bar track, `bg-brand` for fill, `text-brand-foreground` on solid brand surfaces, `text-success drop-shadow-md` for check icon.
- Play overlay visual: circular semi-transparent backdrop (`bg-black/50 backdrop-blur-sm`), `Play` lucide icon at `size-16`, `rounded-full p-4`, entering via `opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-300`. On touch: always visible (see Deferred Implementation question for exact strategy).
- Keep all helpers uncontrolled (props-only, no internal state). Click handlers passed in by parent.

**Patterns to follow:**
- `BookCard` audiobook branch (lines 91–136) for cover container + progress strip pattern.
- `ImportedCourseCard` lines 282–293 (camera overlay) for hover-revealed interactive overlay pattern.

**Test scenarios:**
- Happy path: `CardCover` renders child thumbnail and progress strip when `progress > 0`. Test via DOM query after rendering a harness.
- Happy path: `PlayOverlay` is not rendered when `show={false}`; rendered with `opacity-0` class when hidden, `group-hover:opacity-100` applied; calls `onClick` when clicked; stops propagation.
- Happy path: `CompletionOverlay` renders only when `show={true}`; has role/aria-hidden appropriate for decoration.
- Edge case: `CoverProgressBar` with `progress={0}` renders a 0%-width bar (not absent — keeps layout stable).
- Edge case: `CoverProgressBar` with `progress > 100` clamps to 100%.
- Integration: `CardCover` + `PlayOverlay` together — hovering the card surfaces Play; the card's own click handler still fires when clicking outside the Play button.

**Files (tests):**
- Create: `src/app/components/figma/__tests__/courseCardShell.test.tsx`

**Verification:**
- New helpers render in isolation and via their consumers without visual regression (manual review at `/courses` and `/my-courses` after Unit 3 + Unit 4).
- No ESLint `design-tokens/no-hardcoded-colors` violations.

---

- [ ] **Unit 3: Redesign `CourseCard` (all three variants) using shared skeleton**

**Goal:** Rebuild `CourseCard` against the new frameless skeleton while preserving all three variants' information density and variant-specific extras.

**Requirements:** R1, R3, R4, R6, R7, R8

**Dependencies:** Unit 2

**Files:**
- Modify: `src/app/components/figma/CourseCard.tsx`
- No test file exists for `CourseCard` directly today; E2E specs cover its usage (see Unit 6).

**Approach:**
- Replace the `<Card>` shell (line 708) with a bare `<article role="link">` wrapping `<CardCover>` + body `<div>`.
- Map the existing `renderThumbnailOverlays()` outputs to the new overlay slots: category badge → `CardCover` top-left, completion badge / ProgressRing / percentage → top-right, at-risk badge → bottom-left.
- Progress bar placement per variant (aligns to Key Technical Decisions):
  - `library`: move inline `<Progress>` out of body → `<CoverProgressBar>` on cover edge.
  - `overview`: add `<CoverProgressBar>` on cover edge; no body progress bar existed before (top-right percentage badge remains).
  - `progress` (MyClass): add `<CoverProgressBar>` on cover edge AND retain the inline `<Progress value={} showLabel>` body bar. The labeled inline bar is functional (shows percentage text); cover-edge bar is visual consistency.
- Retain author avatar + clickable link (stopPropagation to avoid card-navigate). Use existing `getAvatarSrc` helper.
- Retain info popover with existing `infoPopoverContent` content. Position bottom-right on cover.
- `CourseCard` does **not** currently have a "Start Studying" CTA (only `ImportedCourseCard` does). Confirmed by reading the component — leave CourseCard without the Play overlay for now. The overlay only lives on `ImportedCourseCard` where `handleStatusChange('active')` is wired.
- Preserve all existing test-ids (`course-card-{id}`, `completion-badge`, `completion-ring`). Keep `data-preview` attribute on the article for E2E assertions.
- Keep the `useCourseCardPreview` hook integration and `previewDialog` unchanged — only the placement of overlay/info-button wrappers changes.
- Hover lift: remove `hover:scale-[1.02]` from the outer wrapper; apply `group-hover:-translate-y-2 group-hover:shadow-[0_10px_30px_var(--shadow-brand)]` on the `CardCover` inner container (same as BookCard).

**Patterns to follow:**
- `BookCard` audiobook branch for cover treatment.
- Current CourseCard `renderBody()` per-variant switch — preserve the body content, change only the container.

**Test scenarios:**
- Happy path (library variant): renders category badge top-left on cover, progress ring/completion badge top-right, progress bar on cover bottom edge when `completionPercent > 0`.
- Happy path (overview variant): compact body layout; in-progress shows percentage badge top-right; completed shows completion badge top-right.
- Happy path (progress variant): Resume Learning / Review Course buttons still render in body; difficulty badge still visible; `lastAccessedAt` relative time still shows.
- Happy path: clicking the card navigates to the lesson link; clicking the author link navigates to the author profile (stopPropagation works).
- Edge case: card with no author renders without crashing, body layout remains stable.
- Edge case: card with `completionPercent === 100` shows the completion badge, hides the ring, and the cover-edge progress bar fills 100%.
- Error path: thumbnail image fails to load — gradient fallback renders, no layout collapse.
- Integration: hovering a card triggers video preview after delay (existing `useCourseCardPreview` test behavior); hovering then leaving cancels preview.
- Accessibility: focus-visible ring appears on keyboard tab; Enter/Space navigate; status/info button `aria-label` preserved; touch target ≥44px on status button.

**Verification:**
- All 9 consumer pages (Courses, Overview, MyClass, Authors, AuthorProfile, RecommendedNext, plus 2 prototypes) render without layout breakage at 375px, 768px, 1440px.
- ESLint `design-tokens/no-hardcoded-colors` passes.
- Existing E2E tests using `course-card-*` selectors still pass.

---

- [ ] **Unit 4: Redesign `ImportedCourseCard` using shared skeleton + add Play overlay**

**Goal:** Apply the new frameless skeleton to `ImportedCourseCard`, remove the inline "Start Studying" body button, and wire the Play overlay to the same `handleStatusChange('active')` + navigate behavior.

**Requirements:** R1, R2, R3, R4, R6, R7, R8

**Dependencies:** Unit 2

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`
- Modify: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx` (retarget the "start-course-btn" selector to the new Play overlay while preserving the same test-id)

**Approach:**
- Replace `<article ...><Card>...</Card></article>` (lines 248–617) with `<article ...>[CardCover + overlays][body]</article>`.
- Drop the inline "Start Studying" `<Button>` (lines 545–559) from the body.
- Add `<PlayOverlay show={course.status === 'not-started' && !readOnly} onClick={handleStartStudying} data-testid="start-course-btn" />` inside `<CardCover>`. `handleStartStudying` composes `stopPropagation → handleStatusChange('active') → navigate(\`/courses/${course.id}/overview\`)`.
- Preserve test-id `start-course-btn` on the overlay button so existing tests still locate it (assert the new click behavior: both status change AND navigation).
- Move "Imported 4/19/2026" line from body (line 516–518) into the info popover's metadata block where it already exists (line 420–422). Frees a body row for the stats row to feel less crammed.
- Keep camera overlay (thumbnail replacement) as a hover-revealed full-cover button — ensure it does not visually conflict with the Play overlay. Camera overlay is only shown when `!readOnly` AND thumbnail is present AND hovered. Play overlay shown when `!readOnly` AND status is `not-started`. Both can coexist visually if Play is centered and Camera is a corner icon on the cover; simpler: show Camera on hover only when status ≠ `not-started`, show Play on hover when status === `not-started`. Mutually exclusive by state.
- Keep status dropdown (top-right), info popover (bottom-right), all tag editor UI in body.
- Move cover-edge progress bar into `<CoverProgressBar>` for consistency.
- Hover lift: swap `hover:shadow-2xl hover:[transform:scale(1.02)]` at line 258 for `group-hover:-translate-y-2 group-hover:shadow-[0_10px_30px_var(--shadow-brand)]` on the CardCover (same as CourseCard).
- Preserve `data-preview={showPreview && videoReady ? '' : undefined}` on the article.

**Patterns to follow:**
- Unit 2's `PlayOverlay` helper.
- `BookCard` audiobook branch for lift and shadow.
- Existing camera overlay pattern (lines 282–293) for hover-reveal semantics on touch.

**Test scenarios:**
- Happy path: `not-started` course renders Play overlay with `data-testid="start-course-btn"`; overlay is in the accessibility tree with `aria-label="Start studying \"${course.name}\""`.
- Happy path: clicking the Play overlay calls `updateCourseStatus(courseId, 'active')` AND navigates to `/courses/${courseId}/overview`. Assert both via mocked store and `useNavigate`.
- Happy path: `active`/`paused`/`completed` courses do NOT render the Play overlay (`queryByTestId('start-course-btn')` returns null).
- Happy path: `readOnly` prop hides the Play overlay AND the camera overlay AND the edit/delete menu items — but status transitions (via status badge dropdown) remain available.
- Happy path: "Imported DATE" text no longer appears in the body; it appears inside the info popover content when opened.
- Happy path: tag chips, tag editor, AI tagging indicator render in body unchanged.
- Happy path: cover-edge progress bar width matches `completionPercent`; not rendered at 0 completion (or rendered at 0% — match CourseCard behavior decision from Unit 2).
- Edge case: status === `completed` renders cover completion overlay AND hides the Play overlay (they are mutually exclusive).
- Edge case: keyboard focus on the Play overlay shows focus-visible ring; Enter activates the same click handler.
- Error path: `handleStatusChange` throws — toast error appears (existing delete-flow pattern), status doesn't change, navigation does not happen.
- Integration: hovering a not-started card triggers video preview (after 1000ms) AND Play overlay fades in together; both coexist visually without the preview covering the Play click target.
- Accessibility: Play overlay has a minimum 44×44px hit target; `aria-label` present; keyboard-activatable; respects `prefers-reduced-motion` (overlay still appears; only the fade transition shortens).

**Execution note:** Start by updating the existing `ImportedCourseCard.test.tsx` suite's "Start Studying" assertions (button → overlay semantics) before touching the component. This surfaces contract drift early.

**Verification:**
- `npm run test:unit src/app/components/figma/__tests__/ImportedCourseCard.test.tsx` passes.
- Existing E2E tests referencing `start-course-btn` still pass (selector preserved).
- Manual check at `/my-courses`: not-started cards reveal Play on hover; clicking transitions the status and navigates; status badge shows "Active" on the destination page.

---

- [ ] **Unit 5: Fix hover video preview crop/pixelation bug**

**Goal:** Resolve the reported "pixelated webcam-like crop" on the inline hover video preview so previews render at the correct aspect ratio on all imported courses.

**Requirements:** R5, R8

**Dependencies:** Units 3 + 4 (new skeleton must be in place so the fix applies to the final structure)

**Files:**
- Modify: `src/app/components/figma/CourseCard.tsx` (video element at lines 158–174 of current impl) and/or `src/app/components/figma/ImportedCourseCard.tsx` (video element at lines 294–311 of current impl) — whichever is affected.
- Possibly modify: `src/hooks/useCourseCardPreview.ts` (only if root cause requires it; prefer keeping hook contract stable)

**Approach:**
- Investigate the crop on a reproducer: import a course with a low-resolution first video; hover the card; observe. Likely causes ranked by probability:
  1. `<video>` without explicit `width`/`height` attributes taking intrinsic video dimensions inside a fixed-aspect cover container with `object-cover`, causing upscale + crop.
  2. `object-cover` combined with non-16:9 source video (e.g., 4:3 or 9:16 portrait), cropping edges aggressively.
  3. Video blob URL loading mid-sized thumbnail then upscaling during playback.
- Apply minimal fix: explicit `width="100%" height="100%"` on the `<video>` element, verify `display: block`, ensure the parent has `overflow-hidden` + known aspect. If cause #2, switch `object-cover` → `object-contain` with a dark letterbox background OR add a blurred filled backdrop.
- Do NOT change `useCourseCardPreview` hook's returned shape. Only tweak internals if root cause lives there (unlikely).
- Document the actual root cause in the commit message.

**Patterns to follow:**
- Existing thumbnail image treatment (uses `object-cover` with `w-full h-full object-cover`).

**Test scenarios:**
- Happy path: hover preview on a 16:9 course — video fills the cover frame edge-to-edge, no pixelation beyond source resolution.
- Edge case: hover preview on a 4:3 course — video fits with `object-contain` letterbox OR crops cleanly per chosen fix; no jagged edges.
- Edge case: hover preview on a portrait/9:16 course — renders without violent cropping of the main subject.
- Edge case: source video fails to load — existing error handling kicks in (previewError, etc.), no broken rendering.
- Regression: existing `useCourseCardPreview.test.ts` tests still pass.

**Verification:**
- Visual check at `/my-courses` with at least 3 imported courses of varied aspect ratios.
- Preview still activates at 1000ms delay; dismissal guard (200ms) still works; reduced-motion preference still disables the preview.
- `npm run test:unit src/hooks/__tests__/useCourseCardPreview.test.ts` passes.

---

- [ ] **Unit 6: Update test-id assertions and E2E specs that reference removed elements**

**Goal:** Audit all tests and E2E specs for selectors that target elements we removed (inline "Start Studying" button position, "Imported DATE" body line, `<Card>` wrapper classes) and update them to the new structure without loosening assertions.

**Requirements:** R7

**Dependencies:** Units 3 + 4

**Files:**
- Modify: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx` (primary)
- Audit: `tests/e2e/**/*.spec.ts` for `course-card-`, `imported-course-card`, `start-course-btn`, `course-card-title`, `course-card-author` references
- Modify: any E2E specs found to reference removed visual structure

**Approach:**
- Grep-audit: `rg -l "course-card-|imported-course-card|start-course-btn|completion-badge|completion-ring|ProgressRing" tests/` and `src/`.
- For each match: verify the selector still resolves in the new DOM. If a test asserts on body-level CSS classes or parent-child relationships that changed (e.g., "Start Studying is inside the body"), update the assertion to the new relationship ("Start Studying is inside the cover container").
- Do not remove assertions — migrate them. If an assertion becomes meaningless, flag it for the user before deleting.
- Add an E2E smoke assertion in the courses spec that the grid has consistent card heights (`expect(heights).toEqual(heights.fill(heights[0]))` within a tolerance) to lock R4 in.

**Patterns to follow:**
- Existing test patterns in `.claude/rules/testing/test-patterns.md` (deterministic time, seeding helpers).

**Test scenarios:**
- Test expectation: none — this unit is test maintenance. Success = existing test suite passes with the new component structure.

**Verification:**
- `npm run test:unit` — all unit tests green.
- `npm run lint` — no ESLint violations.
- `npx playwright test tests/e2e/courses.spec.ts tests/e2e/my-courses.spec.ts` (or equivalent) — specs targeting these pages pass.

---

- [ ] **Unit 7: Manual design validation at three breakpoints**

**Goal:** Verify the redesigned cards visually match `BookCard`'s DNA at mobile, tablet, desktop; card heights are consistent; no regressions.

**Requirements:** R1, R4, R8

**Dependencies:** Units 3, 4, 5, 6

**Files:**
- No code changes. May capture screenshots to `docs/reviews/design/<date>-course-card-unified-*.png` for the review record.

**Approach:**
- Load `/courses`, `/my-courses`, `/overview`, `/my-class`, `/authors/:id` at 375px, 768px, 1440px.
- Verify: cards have consistent heights in each grid; hover lift is consistent; progress bar renders on cover bottom; status/category badges render in expected corners; Play overlay appears only on not-started imported courses; hover video preview fills correctly (Unit 5 fix).
- Verify: keyboard Tab order is logical; focus-visible rings appear; status dropdown opens from keyboard; info popover opens from keyboard.
- Run `/design-review` slash command for a formal design review pass.
- Run axe-core or Lighthouse accessibility quick check.

**Test scenarios:**
- Test expectation: none — this unit is manual verification. Outputs are screenshots + a short design review summary.

**Verification:**
- `/design-review` agent reports no BLOCKER or HIGH severity findings related to this change.
- Card height variance within a single row is ≤2px (allowing for minor font-rendering differences).

## System-Wide Impact

- **Interaction graph:** Removing the body-level "Start Studying" button changes the ImportedCourseCard's JSX structure; tests asserting on child-order within the body will need to be updated. The `useCourseCardPreview` hook's public API stays stable — no downstream component changes. `Layout.tsx` and routing unaffected.
- **Error propagation:** `handleStatusChange` inside `handleStartStudying` still routes errors through the existing `useCourseImportStore.importError → toast.error` path. No new error boundaries needed.
- **State lifecycle risks:** Status transition (`not-started → active`) remains idempotent via the existing `if (newStatus !== status)` guard at line 208. No duplicate-transition risk introduced.
- **API surface parity:** `CourseCard` props (`variant`, `completionPercent`, etc.) unchanged. `ImportedCourseCard` props (`course`, `allTags`, `readOnly`) unchanged. `useCourseCardPreview` return shape unchanged.
- **Integration coverage:** Hover → video preview → dismissal-guard behavior must continue working across 9 CourseCard consumer pages. MyClass Resume/Review buttons (inside `progress` variant body) must continue navigating. Authors page's CourseCard grids must continue rendering.
- **Unchanged invariants:**
  - Course status model (`not-started | active | paused | completed`) unchanged.
  - `BookCard` component untouched.
  - Routing (`/courses/:id/overview`, `/courses/:id/lessons/:lid`) unchanged.
  - Design token set in `theme.css` — only additions (if any), no removals.
  - All existing test-ids preserved.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Removing the `<Card>` wrapper cascades unexpected layout regressions on one of the 9 consumer pages (different grid CSS assumptions). | Unit 7 explicitly checks all consumer pages at 3 breakpoints. Revert strategy: re-wrap in a transparent `<Card className="bg-transparent border-0 shadow-none">` shim if a page breaks; investigate and fix properly post-merge. |
| Touch-device Play overlay behavior varies across browsers (iOS Safari `hover: hover` semantics differ from Chrome Android). | Deferred-to-implementation question acknowledges this. Start with `@media (hover: none)` CSS rule making overlay always visible; refine if touch testing shows issues. |
| Video preview crop fix has multiple possible root causes; fix may not land cleanly in the first attempt. | Unit 5 explicitly plans to investigate before fixing; acceptable to split into a follow-up PR if the root cause is unexpectedly deep (but keep in same plan scope). |
| Test-id-based E2E specs may still subtly break if DOM structure changes affect `getByRole` or ancestor queries. | Unit 6 audits all tests proactively; height-consistency assertion added to E2E. |
| MyClass `progress` variant is visually the most different from `BookCard` (has Resume/Review CTA buttons). Forcing it into the frameless shell may look awkward. | Key Technical Decisions explicitly allow body-level CTAs to remain on the progress variant. Plan tolerates body-level buttons where functional requirements demand them; uniformity is cover-treatment DNA, not body-layout identity. |
| Broken hover preview is a pre-existing bug; scope creep could balloon Unit 5. | Unit 5 is explicitly time-bounded: if root cause is unclear after one investigation pass, the symptom fix (`object-contain` letterbox) lands and the root cause ticket is filed as a follow-up. |

## Documentation / Operational Notes

- `.claude/rules/styling.md` already documents the design-token system and brand color rules; no doc updates needed unless new tokens are added in Unit 1.
- `docs/engineering-patterns.md` may benefit from a "Frameless grid card pattern" entry after this lands. Record in docs/solutions/ as an institutional learning once merged and stable.
- No rollout / feature-flag concerns (cosmetic change; shippable behind no flag).
- No monitoring or metrics impact.

## Sources & References

- **Reference component:** `src/app/components/library/BookCard.tsx` (audiobook branch, lines 75–188)
- **Primary targets:** `src/app/components/figma/CourseCard.tsx`, `src/app/components/figma/ImportedCourseCard.tsx`
- **Preview hook:** `src/hooks/useCourseCardPreview.ts`
- **Existing tests:** `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx`, `src/hooks/__tests__/useCourseCardPreview.test.ts`
- **Styling rules:** `.claude/rules/styling.md`, `.claude/rules/automation.md`
- **Design principles:** `.claude/workflows/design-review/design-principles.md`
- **Chat context (this planning session):** establishes Option B decision, hover-only Play overlay, preserve functional density, fix crop bug.
