# Design Review — E03-S00: Data Layer Migration (Notes & Bookmarks)

**Review Date**: 2026-02-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e03-s00-data-layer-migration`
**Changed Files (UI-relevant)**:
- `src/app/components/figma/CourseCard.tsx` — major refactor
- `src/app/components/figma/EnhancedCourseCard.tsx` — new component
- `src/app/components/figma/ImportedCourseCard.tsx` — significant changes
- `src/app/components/ProgressCourseCard.tsx` — new component
- `src/app/pages/Overview.tsx` — updated
- `src/app/pages/MyClass.tsx` — updated
- `src/app/pages/LessonPlayer.tsx` — updated
- `src/app/pages/Reports.tsx` — updated

**Affected Pages Tested**: Overview (`/`), My Class (`/my-class`), Lesson Player (`/courses/operative-six/op6-pillars-of-influence`)
**Viewports Tested**: 375px (mobile), 768px (tablet), 1440px (desktop)

---

## Executive Summary

This story migrates the notes and bookmarks data layer from localStorage to Dexie (IndexedDB), and introduces two new card components (`EnhancedCourseCard`, `ProgressCourseCard`) while refactoring `CourseCard` and `ImportedCourseCard`. The visual design quality is high — cards are well-structured, the background token is correct, responsive layouts work across all breakpoints, and the play overlay interaction is polished and consistent across all four card types. However, three accessibility issues require attention before merge: `ProgressCourseCard` is not keyboard-reachable for non-in-progress courses, `EnhancedCourseCard` links lack focus-visible rings, and the Dexie schema is missing compound indexes that generate console warnings on every lesson open.

---

## What Works Well

- **Background token is correct**: `rgb(250, 245, 238)` confirmed via computed style — no regression from the `#FAF5EE` requirement.
- **Card border radius is consistent**: All four card components render with `border-radius: 24px` as required.
- **Play overlay is a shared, polished pattern**: The hover overlay (glow + pulse ring + scale animation) with `motion-reduce:hover:scale-100` is consistently applied across `CourseCard`, `EnhancedCourseCard`, `ImportedCourseCard`, and `ProgressCourseCard`. The `aria-hidden="true"` on the decorative center button in `VideoPlayer` is correctly handled.
- **Responsive layout passes at all breakpoints**: No horizontal scroll at any viewport. Mobile (375px) renders single-column with touch targets at 73x56px (well above the 44px minimum). The mobile bottom nav is properly shown.
- **Image accessibility is solid**: All `<img>` elements have `alt` text, including the responsive `<picture>` srcset variants in `CourseCard` and `ProgressCourseCard`.
- **Progress indicators are well-labelled**: `ProgressCourseCard` uses `aria-label={"\`${course.title}: ${completionPercent}% complete\`"}` on its `<Progress>` bar — this is excellent practice.
- **Async data layer integration is correct**: Both `Overview.tsx` and `Reports.tsx` correctly consume the now-async `getTotalStudyNotes()` via `useEffect` + `.then()`. The migration log message in the console confirms Dexie migration ran successfully (4 notes, 8 bookmarks migrated from localStorage).
- **`CourseCard` focus ring**: The `CourseCard` link correctly includes `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none` — a good reference pattern for the other card types.

---

## Findings by Severity

### Blockers (Must fix before merge)

#### B1 — `ProgressCourseCard`: Not-Started and Completed cards are keyboard-inaccessible

**Issue**: `ProgressCourseCard` renders a `<Card>` (`<div>`) with an `onClick` handler (`navigate(lessonLink)`). The element has `tabIndex: -1`, no `role`, and no `aria-label`. For "Not Started" and "Completed" status cards, there are zero focusable children — the card cannot be reached or activated via keyboard at all.

Only the "In Progress" variant has a "Resume Learning" `<Link>` child, giving keyboard users one path through. But "Not Started" cards (the majority on a fresh account) and "Completed" cards are entirely keyboard-dead zones.

**Location**: `src/app/components/ProgressCourseCard.tsx:81–91`

```tsx
// Current — not keyboard accessible
<Card
  onClick={() => navigate(lessonLink)}
  className={`group card-hover-lift h-full cursor-pointer ...`}
>
```

**Evidence**: Computed DOM inspection confirmed `tabIndex: -1`, `role: null`, `ariaLabel: null`, `focusableChildren: []` for all non-in-progress cards.

