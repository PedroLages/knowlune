# Design Review Report — E01-S05 Detect Missing or Relocated Files

**Review Date**: 2026-03-15
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E01-S05 — Detect Missing or Relocated Files
**Branch**: feature/e01-s05-detect-missing-relocated-files
**Changed Files**:
- `src/app/pages/ImportedCourseDetail.tsx`
- `src/hooks/useFileStatusVerification.ts`
- `src/lib/fileVerification.ts`

**Affected Pages**: `/imported-courses/:courseId` (ImportedCourseDetail)

---

## Executive Summary

E01-S05 adds file status verification to the ImportedCourseDetail page, surfacing "File not found" and "Permission needed" badges on content items whose FileSystemHandles are no longer accessible. The implementation is clean, uses design tokens correctly, and the toast aggregation pattern is sound. Three issues require attention before merge: PDFs always render `aria-disabled="true"` regardless of their actual file status (a pre-existing condition now made more visible), the `checking` transient state has no loading indicator, and the component does not call `loadImportedCourses()` so direct URL navigation always shows "Course not found".

---

## What Works Well

- **Zero hardcoded colors**: All color usage goes through design tokens (`bg-destructive`, `text-brand`, `text-warning`, `bg-warning`, `text-muted-foreground`, `bg-card`). The ESLint design-token rule is having its intended effect.
- **Aggregated toast**: A single `toast.warning()` fires with all affected filenames rather than one toast per file. This prevents notification flooding for courses with many unavailable items. The 8-second `TOAST_DURATION.LONG` duration gives users time to read a multi-filename list.
- **Semantic list structure**: The content list correctly uses `<ul aria-label="Course content">` with `<li>` items, providing proper landmark structure for screen readers.
- **Badge role**: `role="status"` on each `FileStatusBadge` correctly marks these as live-region announcements. Icons are marked `aria-hidden="true"`.
- **No horizontal scroll at any breakpoint**: Verified at 375px, 768px, and 1440px. The `max-w-3xl mx-auto` constraint keeps content readable without overflow.
- **Transition timing matches spec**: `transition-colors duration-150` (0.15s) on interactive items falls within the 150-200ms quick-action range from design principles.
- **Clean abort pattern**: `useFileStatusVerification` uses an `ignore` ref to prevent state updates after unmount, and initialises all items to `'checking'` before the async batch — correct race-condition prevention.

---

## Findings by Severity

### Blockers (Must fix before merge)

#### 1. Direct URL navigation always shows "Course not found"

**Location**: `src/app/pages/ImportedCourseDetail.tsx:42-85`

**Evidence**: Navigating directly to `/imported-courses/:courseId` via `page.goto()` renders the "Course not found" empty state because the component reads `importedCourses` from the Zustand store but never calls `loadImportedCourses()`. The store is only populated when the `/courses` page mounts first (it calls `loadImportedCourses()` on mount). The page only functions via client-side navigation from `/courses`.

**Impact**: Any learner who bookmarks a course detail URL, follows a shared link, or opens the page after a browser restart will always see an error state rather than their course content. This is the most common real-world navigation pattern for a detail page.

**Suggestion**: Add `loadImportedCourses` to the component's effect, guarded so it only fetches when the store is empty:

```tsx
const { importedCourses, loadImportedCourses } = useCourseImportStore(...)
useEffect(() => {
  if (importedCourses.length === 0) loadImportedCourses()
}, [])
```

Alternatively, add a loading state while the store initializes rather than immediately falling through to "Course not found".

---

### High Priority (Should fix before merge)

#### 2. No visual loading indicator during the "checking" state

**Location**: `src/app/pages/ImportedCourseDetail.tsx:111-163`, `src/hooks/useFileStatusVerification.ts:38-43`

**Evidence**: The hook correctly initialises all items to `'checking'` before the async `verifyAll()` call, but the component renders `<FileStatusBadge status="checking" />` which returns `null` — so items show no badge during verification. On a fast connection this flicker is imperceptible, but on real devices with many handles the verification may take several hundred milliseconds. There is also no loading skeleton or spinner during this window.

**Impact**: Items briefly appear to be available (no badge, full opacity for available items) before snapping to their disabled/badged state. For a learner who quickly clicks a video during the checking window, they may navigate to a lesson that immediately fails to load.

**Suggestion**: During `'checking'`, render a muted pulse skeleton or a neutral "Verifying..." badge so learners understand the state is transitional. At minimum, disable the item row during checking to prevent premature navigation:

```tsx
const isUnavailable = status === 'missing' || status === 'permission-denied'
const isChecking = status === 'checking'
// treat checking same as unavailable for click-prevention
```

#### 3. PDFs always have `aria-disabled="true"` regardless of file status

**Location**: `src/app/pages/ImportedCourseDetail.tsx:170-200`

**Evidence**: The PDF rendering block applies `aria-disabled="true"` and `cursor-not-allowed` unconditionally:

