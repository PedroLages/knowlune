# Design Review: LessonList Sidebar UX Improvements

**Review Date**: 2026-04-05
**Reviewed By**: Claude Code (design-review agent via Playwright + IndexedDB seeding)
**Branch**: `fix/materials-tab-pdf-preview`
**Changed File**: `src/app/components/course/LessonList.tsx`
**Commit**: `518bdd91` — "fix: LessonList sidebar UX — humanize filenames, compact rows, type colors"

---

## Critical Context: Routing Discrepancy

**This is the most important finding from the review.**

`LessonList.tsx` is only imported by `UnifiedCourseDetail.tsx`, which is NOT currently in the active route tree:

```
// routes.tsx line 249:
// Course detail — rich overview with cinematic hero (replaces flat UnifiedCourseDetail)
path: 'courses/:courseId' → CourseOverview (NOT UnifiedCourseDetail)
```

The **actively rendered lesson sidebar** is `LessonsTab.tsx` (`src/app/components/course/tabs/LessonsTab.tsx`), used in `/courses/:courseId/lessons/:lessonId` via `UnifiedLessonPlayer` and `PlayerSidePanel`.

**Implication**: The UX improvements in `LessonList.tsx` are currently unreachable by users. The live `LessonsTab` still shows:
- Raw filenames with numeric prefixes (e.g., `01-Introduction_to_Persuasion.mp4`)
- No color-coded content type indicators
- No folder count breakdown
- No filename humanization

This is either intentional (preparatory work before re-introducing the route) or an oversight where the improvements should have been applied to `LessonsTab.tsx` instead.

---

## Executive Summary

The `LessonList.tsx` changes represent a meaningful UX improvement for the course content sidebar: humanized filenames reduce cognitive load, compact rows improve information density, and color-coded type indicators help learners distinguish videos from PDFs without relying on text labels alone. The implementation is well-structured, uses design tokens correctly, and shows strong attention to accessibility patterns.

However, because the component is not currently routed, none of these improvements are visible to users. Additionally, the live `LessonsTab` still displays the old pattern. The report reviews both the component code quality and the live `LessonsTab` behavior where they diverge.

---

## What Works Well

**Code quality of `LessonList.tsx`:**

1. **Design token compliance** — `bg-resource-video-bg`, `text-resource-video`, `bg-resource-pdf-bg`, `text-resource-pdf` are all correct semantic tokens defined in `theme.css` with both light and dark mode values. No hardcoded hex colors found.

2. **Dark mode token architecture** — Resource type tokens have proper OKLCH-defined dark values (`--resource-video: oklch(0.707 0.165 254.624)` in dark mode), ensuring automatic contrast adaptation without any `dark:` class overrides needed.

3. **Accessible list semantics** — `<ul aria-label="Course content">` on the list root, `<li>` for each item, `<Link>` for navigable items and `<div aria-disabled="true">` for unavailable ones. Correct semantic structure throughout.

4. **Tooltip pattern** — Using `<TooltipProvider delayDuration={300}>` wrapping the whole component, with `<TooltipTrigger asChild>` on the truncated span, is the correct shadcn/ui pattern. The `side="right"` placement makes sense for a sidebar context.

5. **`humanizeFilename()` correctness** — Strips extensions, leading numeric prefixes (`01-`, `01.`, `01_`), converts underscores to spaces, and collapses whitespace. The regex `/^\d+[-_.]\s*/` correctly handles the common naming patterns.

6. **Progress indicator design** — The `h-1 mt-1.5` progress bar is slim and unobtrusive; combined with the percentage badge, it gives two layers of feedback without visual clutter.

7. **Collapsible folders** — Using Radix `<Collapsible defaultOpen>` with `group-data-[state=open]/folder:rotate-180` on the chevron provides accessible state transitions that also respect `prefers-reduced-motion` via Radix's built-in support.

---

## Findings by Severity

### Blockers (Must fix before merge)

**B1 — Component is unreachable: `UnifiedCourseDetail` is not routed**
- **Location**: `src/app/routes.tsx:249-258`
- **Evidence**: `/courses/:courseId` renders `CourseOverview`, not `UnifiedCourseDetail`. Direct navigation to `CourseOverview` confirms `[data-testid="course-content-list"]` does not exist on the page.
- **Impact**: All five improvements (humanized filenames, compact rows, type colors, folder counts, tooltips) are invisible to users.
- **Suggestion**: Either (a) re-introduce the `UnifiedCourseDetail` route for a secondary URL (e.g., `/courses/:courseId/content`), or (b) port the same improvements to `LessonsTab.tsx` which IS live. Option (b) is the faster path since `LessonsTab` serves the same purpose.