**Impact**: Keyboard-only learners (including those with motor disabilities) cannot navigate to any course that has not been started or is completed. This is a WCAG 2.1 SC 2.1.1 (Keyboard) violation.

**Suggestion**: The cleanest fix is to wrap the card content in a `<Link>` (as `CourseCard` does), removing the `onClick`+`navigate` pattern entirely. If the `Card` onClick must stay for visual consistency, add `tabIndex={0}`, `role="link"`, `aria-label={course.title}`, and an `onKeyDown` handler for Enter/Space — matching the pattern already used in `ImportedCourseCard`.

---

#### B2 — `EnhancedCourseCard`: Link has no focus-visible ring

**Issue**: The `<Link>` wrapping `EnhancedCourseCard` has only `className="block h-full"` — no `outline-none`, no `focus-visible:ring-*` classes. When focused via Tab, the browser's default outline may appear (blue ring in Chrome) but it renders at the outer link boundary, which is invisible because the link is full-width with no visible boundary. Users cannot determine which card is focused.

**Location**: `src/app/components/figma/EnhancedCourseCard.tsx:31`

```tsx
// Current — no focus ring
<Link to={lessonLink} className="block h-full">

// Reference — correct pattern from CourseCard.tsx:39
<Link
  to={lessonLink}
  className="rounded-[24px] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none block h-full"
>
```

**Evidence**: Computed `className` on the All Courses grid link: `"block h-full"`. Contrast with `CourseCard` which has the full focus ring chain.

**Impact**: WCAG 2.1 SC 2.4.7 (Focus Visible) violation. Keyboard-navigating learners cannot see which course card is focused on the Overview All Courses grid.

**Suggestion**: Copy the focus ring classes from `CourseCard` verbatim. The `rounded-[24px]` is needed so the ring follows the card corner radius.

---

### High Priority (Should fix before merge)

#### H1 — Dexie missing compound indexes generate console warnings on every lesson load

**Issue**: The `notes` and `bookmarks` tables in `src/db/schema.ts` are queried with two-field objects (`{ courseId, videoId }` and `{ courseId, lessonId }`) but only have individual single-field indexes. Dexie logs a warning on every query:

```
[WARNING] The query {"courseId":"operative-six","videoId":"op6-pillars-of-influence"}
on notes would benefit from a compound index [courseId+videoId]

[WARNING] The query {"courseId":"operative-six","lessonId":"op6-pillars-of-influence"}
on bookmarks would benefit from a compound index [courseId+lessonId]
```

**Location**: `src/db/schema.ts:44–52`

```ts
// Current — version 4 schema
notes: 'id, courseId, &videoId, *tags, createdAt, updatedAt',
bookmarks: 'id, courseId, lessonId, createdAt',

// Needed for compound queries
notes: 'id, [courseId+videoId], courseId, &videoId, *tags, createdAt, updatedAt',
bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
```

Note: adding compound indexes requires a new schema version (v5) with an upgrade migration. The upgrade can be a no-op since indexes are rebuilt automatically by Dexie.

**Impact**: Performance degrades linearly as the notes/bookmarks tables grow — Dexie falls back to full table scans for every query. For a learner with many sessions, this will cause noticeable lag when opening lessons. Console noise also obscures real errors during development.

**Suggestion**: Add a `db.version(5).stores({...})` with compound indexes `[courseId+videoId]` on notes and `[courseId+lessonId]` on bookmarks. No `.upgrade()` callback needed.

---

#### H2 — `ImportedCourseCard`: Hardcoded hex color instead of theme token

**Issue**: Line 151 in `ImportedCourseCard.tsx` uses `group-hover:text-[#2563eb]` — a hardcoded hex value — instead of the `group-hover:text-brand` design token. Every other card component (including the new `CourseCard`, `EnhancedCourseCard`, and `ProgressCourseCard`) uses `group-hover:text-brand`. In dark mode the brand token remaps to a lighter blue, but the hardcoded value stays at `#2563eb` regardless.

**Location**: `src/app/components/figma/ImportedCourseCard.tsx:151`

```tsx
// Current — hardcoded hex
className="font-bold text-base mb-1 line-clamp-2 group-hover:text-[#2563eb]"

// Fix — use token
className="font-bold text-base mb-1 line-clamp-2 group-hover:text-brand"
```

