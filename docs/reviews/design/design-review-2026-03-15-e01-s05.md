# Design Review Report — E01-S05: Detect Missing or Relocated Files

**Review Date**: 2026-03-15
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E01-S05 — Detect Missing or Relocated Files
**Branch**: `feature/e01-s05-detect-missing-relocated-files`
**Changed Files** (UI-relevant):
- `src/app/pages/ImportedCourseDetail.tsx`
- `src/hooks/useFileStatusVerification.ts`
- `src/lib/fileVerification.ts`

**Affected Pages**: `/imported-courses/:courseId` (ImportedCourseDetail)
**Viewports Tested**: 1440px (desktop), 768px (tablet), 375px (mobile)
**Theme Tested**: Dark mode (active in test browser session)

---

## Executive Summary

E01-S05 implements file status detection for imported courses using the File System Access API. The badge design, disabled state styling, and toast notification are all structurally correct and follow design guidance from the story. Two issues require attention before merge: a confirmed double-toast bug caused by separate video and PDF async loads triggering the `useFileStatusVerification` hook twice, and an inconsistent treatment of `permission-denied` status between the video and PDF rendering paths.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

**1. Double toast fires on every course load**

The `useFileStatusVerification` hook's `useEffect` depends on `[videos, pdfs]`. In `ImportedCourseDetail.tsx`, videos and PDFs are loaded via two separate `useEffect` calls, each resolving independently. Because the DB queries are not coordinated, the hook frequently runs first with `[videos, []]` (triggering a "2 files not found" toast), then again immediately with `[videos, pdfs]` (triggering a second "3 files not found" toast). The `toastFiredRef` guard is reset to `false` at the start of each effect run (line 36 of `useFileStatusVerification.ts`), so it cannot prevent the second toast.

Observed live during review: both toasts were visible simultaneously on every navigation to the course detail page.

This violates the story's own guidance: "Show one aggregated toast per course load (not per file) to avoid toast spam." The design intent is a single notification, but users currently see two in quick succession, with different file counts, which is confusing.

**Location**: `src/hooks/useFileStatusVerification.ts:36`, `src/app/pages/ImportedCourseDetail.tsx:50-72`

**Suggestion**: Load both videos and PDFs in a single coordinated `useEffect` in `ImportedCourseDetail.tsx` before passing them to the verification hook, or pass a single `allItems` array to the hook so it only ever runs once per course load. For example:

```tsx
// In ImportedCourseDetail.tsx — combine into one effect
useEffect(() => {
  if (!courseId) return
  let ignore = false
  Promise.all([
    db.importedVideos.where('courseId').equals(courseId).sortBy('order'),
    db.importedPdfs.where('courseId').equals(courseId).toArray(),
  ]).then(([videos, pdfs]) => {
    if (!ignore) { setVideos(videos); setPdfs(pdfs) }
  })
  return () => { ignore = true }
}, [courseId])
```

---

**2. `permission-denied` status not handled in the PDF rendering path**

The video rendering path uses `isUnavailable = status === 'missing' || status === 'permission-denied'` (line 109), correctly treating both states as unavailable. The PDF rendering path uses `isMissing = status === 'missing'` only (line 157), leaving `permission-denied` PDFs with:
- `opacity-75` instead of `opacity-50`
- `text-warning` icon instead of `text-muted-foreground`
- `cursor-not-allowed` but via the unconditional class, not tied to the unavailability state

The `FileStatusBadge` component does correctly show a "Permission needed" badge for `permission-denied` PDFs (since it receives `status` directly), but the row's visual treatment is inconsistent with videos and with the story's design table, which specifies `opacity-0.65` for permission-denied across all content types.

**Location**: `src/app/pages/ImportedCourseDetail.tsx:157-183`

**Suggestion**: Align the PDF rendering path with the video path. Introduce `isUnavailable` (covering both states) alongside `isMissing` for the icon color differentiation:

```tsx
const isUnavailable = status === 'missing' || status === 'permission-denied'
const isMissing = status === 'missing'
// Use isUnavailable for opacity/cursor, isMissing vs permission-denied for icon color
```

---

### Medium Priority (Fix when possible)

**3. Settlement failure uses hardcoded `'unknown'` as map key**

In `useFileStatusVerification.ts` line 66, when a `Promise.allSettled` rejection occurs (the `else` branch of `result.status === 'fulfilled'`), the code writes `verified.set('unknown', 'missing')`. The literal string `'unknown'` is used as the key rather than the item's actual ID. The rejected item will have no entry in the `verified` map, so the component falls through to `?? 'checking'` and the item permanently shows no status indicator (stuck in the `checking` state visually — in this implementation that means no badge, appearing as if the item is available when it may not be).

