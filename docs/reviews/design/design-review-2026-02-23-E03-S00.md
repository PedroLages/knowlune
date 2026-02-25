# Design Review — E03-S00: Data Layer Migration (Re-Review)

**Review Date**: 2026-02-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Review Type**: Re-review of merged story — verifying claimed fixes from commit `07b2506`
**Base Branch**: `main` (post-merge, includes E03-S01 Tiptap editor)
**Commit Range Reviewed**: `07b2506` (fix commit) → `HEAD` (`836d2a5`)

**Key Component Files Inspected**:
- `src/app/components/figma/CourseCard.tsx` — unified card (formerly CourseCard + EnhancedCourseCard + ProgressCourseCard)
- `src/app/components/figma/ImportedCourseCard.tsx`
- `src/app/components/notes/NoteEditor.tsx` — new (E03-S01)
- `src/app/pages/LessonPlayer.tsx`
- `src/app/pages/Overview.tsx`
- `src/app/pages/Reports.tsx`
- `src/db/schema.ts`

**Affected Pages Tested**: `/` (Overview), `/my-class`, `/courses`, `/courses/operative-six/op6-pillars-of-influence` (LessonPlayer), `/reports`
**Viewports Tested**: 375px (mobile), 768px (tablet), 1440px (desktop)

---

## Executive Summary

This re-review verifies four claimed fixes from commit `07b2506` and audits the new state of `main` following a post-fix refactor (`874e25d`) that unified `ProgressCourseCard`, `EnhancedCourseCard`, and the original `CourseCard` into a single `CourseCard` component with a `variant` prop. Two of the four original fixes did not survive the merge: **B1 (ProgressCourseCard keyboard accessibility) was re-introduced by the refactor** — the fix was applied to `ProgressCourseCard.tsx` which was then deleted in the merge, and the replacement `progress` variant in `CourseCard.tsx` does not carry the fix forward. H1 (Dexie compound indexes) and H2 (hardcoded hex color) are confirmed fixed. B2 (EnhancedCourseCard focus ring) no longer applies as the component was deleted, though the equivalent path via the `progress` variant wrapper still lacks a focus ring. Two new medium-priority issues were identified in the E03-S01 note editor.

---

## Fix Verification — Original Four Issues

### B1 — ProgressCourseCard keyboard accessibility

**Claimed fix**: Add `tabIndex={0}`, `role="link"`, `aria-label`, `onKeyDown` (Enter/Space), and focus ring to the `<Card>` in `ProgressCourseCard.tsx`.

**Verification status: NOT FIXED — REGRESSION**

The fix was correctly applied to `src/app/components/ProgressCourseCard.tsx` in commit `07b2506`. However, a subsequent refactor commit (`874e25d`) deleted `ProgressCourseCard.tsx` and merged its functionality into `CourseCard.tsx` as `variant='progress'`. The merge commit `30c99ed` explicitly notes: "Resolve conflicts: accept deletion of ProgressCourseCard."

The replacement navigation wrapper in `CourseCard.tsx` at lines 628–638 is:

```tsx
// CourseCard.tsx:628-638 — current state on main
if (variant === 'progress') {
  return (
    <>
      <div
        onClick={(e) => { guardNavigation(e); if (!e.defaultPrevented) navigate(lessonLink) }}
        {...previewHandlers}
        className="h-full"
      >
        {cardShell}
      </div>
      {previewDialog}
    </>
  )
}
```

Live DOM inspection confirms `tabIndex: -1`, `role: null`, `ariaLabel: null`, `onKeyDown: null` on this wrapper. The `Not Started` and `Completed` variant cards contain only one focusable child: the `Course details` popover button. The card body itself cannot be reached via keyboard.

**Evidence** (computed DOM on `/my-class`):
```json
{
  "tag": "DIV",
  "role": null,
  "tabIndex": -1,
  "ariaLabel": null,
  "hasOnKeyDown": false,
  "className": "h-full"
}
```

Keyboard scan of the page found 34 total focusable elements. In the "Not Started" grid, Tab navigates only through `Course details` buttons — no path exists to navigate to any Not Started card as a whole.

---

### B2 — EnhancedCourseCard focus-visible ring

**Claimed fix**: Add `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none rounded-[24px]` to the `<Link>` wrapper in `EnhancedCourseCard.tsx`.