**Evidence**: Grep confirmed `#2563eb` at exactly this location. The corresponding test at `ImportedCourseCard.test.tsx:94` also tests for the literal class name and would need updating.

**Impact**: Dark mode inconsistency — the hover title color on `ImportedCourseCard` will not adapt with the theme, potentially failing contrast requirements in dark mode where the brand token shifts to a lighter blue.

---

### Medium Priority (Fix when possible)

#### M1 — `LessonPlayer.tsx` uses relative imports instead of `@/` alias

**Issue**: Lines 4–17 of `LessonPlayer.tsx` use `../components/...` relative paths instead of the `@/app/components/...` convention established across the rest of the codebase.

**Location**: `src/app/pages/LessonPlayer.tsx:4–17`

```ts
// Current — relative imports
import { Button } from '../components/ui/button'
import { VideoPlayer } from '../components/figma/VideoPlayer'

// Convention — alias imports
import { Button } from '@/app/components/ui/button'
import { VideoPlayer } from '@/app/components/figma/VideoPlayer'
```

**Impact**: Minor — functionally equivalent, but breaks codebase import consistency and would require updating if the file moves. These imports appear to be pre-existing on this file (not introduced in this story), but since `LessonPlayer.tsx` is listed as a changed file, it's worth noting.

---

#### M2 — `ProgressCourseCard`: Minor indentation inconsistency

**Issue**: Line 73 in `ProgressCourseCard.tsx` has inconsistent indentation — `const totalLessons` is not indented to match the rest of the function body:

**Location**: `src/app/components/ProgressCourseCard.tsx:73`

```tsx
export function ProgressCourseCard({ ... }) {
  const navigate = useNavigate()
const totalLessons = course.modules.reduce(...)  // missing two-space indent
  const firstLesson = course.modules[0]?.lessons[0]?.id
```

**Impact**: Cosmetic only. Does not affect runtime behaviour.

---

#### M3 — `useEffect` with suppressed deps lint rule in LessonPlayer

**Issue**: `src/app/pages/LessonPlayer.tsx:62` suppresses the exhaustive-deps rule:

```ts
useEffect(() => {
  if (courseId && lessonId) {
    getNote(courseId, lessonId).then(setNoteText)
  }
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

The intent is correct (load once on mount), but the comment suppresses the lint rule globally for the line rather than being explicit. Because `courseId` and `lessonId` come from route params and do change when navigating between lessons, this means notes will **not reload** if the user navigates from one lesson to another within the same rendered component instance (React Router may reuse the component). The issue is silent — the textarea will show stale content.

**Location**: `src/app/pages/LessonPlayer.tsx:58–62`

**Suggestion**: Add `courseId` and `lessonId` as explicit deps: `}, [courseId, lessonId])`. If this causes a flash, initialize `noteText` with a loading state.

---

### Nitpicks (Optional)

#### N1 — `EnhancedCourseCard` image uses `.webp` directly without `<picture>` fallback

`EnhancedCourseCard` loads the cover image as:
```tsx
<img src={`${course.coverImage}-640w.webp`} alt={course.title} ... />
```
`CourseCard` uses `<picture>` with a WebP `<source>` and a PNG `<img>` fallback. While WebP support is now near-universal (>95%), the inconsistency is worth noting for future-proofing.

**Location**: `src/app/components/figma/EnhancedCourseCard.tsx:37–41`

---

#### N2 — `EnhancedCourseCard` category badge hover state

`EnhancedCourseCard` adds `hover:bg-blue-200` to the category badge, which only applies the blue family. For courses in non-blue categories (emerald, amber, red, purple), the hover state will be an inconsistent blue. `CourseCard` avoids this by using `categoryColors` which maps each category to its correct semantic colour.

**Location**: `src/app/components/figma/EnhancedCourseCard.tsx:80–83`

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥ 4.5:1 | Pass | `rgb(100, 116, 139)` muted text on white `rgb(255,255,255)` cards passes (~4.6:1). H1 black on `#FAF5EE` passes comfortably. |
| Keyboard navigation | Fail | `ProgressCourseCard` Not-Started and Completed variants are unreachable by keyboard (B1). `EnhancedCourseCard` lacks focus ring (B2). |
| Focus indicators visible | Fail | `EnhancedCourseCard` link has no `focus-visible` ring (B2). `CourseCard` passes. |
| Heading hierarchy | Pass | H1 > H2 > H3 structure maintained on Overview and MyClass. LessonPlayer uses H1 for lesson title, H3 for panels. |
| ARIA labels on icon buttons | Pass | All icon-only buttons in the reviewed pages have `aria-label`. VideoPlayer center overlay button correctly uses `aria-hidden="true"`. |
| Semantic HTML | Partial | `ProgressCourseCard` uses a `<div>` with `onClick` instead of a `<Link>` or `<button>` for its primary action (B1). `ImportedCourseCard` correctly uses `<article>` with `tabIndex={0}` and `role`-equivalent via keyboard handler. |
| Form labels associated | Pass | Note editor uses `aria-label="Lesson notes editor"` on the textarea. |
| `prefers-reduced-motion` | Pass | `CourseCard` and `ImportedCourseCard` include `motion-reduce:hover:scale-100` / `motion-reduce:hover:[transform:scale(1)]`. |
| Images have alt text | Pass | All `<img>` elements checked — none missing `alt`. |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass | Single-column grid confirmed (305px column). No horizontal scroll. Bottom nav touch targets 73x56px. |
| Tablet (768px) | Pass | 3-column grid (`md:grid-cols-3`) at 768px. Sidebar collapsed. No horizontal scroll. |
| Desktop (1440px) | Pass | 5-column grid on Overview All Courses (`xl:grid-cols-5`). Sidebar persistent. Background `rgb(250, 245, 238)` confirmed. |

