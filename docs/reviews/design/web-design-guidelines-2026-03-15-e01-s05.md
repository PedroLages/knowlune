# Web Design Guidelines Review: E01-S05 — Detect Missing or Relocated Files

**Review Date**: 2026-03-15
**Reviewed By**: Claude Opus 4.6 (web design guidelines compliance)
**Story**: E01-S05 "Detect Missing or Relocated Files"
**Branch**: `feature/e01-s05-detect-missing-relocated-files`

## Executive Summary

The implementation is solid overall, with good use of design tokens, proper ARIA attributes on badges, and well-structured semantic HTML. Two HIGH findings relate to the "checking" state lacking any visual indicator and the destructive badge using a hardcoded `text-white` instead of `text-destructive-foreground`. Several MEDIUM findings address missing screen reader announcements, touch target compliance, and a potential color contrast concern in dark mode. No blockers found.

## What Works Well

1. **Design token compliance**: Badge colors use `bg-destructive`, `bg-warning`, `text-warning-foreground` — proper token usage throughout. No hardcoded Tailwind color classes (e.g., `bg-red-500`) detected.
2. **ARIA attributes**: `role="status"` on status badges enables live region semantics. `aria-hidden="true"` on decorative icons (Video, FileText, AlertTriangle, ShieldAlert). `aria-disabled="true"` on unavailable items. `aria-label="Course content"` on the content list.
3. **Semantic HTML**: Uses `<ul>` / `<li>` for the content list. Uses `<Link>` for navigable items and `<div>` for disabled items (correct pattern — disabled items should not be links).
4. **Progressive enhancement — error handling**: `verifyFileHandle()` catches exceptions and falls back to `'missing'`. `Promise.allSettled` ensures one failed handle does not block others. The `ignore` flag prevents state updates after unmount.
5. **Toast aggregation**: Single toast for all affected files prevents notification flooding. Uses `TOAST_DURATION.LONG` (8s) for error-like notifications — exceeds WCAG 2.2.1 minimum of 3s.
6. **Cleanup pattern**: Both the page component and the hook use `ignore` flags to prevent stale state updates — correct React async cleanup.

## Findings

### BLOCKER

None.

### HIGH

**H1. "Checking" state has no visual indicator** (UX, progressive enhancement)

When `fileStatuses.get(video.id)` returns `'checking'` (the initial state while verification is in-flight), no badge or loading indicator is rendered. The `FileStatusBadge` component returns `null` for any status other than `'missing'` or `'permission-denied'`. Users see a brief flash where items appear fully functional before suddenly becoming disabled.

- **Location**: `src/app/pages/ImportedCourseDetail.tsx:18-40` (FileStatusBadge) and lines 112-113
- **Impact**: Items are rendered as clickable links during the checking phase. A user could click a link to a file that is about to be marked as missing.
- **Recommendation**: Add a "Checking..." skeleton state or a subtle spinner badge while status is `'checking'`. Alternatively, render items as non-interactive until verification completes.

**H2. Destructive badge uses hardcoded `text-white` instead of `text-destructive-foreground`**

The Badge component's `destructive` variant in `badge.tsx:16` uses `text-white` instead of `text-destructive-foreground`. In dark mode, `--destructive-foreground` is `#fce8e9` (a warm tint) rather than pure white. While the visual difference is minimal, this bypasses the design token system and would not respond to future theme changes.

- **Location**: `src/app/components/ui/badge.tsx:16`
- **Impact**: Low visual impact today, but violates the project's strict design token policy. The ESLint rule `design-tokens/no-hardcoded-colors` should flag this if it checks for `text-white`.
- **Recommendation**: Replace `text-white` with `text-destructive-foreground` in the badge variant definition.

### MEDIUM

**M1. No `aria-live` region for status transitions** (Accessibility)

When file verification completes and items transition from available-looking to disabled with a "File not found" badge, screen reader users receive no announcement beyond the toast. The `role="status"` on individual badges creates implicit `aria-live="polite"` regions, but these are conditionally rendered (not in the DOM initially), so the transition from absent to present may not be reliably announced by all screen readers.

- **Location**: `src/app/pages/ImportedCourseDetail.tsx:21, 30`
- **Impact**: Screen reader users may not notice that items they were about to interact with have become unavailable.
- **Recommendation**: Wrap the badge area in a persistent container with `aria-live="polite"` so the status text is announced when it appears. Example: `<span aria-live="polite">{badge}</span>`.

**M2. Warning badge color contrast in light mode may be insufficient**

The warning badge uses `bg-warning text-warning-foreground`. In light mode: `--warning: #c49245` (background) and `--warning-foreground: #ffffff` (text). The contrast ratio of white text on a golden background calculates to approximately 2.7:1, which fails WCAG AA for small text (requires 4.5:1).

- **Location**: `src/app/pages/ImportedCourseDetail.tsx:30`, `src/styles/theme.css:64-65`
- **Impact**: "Permission needed" badge text may be unreadable for users with low vision in light mode.
- **Recommendation**: Verify with a contrast checker tool. If failing, darken `--warning` to approximately `#9a7530` or switch to `--warning-foreground: #1c1d2b` (dark text on gold) in light mode.

**M3. Touch target size for disabled items**

The disabled items use `p-4` (16px padding) on all sides, giving a total height that depends on content. With `text-sm` (14px) content plus padding, the item height is approximately 46px — likely meeting the 44x44px minimum. However, the badge itself (`px-2 py-0.5`, yielding ~24px height) is not independently tappable, which is fine since it is informational, not interactive. This is acceptable but worth verifying on actual mobile devices.