**Verification status: NO LONGER APPLICABLE (component deleted)**

`EnhancedCourseCard.tsx` was deleted in refactor commit `874e25d`. The `overview` and `library` variants in the unified `CourseCard.tsx` correctly use a `<Link>` wrapper with the full focus ring chain at line 648:

```tsx
// CourseCard.tsx:644-652 — library + overview variants
<Link
  to={lessonLink}
  onClick={guardNavigation}
  {...previewHandlers}
  className="rounded-[24px] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none block h-full cursor-default"
>
```

This is the correct pattern. The `overview` variant cards on the Overview "All Courses" grid are all keyboard-accessible via this `<Link>` wrapper. B2 is resolved for all `library` and `overview` variant usages.

However, as noted under B1, the `progress` variant uses a plain `<div>` without equivalent focus ring styling, so the spirit of B2 still applies to that variant.

---

### H1 — Dexie compound indexes generating console warnings

**Claimed fix**: Add `db.version(5)` with `[courseId+videoId]` on `notes` and `[courseId+lessonId]` on `bookmarks`.

**Verification status: FIXED**

`src/db/schema.ts` version 4 now includes both compound indexes directly:

```ts
// schema.ts:44-52 — version 4
db.version(4).stores({
  ...
  bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
})
```

Console captured on `/courses/operative-six/op6-pillars-of-influence` shows zero Dexie warnings. Only the Google Fonts CSP error (pre-existing, unrelated to this story) and React DevTools info message appear.

---

### H2 — ImportedCourseCard hardcoded hex color

**Claimed fix**: Replace `group-hover:text-[#2563eb]` with `group-hover:text-brand` at `ImportedCourseCard.tsx:151`.

**Verification status: FIXED**

Grep confirms `text-brand` at line 300 of the current `ImportedCourseCard.tsx` (line numbers shifted due to file growth). No `#2563eb` occurrences remain in any card component file.

```
// Confirmed fixed:
className="font-bold text-base mb-1 line-clamp-2 group-hover:text-brand"
```

---

## What Works Well

- **H1 and H2 are cleanly fixed**: Compound indexes eliminate Dexie console noise; `text-brand` token is consistent across all card types. Both were single-line changes done correctly.
- **Background token passes**: `rgb(250, 245, 238)` confirmed on body — `#FAF5EE` is correct and unaffected.
- **Card border radius is consistent**: `rounded-[24px]` on all card types confirmed in both code and DOM.
- **Library and overview variant cards are fully keyboard-accessible**: The unified `CourseCard` `<Link>` wrapper with `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none` correctly applies to all non-progress cards.
- **Data layer integration is correct on Overview and Reports**: Both pages display "Study Notes: 5" via async Dexie reads. The note count reflects the migration from localStorage.
- **Responsive layout passes at all breakpoints**: No horizontal scroll at 375px, 768px, or 1440px. Mobile touch targets (bottom nav: 73x56px) exceed the 44px minimum. Tablet renders 2-column grid (341px columns).
- **M3 stale note deps resolved**: `LessonPlayer.tsx` useEffect at line 104 now correctly lists `[courseId, lessonId]` as dependencies — notes reload properly when navigating between lessons.
- **Tiptap NoteEditor is well-structured**: Toolbar buttons have `aria-label` attributes, active states are visually indicated, the autosave indicator uses `aria-live="polite"`, and the `focus-visible:ring-2` focus style is applied to toolbar buttons. The 3s debounce + 10s max-wait autosave pattern is solid.

---

## Findings by Severity

### Blockers (Must fix before merge)

#### B1 — `CourseCard` progress variant: Not-Started and Completed cards remain keyboard-inaccessible

**Issue**: The `progress` variant navigation wrapper in `CourseCard.tsx` (lines 628–638) is a plain `<div>` with an `onClick` handler. It has no `tabIndex`, no `role`, no `aria-label`, and no `onKeyDown`. For "Not Started" and "Completed" status cards, the only focusable child is the `Course details` popover button — the card itself cannot be reached or activated by keyboard.

This is the same issue as B1 from the original review. The fix was applied to `ProgressCourseCard.tsx` but that component was then deleted during the card unification refactor, and the replacement did not carry the fix forward.

**Location**: `src/app/components/figma/CourseCard.tsx:628–638`