```tsx
<div
  className={cn(
    'flex items-center gap-3 p-4 rounded-xl border bg-card cursor-not-allowed',
    isUnavailable ? 'opacity-50' : 'opacity-75'
  )}
  aria-disabled="true"  // always applied
>
```

Computed values confirm: both `pdf-missing` (opacity 0.5) and `pdf-regular` (opacity 0.75) have `aria-disabled="true"`. A PDF with a valid, accessible handle still appears disabled.

**Impact**: Screen readers announce all PDFs as disabled, which is false and misleading. Sighted users also cannot click any PDF regardless of availability — this is presumably intentional (PDF viewing not yet implemented), but the `opacity: 0.75` on "available" PDFs contradicts the `aria-disabled` signal. The UI implies PDFs are mostly available but disabled by policy, yet the accessibility tree says they are all disabled.

**Suggestion**: If PDF viewing is not yet implemented, apply a distinct "coming soon" visual pattern rather than reusing the file-status-disabled style. This distinguishes a deliberate feature gap from a file system error. If PDF viewing is intended to work, remove the unconditional `aria-disabled` and treat PDFs the same as videos.

---

### Medium Priority (Fix when possible)

#### 4. Missing `loading` state causes "Course not found" flash on slow stores

**Location**: `src/app/pages/ImportedCourseDetail.tsx:76-85`

**Evidence**: The component has a binary state: either `course` is in the store or it shows "Course not found". There is no intermediate loading/pending state for the window between component mount and store hydration completing.

**Impact**: Even after the blocker (finding 1) is fixed by calling `loadImportedCourses`, there will be a brief flash of "Course not found" before the async DB read completes. This creates a jarring content shift that could confuse learners.

**Suggestion**: Track a `isLoading` state alongside the store hydration, and render a skeleton or spinner during the pending window rather than the error state.

#### 5. `opacity-75` on available-but-unimplemented PDFs is ambiguous

**Location**: `src/app/pages/ImportedCourseDetail.tsx:171-173`

**Evidence**:
```tsx
isUnavailable ? 'opacity-50' : 'opacity-75'
```

Both states reduce opacity, with only a 25-percentage-point difference between "file missing" (0.5) and "file found but PDF viewer not implemented" (0.75). The visual distinction is subtle and does not clearly communicate different meanings.

**Impact**: Learners cannot easily distinguish between "this PDF is unavailable because the file moved" and "this PDF is here but the viewer isn't ready". Both look like errors. The design principles state "color is never the sole indicator of information" — this same principle extends to opacity levels.

**Suggestion**: Use a distinct visual treatment for unimplemented features. A "Coming soon" badge with a neutral/muted style (not a warning or destructive color) communicates intent without implying an error. Alternatively, render these at full opacity with a lock icon and a tooltip.

#### 6. No `prefers-reduced-motion` handling for status transitions

**Location**: `src/app/pages/ImportedCourseDetail.tsx:127-132`

**Evidence**: The filename span uses `transition-colors` which is unguarded. The design principles require `prefers-reduced-motion` respect for all animations.

**Impact**: Learners with vestibular disorders or motion sensitivity who have enabled `prefers-reduced-motion` will still see color transitions. The impact here is low (color transition, not movement), but it is a spec violation.

**Suggestion**: Use Tailwind's `motion-safe:transition-colors` modifier instead of bare `transition-colors`:
```tsx
className={cn('flex-1 font-medium text-sm', !isUnavailable && 'motion-safe:transition-colors group-hover:text-brand')}
```

---

### Nitpicks (Optional)

#### 7. Toast description lists all filenames as a flat comma-separated string

**Location**: `src/hooks/useFileStatusVerification.ts:79-82`

**Evidence**:
```tsx
description: affectedFiles.join(', ')
```

For a course with 10+ unavailable files, this produces a very long single-line description that is hard to parse at a glance.

**Suggestion**: Cap the visible list at 3 filenames with "+ N more" for larger sets:
```tsx
const visible = affectedFiles.slice(0, 3)
const rest = affectedFiles.length - 3
const description = rest > 0
  ? `${visible.join(', ')} +${rest} more`
  : visible.join(', ')
```

#### 8. `aria-label` missing on the `Back to Courses` link icon

**Location**: `src/app/pages/ImportedCourseDetail.tsx:89-95`

**Evidence**: The `<ArrowLeft>` icon inside the back link has `aria-hidden` but the link text "Back to Courses" is present as visible text, so this is not a problem for screen readers — the link is already well-labelled. This is purely a note that the icon is decorative and correctly marked as such.