---

### High Priority (Should fix before merge)

**H1 — Live `LessonsTab` shows raw filenames — user-facing regression gap**
- **Location**: `src/app/components/course/tabs/LessonsTab.tsx:198`, `src/lib/courseAdapter.ts:96`
- **Evidence**: Screenshot `sidebar-closeup.png` clearly shows `01-Introduction_to_Persuasion.mp4`, `01-Russian_Brainwashing_Manual.pdf`, `02-Cognitive_Biases_Overview.mp4` with full extensions and numeric prefixes.
- **Impact**: Users navigating the lesson player see machine-formatted filenames rather than readable lesson titles. The commit description says "humanize filenames" but this is only in the un-routed component.
- **Suggestion**: Extract `humanizeFilename()` to a shared utility (e.g., `src/lib/stringUtils.ts`) and apply it in `LessonsTab` where `lesson.title` is rendered (line 198). Alternatively, apply humanization upstream in `courseAdapter.ts` when setting `title: v.filename`.

**H2 — Axe: `color-contrast` violation on brand-soft active item in player sidebar**
- **Location**: `.bg-brand-soft.text-brand-soft-foreground[aria-current="page"] > .min-w-0.flex-1 > .mt-0\.5 .text-xs.text-muted-foreground`
- **Evidence**: axe-core WCAG 2.1 AA scan result: `impact: "serious"`, `id: "color-contrast"`, 1 node.
- **Impact**: When a lesson item is active (highlighted with `bg-brand-soft`), the secondary metadata text (`text-muted-foreground` — duration/type) fails contrast against the brand-soft background. Screen reader users relying on visual contrast cues to understand their reading position are disadvantaged.
- **Suggestion**: In `LessonsTab.tsx` line 207, when `isActive` is true, override the duration text color from `text-muted-foreground` to a color that meets 4.5:1 on `bg-brand-soft`. Either use `text-brand-soft-foreground` or a dedicated token.

**H3 — Axe: 7 `button-name` violations on video player controls (critical)**
- **Location**: `.styles-module__controlButton___8Q0jc` (third-party video player controls)
- **Evidence**: axe-core result: `impact: "critical"`, `id: "button-name"`, 7 nodes, targets include player control buttons.
- **Impact**: Screen reader users cannot identify what the player controls do. While these may be in a third-party component, unlabeled buttons are a blocker under WCAG 2.1 SC 4.1.2.
- **Suggestion**: Investigate whether the video player library (likely plyr or a similar player) allows injecting `aria-label` attributes on control buttons. Add aria-labels if the library supports customization, or wrap controls with accessible overlays. If this is a known third-party limitation, document it in `docs/known-issues.yaml`.

**H4 — Axe: 3 `label` violations on unlabeled form inputs in player settings**
- **Location**: `.styles-module__toggleSwitch___l4Ygm > input[type="checkbox"]` (within player settings panel)
- **Evidence**: axe-core result: `impact: "critical"`, `id: "label"`, 3 nodes.
- **Impact**: Checkbox inputs inside the player settings have no programmatic label, making them unusable with screen readers.
- **Suggestion**: Add `<label>` elements or `aria-label` attributes to the toggle switch inputs in the video player settings panel.

---

### Medium Priority (Fix when possible)

**M1 — `TooltipTrigger asChild` on a `<span>` may fail keyboard trigger**
- **Location**: `LessonList.tsx:406-421` (video items), `LessonList.tsx:487-500` (PDF items)
- **Evidence**: The `<span>` with `truncate block` inside `TooltipTrigger asChild` is not focusable by keyboard. Radix Tooltip triggers require the child to be focusable or receive pointer events. Users tabbing through the list will reach the parent `<Link>` (which is focusable) but cannot independently focus/trigger the tooltip.
- **Impact**: Learners using keyboard navigation will miss the full filename tooltip for truncated titles, which is the primary reason the tooltip exists.
- **Suggestion**: The tooltip on the `<Link>` element itself would be more appropriate, since that IS keyboard-focusable. Move `TooltipTrigger asChild` to wrap the `<Link>`. Alternatively, use `TooltipContent` with `hidden` for screen readers since the full text is already available to assistive technologies via the link's text content.