```tsx
// Current — not keyboard accessible
if (variant === 'progress') {
  return (
    <>
      <div
        onClick={(e) => { guardNavigation(e); if (!e.defaultPrevented) navigate(lessonLink) }}
        {...previewHandlers}
        className="h-full"
      >
        {cardShell}
      </div>
      {previewDialog}
    </>
  )
}
```

The fix should mirror the `library`/`overview` pattern using a `<Link>` wrapper, which also removes the need for manual `onClick`+`navigate`:

```tsx
// Suggested fix — consistent with library/overview variants
if (variant === 'progress') {
  return (
    <>
      <Link
        to={lessonLink}
        onClick={guardNavigation}
        {...previewHandlers}
        className="rounded-[24px] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none block h-full"
      >
        {cardShell}
      </Link>
      {previewDialog}
    </>
  )
}
```

Note: the inner `Resume Learning` and `Review Course` `<Link>` buttons at lines 572 and 585 would need `e.preventDefault()` or `e.stopPropagation()` to avoid double navigation, which they already have via `onClick={(e) => e.stopPropagation()}`.

**Evidence**: Computed DOM shows `{ tag: "DIV", role: null, tabIndex: -1, ariaLabel: null, hasOnKeyDown: false }`. Keyboard scan finds 34 focusable elements on `/my-class` — zero are the card body elements for the 7 Not Started courses.

**Impact**: WCAG 2.1 SC 2.1.1 (Keyboard). Keyboard-only learners cannot navigate to any course that has not been started or is completed. On a fresh account, this means the entire My Class page is effectively inaccessible to keyboard users except for the one in-progress course.

---

### High Priority (Should fix before merge)

No new high-priority issues. H1 and H2 from the original review are confirmed fixed.

---

### Medium Priority (Fix when possible)

#### M1 — `LessonPlayer.tsx` uses relative imports (unchanged from original review)

**Issue**: Lines 4–16 of `LessonPlayer.tsx` use `../components/...` relative paths instead of the `@/app/components/...` convention used throughout the rest of the codebase.

**Location**: `src/app/pages/LessonPlayer.tsx:4–16`

```ts
// Current — relative paths (lines 4-16)
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { VideoPlayer } from '../components/figma/VideoPlayer'
import { NoteEditor } from '../components/notes/NoteEditor'
// ... (12 imports total use relative paths)

// Convention — alias paths
import { Button } from '@/app/components/ui/button'
import { NoteEditor } from '@/app/components/notes/NoteEditor'
```

This was a medium-priority finding in the original review that was not addressed. The E03-S01 NoteEditor import at line 15 also uses the relative path pattern. These are functionally equivalent but inconsistent with the project convention and would require updating if the file moves.

**Impact**: Codebase consistency. No runtime effect.

---

#### M2 — `NoteEditor` toolbar buttons are below the 44px touch target minimum on mobile

**Issue**: All 8 toolbar buttons in `NoteEditor` (`ToolbarButton` component) are `h-8 w-8` (32x32px) at all viewport sizes. WCAG 2.1 SC 2.5.5 (Target Size) requires 44x44px minimum on touch devices. The `ToolbarButton` component at line 334 hardcodes `h-8 w-8`.

**Location**: `src/app/components/notes/NoteEditor.tsx:334`

```tsx
// Current — 32x32px at all sizes
className={cn(
  'inline-flex items-center justify-center h-8 w-8 rounded-md ...',
  ...
)}
```

**Evidence**: Measured 32x32px on all 8 buttons at 375px viewport. All reported `belowMinimum: true`.

**Suggestion**: Use responsive sizing — `h-8 w-8 sm:h-8 sm:w-8` is fine for desktop (mouse pointer has no minimum), but add adequate tap target padding on mobile with `@media (pointer: coarse)` or use `min-h-[44px] min-w-[44px]` with `sm:h-8 sm:w-8` override. Alternatively, the toolbar container could use `py-2` padding (already present) and rely on the overall button area being larger with a transparent hit area via `p-2` instead of tight `h-8 w-8`.

**Impact**: Motor-impaired learners on mobile or tablet cannot reliably tap formatting buttons. This is particularly harmful for note-taking — the primary use case of the feature.

---

#### M3 — `NoteEditor` link insertion uses `window.prompt`

**Issue**: `NoteEditor.tsx:216` opens a native browser `window.prompt()` dialog to collect the URL when inserting a link:

```tsx
// NoteEditor.tsx:213-220
const insertLink = useCallback(() => {
  if (!editor) return
  const url = window.prompt('Enter URL:')
  if (url) {
    editor.chain().focus().setLink({ href: url }).run()
  }
}, [editor])
```

`window.prompt` is a native browser dialog that: blocks the JavaScript thread, is unstyled and does not match the LevelUp design language, does not support validation (e.g., URL format checking), is inaccessible in some assistive technology contexts, and is explicitly disallowed in some CSP environments.

**Location**: `src/app/components/notes/NoteEditor.tsx:216`

**Suggestion**: Replace with an inline popover or controlled input field. A shadcn `<Popover>` with a URL `<Input>` and a "Set Link" `<Button>` would integrate cleanly with the existing design system. The popover could appear anchored to the Insert Link toolbar button.

**Impact**: Design inconsistency and potential accessibility gap. Not a blocking issue since link insertion works, but `window.prompt` is a notable anti-pattern for a platform aiming for polished UX.

---

### Nitpicks (Optional)

#### N1 — `NoteEditor` Tiptap contenteditable div has no explicit `role` or `aria-label`

The Tiptap `EditorContent` renders a `<div contenteditable="true">` without an explicit `role="textbox"` or `aria-label`. Modern browsers and ATs assign an implicit `textbox` role to `contenteditable` elements, and Tiptap's default output is generally accessible, but explicitly declaring `role="textbox" aria-label="Lesson notes" aria-multiline="true"` would make the intent unambiguous for all AT combinations.

**Location**: `src/app/components/notes/NoteEditor.tsx:303` — the `<EditorContent>` component. Tiptap supports passing `attributes` to the editor via `editorProps.attributes` (already used at line 117 for class). Adding `role` and `aria-label` there would propagate to the rendered element.

```tsx
// Suggested addition to editorProps.attributes:
attributes: {
  class: 'prose prose-sm dark:prose-invert ...',
  role: 'textbox',
  'aria-label': 'Lesson notes',
  'aria-multiline': 'true',
},
```

**Impact**: Minor. Functional in most contexts without this change.

---

#### N2 — `NoteEditor` `handleNoteChange` in LessonPlayer is not memoized

`handleNoteChange` at `LessonPlayer.tsx:242` is a plain function recreated on every render. `NoteEditor` receives it as `onSave`, and since NoteEditor uses `useEffect` with a latest-ref pattern (`onSaveRef`), the recreated reference does not cause re-renders. However, using `useCallback` would be the conventional approach for callback props and makes the intent explicit.

**Location**: `src/app/pages/LessonPlayer.tsx:242`

**Impact**: No functional effect. Code quality only.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥ 4.5:1 | Pass | Background `rgb(250, 245, 238)` confirmed. Muted text on white cards ~4.6:1. No regressions detected. |
| Keyboard navigation | Fail | `CourseCard` progress variant wrapper has no `tabIndex`, `role`, or `onKeyDown`. Not-Started and Completed cards on `/my-class` are keyboard-dead zones (B1 re-introduced). |
| Focus indicators visible | Pass | `library` and `overview` variant cards: `focus-visible:ring-2 focus-visible:ring-brand` confirmed on `<Link>` wrapper. NoteEditor toolbar buttons: `focus-visible:ring-2 focus-visible:ring-ring` present. |
| Heading hierarchy | Pass | H1 > H2 > H3 maintained on all tested pages. LessonPlayer: H1 for lesson title, H3 for Course Content sidebar. |
| ARIA labels on icon buttons | Pass | All icon-only buttons have `aria-label`. Tiptap toolbar buttons confirmed. VideoPlayer overlay `aria-hidden="true"` correct. |
| Semantic HTML | Partial | `progress` variant card uses `<div onClick>` instead of `<Link>` or `<button>` (B1). All other contexts use semantic elements. |
| Form labels associated | Pass | NoteEditor placeholder text is set via Tiptap Placeholder extension (not as a label replacement). Autosave indicator uses `aria-live="polite"`. |
| `prefers-reduced-motion` | Pass | `motion-reduce:hover:scale-100` present on card hover transitions. |
| Images have alt text | Pass | All `<img>` elements checked — none missing `alt`. |
| Touch targets ≥ 44px | Partial | Bottom nav: 73x56px (pass). NoteEditor toolbar buttons: 32x32px on mobile (fail — M2). |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll (`scrollWidth: 364 < clientWidth: 375`). Single-column card layout. Bottom nav touch targets 73x56px. NoteEditor renders correctly. |
| Tablet (768px) | Pass | No horizontal scroll. 2-column grid (341px columns). Sidebar collapsed as expected. |
| Desktop (1440px) | Pass | Background `rgb(250, 245, 238)` confirmed. Sidebar persistent. All cards render in correct multi-column layout. |