---

## Detailed Findings Reference

### Finding B1 — Evidence (computed DOM)

```json
// ProgressCourseCard "Not Started" card at /my-class
{
  "tag": "DIV",
  "role": null,
  "tabIndex": -1,
  "ariaLabel": null,
  "focusableChildren": []
}
```

### Finding B2 — Evidence (computed class)

```
// EnhancedCourseCard link in All Courses grid
{ "classes": "block h-full" }

// CourseCard link (correct reference)
{ "classes": "rounded-[24px] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none block h-full" }
```

### Finding H1 — Evidence (console warnings)

```
[WARNING] The query {"courseId":"operative-six","videoId":"op6-pillars-of-influence"}
  on notes would benefit from a compound index [courseId+videoId]
[WARNING] The query {"courseId":"operative-six","videoId":"op6-pillars-of-influence"}
  on notes would benefit from a compound index [courseId+videoId]
[WARNING] The query {"courseId":"operative-six","lessonId":"op6-pillars-of-influence"}
  on bookmarks would benefit from a compound index [courseId+lessonId]
```

Reproduced consistently on every visit to `/courses/operative-six/op6-pillars-of-influence`.

### Finding H2 — Evidence (grep)

```
src/app/components/figma/ImportedCourseCard.tsx:151:
  className="font-bold text-base mb-1 line-clamp-2 group-hover:text-[#2563eb]"
```

All other card components use `group-hover:text-brand` at the equivalent location.

---

## Recommendations

1. **Before merge — Fix B1 and B2**: The `ProgressCourseCard` keyboard gap and `EnhancedCourseCard` focus ring are both straightforward fixes. B1 is the higher priority since it affects the majority of cards on My Class for learners who haven't started courses. The `ImportedCourseCard` keyboard pattern (`tabIndex={0}`, `onKeyDown` handler with Enter/Space) is an acceptable model, but wrapping with `<Link>` (as `CourseCard` does) is simpler and removes the need for manual `onKeyDown`.

2. **Before merge — Fix H1 (Dexie compound indexes)**: Add `db.version(5)` with compound indexes. This is a 10-line schema change that eliminates console noise and prevents query performance from degrading as the user's notes/bookmarks grow.

3. **Before merge — Fix H2 (hardcoded hex)**: Single-line change in `ImportedCourseCard.tsx:151`. Update the corresponding test assertion in `ImportedCourseCard.test.tsx:94`.

4. **Post-merge — Address M3 (stale note deps)**: Adding `courseId` and `lessonId` to the `useEffect` deps array in `LessonPlayer` is low-risk and prevents a subtle UX bug where notes appear stale when navigating between lessons within the same course without a full remount.