This is a low-probability path (it would require the `verifyFileHandle` promise itself to throw, not just return a status), but it is a silent failure when it does occur.

**Location**: `src/hooks/useFileStatusVerification.ts:63-67`

**Suggestion**: The rejection handler needs access to the item ID. Since `Promise.allSettled` does not provide it in the rejection case with the current structure, capture it in the closure:

```ts
items.map(async item => {
  try {
    const status = await verifyFileHandle(item.fileHandle)
    return { id: item.id, filename: item.filename, status }
  } catch {
    return { id: item.id, filename: item.filename, status: 'missing' as FileStatus }
  }
})
```

Then the outer `Promise.allSettled` rejection case can simply be removed, since individual errors are already caught.

---

**4. No `'checking'` skeleton/loading state visible during verification**

When the course content list first renders, all items begin in the `'checking'` status. The component currently shows a fully-styled item row during this window (the `?? 'checking'` fallback returns `'checking'`, which is not `'missing'` or `'permission-denied'`, so the available-file styling applies). For fast connections this is imperceptible. On slower devices or with many items, the content list briefly shows all items as clickable/available before badges appear — which could lead a learner to click a missing item during the brief window.

The story design guidance does not explicitly specify a skeleton, but a subtle opacity or visual cue during `'checking'` would eliminate the misleading-state window.

**Location**: `src/app/pages/ImportedCourseDetail.tsx:108-132`

**Suggestion**: Treat `'checking'` similarly to unavailable for click purposes (render as `div` rather than `Link` until status is resolved), or add a subtle opacity reduction:

```tsx
const isUnavailable = status === 'missing' || status === 'permission-denied'
const isChecking = status === 'checking'
// Render as non-link until status is known
const isNonNavigable = isUnavailable || isChecking
```

---

### Nitpicks (Optional)

**5. `<ul>` content list has no accessible label**

The `data-testid="course-content-list"` `<ul>` element has no `aria-label` or `aria-labelledby`. Screen readers will announce it as an unlabelled list. Adding `aria-label="Course content"` or pointing to the course title heading via `aria-labelledby` would improve the screen reader context when navigating by landmark/list.

**Location**: `src/app/pages/ImportedCourseDetail.tsx:106`

---

**6. Content item border-radius is `rounded-xl` (14px computed) rather than `12px`**

The design tokens specify `rounded-xl` as 12px for buttons, but Tailwind's `rounded-xl` resolves to `0.75rem = 12px` at default scale. The computed value observed was `14px`, suggesting either a non-default Tailwind configuration or a different utility is in effect. This is a very minor visual discrepancy that does not affect usability.

---

## What Works Well

- **Badge design is pixel-perfect against the story spec.** The destructive variant badge with `AlertTriangle` icon, `role="status"`, and `aria-hidden="true"` on the icon is exactly as specified. The "Permission needed" warning badge correctly uses `bg-warning text-warning-foreground` tokens (no hardcoded colors).

- **Disabled state is thorough.** Missing items correctly render as `<div>` (not `<Link>`), carry `aria-disabled="true"`, and have `tabIndex: -1` set by the browser, so they are skipped by keyboard navigation. No focusable children exist inside disabled items.

- **Responsive behaviour is correct.** At 375px mobile: no horizontal overflow, all items are 74px tall (exceeding the 44px touch-target minimum), and the badge wraps below the filename as the story specifies. At 768px tablet: layout is clean, no overflow.

- **No hardcoded colors.** All color utilities in the changed files use design tokens (`text-brand`, `text-muted-foreground`, `text-warning`, `bg-warning`, `bg-card`, destructive variant). ESLint enforcement is effective here.

- **Toast content is correct.** The aggregated toast includes both a count summary ("3 files not found") and the specific filenames as the description — good UX for a learner who needs to know which files to locate.

- **`prefers-reduced-motion` is respected.** Global CSS handles this and `transition-colors` on available items will be suppressed for users who opt out of motion.

---

## Detailed Findings

### Finding 1 — Double Toast