**M2 — Collapsible folder trigger lacks `aria-label` specifying folder name**
- **Location**: `LessonList.tsx:550`
- **Evidence**: `<CollapsibleTrigger>` renders a button with text content "01-Foundations", count "3 videos · 1 PDF", and a chevron. The raw folder name (e.g., `01-Foundations`) is shown as-is, not humanized — inconsistent with the humanization applied to individual lesson items.
- **Impact**: Folder names retain machine-formatting while their children have human-readable names, creating inconsistency. A learner reading the sidebar will see "01-Foundations" containing "Introduction to Persuasion" — the prefix convention leaks through.
- **Suggestion**: Apply `humanizeFilename()` (or a variant that only strips numeric prefix without removing the extension, since folders have no extension) to `group.title` in the folder trigger rendering.

**M3 — PDF item uses `FileText` icon twice — in the type circle and in the metadata row**
- **Location**: `LessonList.tsx:481` (type circle), `LessonList.tsx:503` (metadata row)
- **Evidence**: Code review shows `<FileText>` used in both the colored indicator circle and then again in the small metadata row below. The video equivalent uses `<Video>` in the metadata row but an index number (not Video icon) in the circle — creating visual asymmetry between PDF and video items.
- **Impact**: Minor inconsistency but creates cognitive dissonance: why does the PDF circle show a file icon (purely decorative since the background color already indicates "PDF") while the video circle shows a sequential index number (functional — tells you position)?
- **Suggestion**: Consider using a sequence number for PDFs in the circle as well, switching to the `FileText` icon only when PDFs are completed (similar to videos using `CheckCircle2` when completed). Or make the PDF circle consistently use a small `FileText` icon — just standardize the pattern.

**M4 — `CheckCircle2` aria-label is on the icon, not the parent `<span>`**
- **Location**: `LessonList.tsx:396`
- **Evidence**: `<CheckCircle2 aria-label="Completed" data-testid={...} />` — the ARIA label is on an icon SVG element, which is `aria-hidden` in most contexts due to SVG accessibility treatment. The parent `<span>` has no `aria-label`.
- **Impact**: Screen readers may not announce the completion status for completed lessons.
- **Suggestion**: Move `aria-label="Completed"` to the parent `<span className="size-7 ...">` element instead. Also add `aria-hidden="true"` to the `<CheckCircle2>` itself to prevent double-announcement if the parent speaks.

**M5 — Axe: `nested-interactive` violation in player note editor**
- **Location**: `.styles-module__toolbarContainer___dIhma`
- **Evidence**: axe-core result: `impact: "serious"`, `id: "nested-interactive"`, 1 node. Likely from the note editor toolbar.
- **Impact**: Nested interactive controls cause focus and announcement problems for screen reader users.
- **Suggestion**: Investigate the note editor toolbar structure. Ensure toolbar items use `role="toolbar"` with arrow key navigation rather than nesting buttons inside buttons.

---

### Nitpicks (Optional)

**N1 — Empty `linkAriaLabel` on lesson links**
- **Location**: `LessonList.tsx:462-468` (`<Link>` for available items)
- The `<Link>` has no `aria-label`. Its accessible name comes from its text content (the humanized filename). This is acceptable since the visible text IS the label. However, adding `aria-label={humanized}` (without truncation) would allow screen readers to announce the full title even if it's visually truncated. Low priority since the tooltip serves the same purpose for sighted users.

**N2 — `SEARCH_THRESHOLD = 10` is not surfaced in tests**
- **Location**: `LessonList.tsx:159`
- The search input only shows with 10+ items. The test course had 8 videos + 4 PDFs (12 items total) which does trigger it. The constant is not exported, making it hard to test boundary behavior. Consider exporting as `export const SEARCH_THRESHOLD`.

**N3 — `data-testid` naming inconsistency between LessonList and LessonsTab**
- `LessonList` uses `course-content-item-video-{id}` and `course-content-item-pdf-{id}`
- `LessonsTab` uses `lessons-tab-list` for the container
- When the two components eventually reconcile, test selectors will need updates.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Partial Fail | Active item secondary text fails on `bg-brand-soft` (H2) |
| Text contrast ≥4.5:1 (dark mode) | Pass | Resource tokens correctly defined for dark mode |
| Keyboard navigation | Pass | `<Link>` elements are keyboard-focusable; collapsible triggers are buttons |
| Focus indicators visible | Pass | Default ring indicators visible via Tailwind `focus-visible` classes |
| Heading hierarchy | Pass | No heading level jumps observed |
| ARIA labels on icon buttons | Partial | `CheckCircle2` aria-label placement is on SVG, not parent `<span>` (M4) |
| Semantic HTML | Pass | `<ul>/<li>/<Link>/<button>` used correctly |
| Form labels | N/A for LessonList | Fail in player settings (H4 - third-party) |
| `prefers-reduced-motion` | Pass | Radix Collapsible respects system preference |
| `aria-describedby` on search input | Pass | `aria-label="Filter course content by filename"` on the Input |
| `aria-live` on search results | Gap | Search result count not announced to screen readers |
| Tooltip keyboard-triggerable | Fail | Tooltip trigger is on non-focusable `<span>` (M1) |
| ARIA expanded on collapsibles | Pass | Radix Collapsible provides `aria-expanded` automatically |
| Color sole indicator | Pass | Video/PDF distinction uses icon + color + text labels |