- **Location**: `src/app/pages/ImportedCourseDetail.tsx:148, 173`
- **Impact**: Low risk — the list items themselves meet the target size.
- **Recommendation**: No action required; verify during manual QA.

**M4. PDF items are always disabled with no explanation**

All PDF items render with `aria-disabled="true"` and `cursor-not-allowed` regardless of file status (lines 171-199). Available PDFs get `opacity-75` while unavailable ones get `opacity-50`. There is no tooltip or text explaining why available PDFs cannot be opened.

- **Location**: `src/app/pages/ImportedCourseDetail.tsx:170-201`
- **Impact**: Users may not understand why they cannot open a PDF that shows no error badge. This is a UX clarity issue.
- **Recommendation**: Add a tooltip or inline text like "PDF viewer coming soon" for available PDFs, or use a distinct visual treatment that communicates "not yet supported" vs "file missing."

### LOW

**L1. No `flex-wrap` on item content when viewport is narrow**

The item content uses `flex items-center gap-3` without `flex-wrap`. On very narrow viewports (< 320px), the filename, badge, and duration/page-count could overflow or cause horizontal scrolling.

- **Location**: `src/app/pages/ImportedCourseDetail.tsx:148, 156`
- **Impact**: Edge case on extremely narrow screens.
- **Recommendation**: Add `flex-wrap` or ensure filenames truncate with `truncate` (which adds `overflow-hidden text-ellipsis whitespace-nowrap`) on the filename span.

**L2. Filename span lacks text truncation**

Long filenames (e.g., "Lecture 12 - Advanced Topics in Machine Learning Part 2 - Final Version.mp4") will push badges and duration off-screen or cause layout overflow.

- **Location**: `src/app/pages/ImportedCourseDetail.tsx:126-134, 188-190`
- **Impact**: Layout breakage with long filenames.
- **Recommendation**: Add `truncate` class to the filename `<span>` elements. Note: `flex-1` helps but does not guarantee truncation without `min-w-0` and `truncate`.

**L3. Console warning on verification failure could be more structured**

`console.warn('File handle verification failed:', error)` in `fileVerification.ts:27` is fine for development but provides no structured data for error monitoring.

- **Location**: `src/lib/fileVerification.ts:27`
- **Impact**: Negligible — development-only concern.
- **Recommendation**: No action needed for current scope.

**L4. Empty state message could be more helpful**

"No content found in this course." does not suggest any action. For an imported course, this could mean the import failed partially.

- **Location**: `src/app/pages/ImportedCourseDetail.tsx:204-208`
- **Impact**: Minor UX clarity.
- **Recommendation**: Consider "No content found. Try re-importing this course." with a link/action.

## Accessibility Audit Summary

| Criterion | Status | Notes |
|-----------|--------|-------|
| WCAG 2.1 AA Color Contrast | WARN | Warning badge light mode needs verification (M2) |
| Keyboard Navigation | PASS | Links are focusable; disabled divs correctly have `aria-disabled` and are not in tab order |
| Screen Reader Support | WARN | Status transitions may not be announced (M1) |
| Focus Indicators | PASS | Global `*:focus-visible` style applies via `theme.css` |
| ARIA Usage | PASS | `role="status"`, `aria-disabled`, `aria-hidden`, `aria-label` all correctly applied |
| Touch Targets | PASS | List items meet 44x44px minimum (M3 — verify) |
| Motion/Animation | PASS | No motion concerns — `transition-colors` is subtle |
| Semantic HTML | PASS | `ul/li` structure, proper heading hierarchy |

## Design Token Compliance

| Element | Token Used | Correct? |
|---------|-----------|----------|
| Destructive badge bg | `bg-destructive` (via variant) | Yes |
| Destructive badge text | `text-white` (hardcoded in badge.tsx) | No (H2) |
| Warning badge bg | `bg-warning` | Yes |
| Warning badge text | `text-warning-foreground` | Yes |
| Icon color (available) | `text-brand` | Yes |
| Icon color (unavailable) | `text-muted-foreground` | Yes |
| Card background | `bg-card` | Yes |
| Hover state | `hover:bg-accent` | Yes |
| Muted text | `text-muted-foreground` | Yes |
| Back link | `text-brand` | Yes |

## Responsive Design

| Viewport | Status | Notes |
|----------|--------|-------|
| Desktop (1024px+) | PASS | `max-w-3xl mx-auto` centers content cleanly |
| Tablet (640-1023px) | PASS | Single column layout works well |
| Mobile (< 640px) | WARN | Long filenames may overflow without truncation (L1, L2) |

## Summary of Findings

| Severity | Count | Key Issues |
|----------|-------|------------|
| BLOCKER | 0 | — |
| HIGH | 2 | Missing "checking" state indicator; hardcoded `text-white` in badge |
| MEDIUM | 4 | Screen reader announcements; warning contrast; touch targets; PDF disabled UX |
| LOW | 4 | Text truncation; narrow viewport overflow; console warning; empty state |

## Recommended Priority

1. **H1** — Add loading/checking state (prevents users clicking links to missing files)
2. **H2** — Fix `text-white` to `text-destructive-foreground` in badge variant
3. **M2** — Verify warning badge contrast ratio with a tool; fix if failing
4. **M1** — Add `aria-live` wrapper for status badge area
5. **M4** — Add explanatory text for disabled-but-available PDFs
6. **L2** — Add `truncate` + `min-w-0` to filename spans