---

## Detailed Evidence

### B1 Evidence — Computed DOM on `/my-class` (progress variant wrappers)

```json
[
  { "tag": "DIV", "role": null, "tabIndex": -1, "ariaLabel": null, "hasOnKeyDown": false, "className": "h-full" },
  { "tag": "DIV", "role": null, "tabIndex": -1, "ariaLabel": null, "hasOnKeyDown": false, "className": "h-full" },
  { "tag": "DIV", "role": null, "tabIndex": -1, "ariaLabel": null, "hasOnKeyDown": false, "className": "h-full" }
]
```

Keyboard scan found 34 total focusable elements. In the "Not Started" section, focusable elements are: sidebar nav links, header controls, tab buttons, and `Course details` popover buttons inside each card. The card bodies themselves have zero keyboard entry points.

### H1 Evidence — Console (zero Dexie warnings)

Navigation to `/courses/operative-six/op6-pillars-of-influence` produced only:
```
[INFO] React DevTools download prompt
[ERROR] Google Fonts CSP block (pre-existing, unrelated)
```
No Dexie index warnings. Compound indexes `[courseId+videoId]` on notes and `[courseId+lessonId]` on bookmarks confirmed in `schema.ts:50-51`.

### H2 Evidence — Grep

```
# grep result: no #2563eb in ImportedCourseCard.tsx
# Confirmed fixed at line 300:
className="font-bold text-base mb-1 line-clamp-2 group-hover:text-brand"
```

### M2 Evidence — Button sizes at 375px

```json
[
  { "label": "Bold",          "width": 32, "height": 32, "belowMinimum": true },
  { "label": "Italic",        "width": 32, "height": 32, "belowMinimum": true },
  { "label": "Heading",       "width": 32, "height": 32, "belowMinimum": true },
  { "label": "Bullet list",   "width": 32, "height": 32, "belowMinimum": true },
  { "label": "Ordered list",  "width": 32, "height": 32, "belowMinimum": true },
  { "label": "Code block",    "width": 32, "height": 32, "belowMinimum": true },
  { "label": "Insert link",   "width": 32, "height": 32, "belowMinimum": true },
  { "label": "Add Timestamp", "width": 139, "height": 32, "belowMinimum": true }
]
```

---

## Root Cause Note

The B1 regression has a clear root cause: the fix was applied to a file that was simultaneously being deleted in a parallel branch. The merge commit `30c99ed` resolved this by accepting the deletion, but the fix was not replayed onto the new unified component. This is a common merge-conflict resolution failure mode. Going forward, when a fix is applied to a component that gets deleted/merged during the same sprint, the fix responsibility should explicitly transfer to the replacement component.

---

## Recommendations

1. **Fix B1 before the next PR**: Change the `progress` variant navigation wrapper in `src/app/components/figma/CourseCard.tsx:628` from a plain `<div>` to a `<Link>` with the same focus ring classes used by the `library` and `overview` variants. The existing inner `Resume Learning` and `Review Course` `<Link>` buttons already call `e.stopPropagation()`, so double navigation is already handled. Estimated effort: 10 lines.

2. **Address M2 (touch targets) before shipping the note editor to mobile learners**: The 32x32px toolbar buttons are a real barrier on touch devices. Adding `min-h-[44px] min-w-[44px]` to `ToolbarButton` (with a desktop override if needed) is a small change with meaningful impact for learners taking notes on tablets.

3. **Replace `window.prompt` in M3 with a Popover-based URL input**: This is lower urgency but represents the largest design quality gap in the new E03-S01 feature. A two-field popover (URL + Set Link button) would take an hour to build and eliminate the jarring native dialog.

4. **Sweep LessonPlayer imports for `@/` alias**: M1 (relative imports) has been outstanding across two reviews now. A single sed pass or IDE refactor would clean up all 12 affected import lines.