---

## Responsive Design Verification

Live testing at each breakpoint via IndexedDB-seeded `CourseOverview` and `UnifiedLessonPlayer`:

- **Desktop (1440px)**: Pass — lesson player sidebar renders at 384px width, lesson rows 58px height. No horizontal scroll. Background `rgb(250, 245, 238)` correct. Evidence: `player-desktop-clean.png`, `sidebar-closeup.png`
- **Tablet (768px)**: Pass — No horizontal scroll. Touch targets 58px height (exceeds 44px minimum). Sidebar collapses correctly with `knowlune-sidebar-v1: false`. Evidence: `tablet-768-overview.png`
- **Sidebar Collapse (1024px)**: Pass — Tested. No overflow. Evidence: `tablet-1024-01-overview.png`
- **Mobile (375px)**: Pass — No horizontal scroll. Bottom navigation visible. Touch targets 58px on mobile view. Evidence: `player-mobile-375.png`, `mobile-375-overview.png`

Note: All responsive results are from `LessonsTab` (the live component) since `LessonList` is not routed. The `LessonList` compact row design (`px-3 py-2.5`) has not been tested at real viewport widths.

---

## Dark Mode Verification

- **Light mode body background**: `rgb(250, 245, 238)` — correct `#FAF5EE`. Pass.
- **Dark mode body background**: `rgb(26, 27, 38)` — correct dark background token. Pass.
- **Dark mode sidebar background**: `rgb(36, 37, 54)` — correct elevated dark surface. Pass.
- **Active item dark mode**: `bg: rgb(42, 44, 72)`, `color: rgb(160, 168, 235)` — `bg-brand-soft` + `text-brand-soft-foreground` dark values. Correct tokens. Pass.
- **Resource type tokens** (`resource-video`, `resource-pdf`): Defined correctly in `theme.css` with dark mode alternates (`oklch(0.707 0.165 254.624)` for video, `oklch(0.707 0.165 22.18)` for PDF). These are used in `LessonList` but NOT in the live `LessonsTab`.
- Evidence: `player-dark-mode.png`, `dark-mode-overview.png`

---

## Axe-Core Automated Scan Summary

**Scanned**: `/courses/:courseId` (CourseOverview) and `/courses/:courseId/lessons/:lessonId` (UnifiedLessonPlayer)

| Result | Count |
|--------|-------|
| Violations | 4 (2 critical, 2 serious) |
| Passes | 32 |
| Incomplete (manual review needed) | 3 |

All 4 violations are on the `UnifiedLessonPlayer` page, not the CourseOverview. The CourseOverview scan returned 0 violations, 20 passes.

---

## Recommendations

1. **Immediate (pre-merge)**: Clarify intent — is `LessonList` being prepared for a future route re-introduction, or should its improvements be ported to `LessonsTab`? Add a comment in `LessonList.tsx` or a tracking note explaining when it will be routed. Without this, the component risks being forgotten.

2. **High priority**: Apply `humanizeFilename()` to `LessonsTab` now. The function is clean and self-contained. Extract it to `src/lib/stringUtils.ts` and import in both `LessonList.tsx` and `LessonsTab.tsx`. This immediately improves the live user experience.

3. **Medium priority**: Fix the `color-contrast` violation on active sidebar items (H2). The `text-muted-foreground` token on `bg-brand-soft` is a recurring pattern — any component using this combination should override the metadata text color when in active state.

4. **Ongoing**: Investigate the video player control accessibility (H3). The 7 unnamed buttons are a critical WCAG 2.1 violation that affects every lesson view. If the player library doesn't support aria-label injection, evaluate an accessible player alternative.

---

## Screenshots

Evidence files at `/tmp/lessonlist-screenshots/`:
- `sidebar-closeup.png` — Close-up of LessonsTab in player sidebar (live, raw filenames visible)
- `player-desktop-clean.png` — Full player view at 1440px
- `player-dark-mode.png` — Dark mode player
- `player-mobile-375.png` — Mobile player (375px)
- `dark-mode-overview.png` — Course overview in dark mode
- `tablet-768-overview.png` — Tablet layout
- `mobile-375-overview.png` — Mobile layout