- **Issue**: Two toasts fire on a single course load due to separate async loads of videos and PDFs
- **Location**: `src/hooks/useFileStatusVerification.ts:36` and `src/app/pages/ImportedCourseDetail.tsx:54-72`
- **Evidence**: Observed live — both "2 files not found" and "3 files not found" toasts visible simultaneously. The `toastFiredRef.current = false` reset at line 36 means the guard is ineffective across re-runs caused by deps changing.
- **Impact**: A learner sees two notifications with contradictory file counts. The second overrides the meaning of the first, causing confusion about how many files are actually missing. It also adds noise to the notification region.
- **Suggestion**: Combine the two `db` queries in `ImportedCourseDetail.tsx` into a single `Promise.all` so both resolve before state is set, ensuring the hook only runs once with the full item list.

### Finding 2 — PDF `permission-denied` Inconsistency

- **Issue**: PDF items with `permission-denied` status receive different visual treatment than video items with the same status
- **Location**: `src/app/pages/ImportedCourseDetail.tsx:157` — uses `isMissing` (line 157) where video path uses `isUnavailable` (line 109)
- **Evidence**: Code inspection — the PDF block declares `const isMissing = status === 'missing'` and does not declare `isUnavailable`. The `opacity-75` class is applied to `permission-denied` PDFs instead of `opacity-50`.
- **Impact**: The design guidance table specifies `opacity-0.65` for `permission-denied` across all item types. The inconsistency would confuse learners if a course mixes permission-denied videos and PDFs — they would look different despite being the same state.
- **Suggestion**: Introduce `isUnavailable` in the PDF rendering block, mirroring the video block exactly.

### Finding 3 — Settlement Failure Silent Failure

- **Issue**: `Promise.allSettled` rejection handler uses `'unknown'` literal as map key instead of the item ID
- **Location**: `src/hooks/useFileStatusVerification.ts:66`
- **Evidence**: `verified.set('unknown', 'missing')` — the item's actual ID is not accessible in the `else` branch because it comes from the `result.reason` path of `allSettled`, which does not carry the value
- **Impact**: A rejected verification leaves the item stuck in `'checking'` state (falls through to `?? 'checking'` in the component), appearing available rather than missing. Low probability path but a silent failure when triggered.
- **Suggestion**: Wrap individual `verifyFileHandle` calls in try/catch to return `{ id, status: 'missing' }` on error, making the rejection path in `allSettled` unreachable.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 | Pass | Dark mode: badge white text on destructive red background passes. Filename text at `rgb(232,233,240)` on dark card background passes. |
| Keyboard navigation | Pass | Tab 1 lands on "Back to Courses" link. Disabled items have `tabIndex: -1` and are correctly skipped. |
| Focus indicators visible | Pass | Back to Courses link shows focus ring via Tailwind focus-visible utilities. |
| Heading hierarchy | Pass | Single H1 "File Detection Test Course" — appropriate for a detail page. |
| ARIA labels on icon buttons | Pass | `AlertTriangle` and `ShieldAlert` icons have `aria-hidden="true"`. Badge text provides the label. |
| Semantic HTML | Pass | `<ul>/<li>` for content list, `<Link>` for available items, `<div aria-disabled>` for unavailable items. |
| Form labels associated | N/A | No form inputs on this page. |
| `prefers-reduced-motion` | Pass | Global CSS handles this in `src/styles/index.css:306`. |
| `role="status"` on badges | Pass | All `FileStatusBadge` renders include `role="status"` for screen reader announcement. |
| Content list accessible label | Fail (Nitpick) | `<ul data-testid="course-content-list">` has no `aria-label`. Minor — does not block. |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass — No horizontal overflow. Item height 74px (exceeds 44px minimum). Badge wraps below filename as specified (`badgeTop > filenameTop + 5px` confirmed). No layout breakage.
- **Tablet (768px)**: Pass — No horizontal overflow. Items render at full width. Sidebar collapses to hamburger menu correctly. All badges visible.
- **Desktop (1440px)**: Pass — Content constrained to `max-w-3xl mx-auto` as coded. Badge inline with filename and duration. Layout matches story wireframe.

---

## Recommendations

1. **Fix the double-toast (High)** — Combine the `importedVideos` and `importedPdfs` DB queries into a single `Promise.all` in `ImportedCourseDetail.tsx` before setting state. This is a one-line change that eliminates the race condition entirely without restructuring the hook.

2. **Align PDF `permission-denied` path with video path (High)** — Replace `isMissing` with `isUnavailable` in the PDF rendering block (lines 157-183) to handle both `missing` and `permission-denied` consistently.

3. **Fix the settlement failure key bug (Medium)** — Wrap individual `verifyFileHandle` calls in try/catch within the `Promise.allSettled` map to ensure every item always gets a status entry.

4. **Add `aria-label` to the content list (Nitpick)** — `aria-label="Course content"` on the `<ul>` improves screen reader orientation on the page.