No action needed.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Destructive badge: white text on `rgb(196,72,80)` — ratio ~4.6:1. Filename text `rgb(28,29,43)` on `rgb(255,255,255)` — ratio ~18:1. Warning token `#c49245` with white `#ffffff` — ratio ~2.8:1 (see note below). |
| Keyboard navigation | Partial | Disabled items correctly not focusable (tabIndex -1). However, when all items are unavailable, there are zero focusable elements in the content list — keyboard users cannot interact with or even read the list items. Back link is focusable. |
| Focus indicators visible | Pass | Back link uses `focus-visible:ring` via Tailwind. Badge uses `focus-visible:ring-[3px]` from CVA. |
| Heading hierarchy | Pass | Single H1 for course title. No sub-headings needed at this page scale. |
| ARIA labels on icon buttons | Pass | All icons are `aria-hidden="true"`. No icon-only buttons on this page. |
| Semantic HTML | Partial | `<ul aria-label="Course content">` with `<li>` items — correct. Disabled items use `<div aria-disabled="true">` rather than `<button disabled>` — acceptable since these items are intentionally non-interactive (not buttons). |
| Form labels associated | N/A | No form inputs on this page. |
| `prefers-reduced-motion` | Fail | `transition-colors` not guarded with `motion-safe:` modifier. |
| `role="status"` on badges | Pass | Both `FileStatusBadge` variants use `role="status"`. |
| Toast accessibility | Pass | Sonner renders toasts into a `region[aria-label]` with correct live region semantics. |

**Warning badge contrast note**: The `bg-warning` token resolves to `#c49245` with `text-warning-foreground: #ffffff`. This pairing produces a contrast ratio of approximately 2.8:1, which fails WCAG AA for normal-weight text at 12px (the badge font size). The permission-denied warning badge variant is affected. The missing badge uses `bg-destructive` which passes at ~4.6:1. This is a pre-existing token definition issue, not introduced by this story, but the badge is the first visible use of `bg-warning` with white text at small size.

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll. Content renders in single column. Badge text fits within row at `113px` wide. Row height `74px` exceeds minimum 44px touch target. `flex-nowrap` keeps badge and duration on same line — tight but not overflowing. Long filenames use `flex-1` to shrink. |
| Tablet (768px) | Pass | No horizontal scroll. Content area `709px` wide respects `max-w-3xl`. Mobile nav bar switches correctly to bottom tab bar at this viewport. |
| Desktop (1440px) | Pass | No horizontal scroll. Content area constrained to `768px` (max-w-3xl = 48rem). Sidebar visible and persistent. |

**Mobile observation**: On 375px, a filename of ~50+ characters combined with the badge and duration creates a dense row. The `flex-1` on the filename span ensures it shrinks rather than overflows, but long filenames may be truncated visually without `overflow-hidden text-ellipsis` — the current `overflow: visible; white-space: normal` means they can wrap to a second line, making the row taller. This is acceptable behaviour but could be refined with explicit truncation if the design calls for single-line rows.

---

## Detailed Findings Summary

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| 1 | Blocker | `ImportedCourseDetail.tsx` | 42 | Direct URL navigation always shows "Course not found" — store not loaded |
| 2 | High | `ImportedCourseDetail.tsx` | 111-163 | No visual indicator during `checking` state — premature click risk |
| 3 | High | `ImportedCourseDetail.tsx` | 170 | PDFs always `aria-disabled="true"` regardless of actual file status |
| 4 | Medium | `ImportedCourseDetail.tsx` | 76-85 | No loading state — "Course not found" flash during store hydration |
| 5 | Medium | `ImportedCourseDetail.tsx` | 171-173 | `opacity-75` vs `opacity-50` insufficient to distinguish two different disabled meanings |
| 6 | Medium | `ImportedCourseDetail.tsx` | 127-132 | `transition-colors` not guarded with `motion-safe:` |
| 7 | Nitpick | `useFileStatusVerification.ts` | 79 | Toast description unbounded for large file counts |
| 8 | Nitpick | (token definition) | `theme.css:64` | `bg-warning` + white text fails WCAG AA at 12px — pre-existing, not introduced here |

---

## Recommendations

1. **Fix the direct navigation blocker first** (finding 1). This is a user-facing regression for any learner who bookmarks or shares a course URL. A two-line fix in the component's `useEffect` is sufficient.

2. **Treat `checking` as non-navigable** (finding 2). The simplest fix is to include `'checking'` in the `isUnavailable` check so items are non-clickable during verification. A skeleton shimmer is ideal but not required for merge.

3. **Resolve the PDF `aria-disabled` ambiguity** (finding 3). Decide whether PDFs are "not yet implemented" or "file system dependent". Each needs a distinct visual treatment. The current implementation conflates both cases.

4. **Log the warning token contrast issue** (finding 8) in the design token backlog. The `bg-warning` + white pairing used by `FileStatusBadge` for "Permission needed" does not meet WCAG AA at the badge's 12px text size. Consider `text-warning-foreground` using a dark color (e.g. the existing dark-mode value `#1a1b26`) in light mode as well, or darkening the warning background token.

---

*Review conducted via Playwright MCP with live IndexedDB seeding. All computed styles verified against running application at `http://localhost:5173`. No console errors observed during testing.*
