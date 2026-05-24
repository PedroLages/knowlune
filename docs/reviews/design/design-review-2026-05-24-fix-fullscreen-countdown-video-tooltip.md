## Design Review Report

**Review Date**: 2026-05-24
**Reviewed By**: design-review-dispatcher (Playwright MCP)
**Scope**: 6a7d8267..HEAD
**Changed Files**:
- `src/app/components/figma/VideoPlayer.tsx`
- `src/app/components/figma/PdfViewer/usePdfViewerState.ts`
- `src/app/hooks/useCompletionFlow.ts`
- `src/lib/fullscreen.ts` (new)
**Affected Routes**: `/courses/*/lessons/*`, `/lesson/:id`

### Executive Summary

This diff addresses two related UX issues: (1) removing the browser-native `title` tooltip from the `<video>` element so it no longer blocks the video viewport, and (2) exiting fullscreen before showing the completion celebration modal and auto-advance countdown overlay. Both changes are sound and introduce no regressions.

### Findings by Severity

#### Blockers (Must fix before merge)
None found.

#### High Priority (Should fix before merge)
None found.

#### Medium Priority (Fix when possible)
None found.

#### Nitpicks (Optional)

1. **Missing `title` attribute on `<video>` may affect some assistive-tech edge cases**
   - **Issue**: The `title` attribute on the `<video>` element was removed. While it was duplicated by the container's `aria-label` for screen readers, some older assistive-tech or media queries read the `<video>` element's `title` attribute directly. The container ARIA label is the correct primary mechanism, but adding `aria-label` directly to the `<video>` element (matching the container) would provide defense-in-depth without re-introducing the browser tooltip.
   - **Location**: `src/app/components/figma/VideoPlayer.tsx:972`
   - **Severity**: Nitpick
   - **Suggested fix**: Add `aria-label={title || 'Video player'}` to the `<video>` element as a direct attribute (this does not trigger the native tooltip — only the `title` attribute does).

2. **`exitFullscreenIfActive` doc comment uses past-tense examples**
   - **Location**: `src/lib/fullscreen.ts:7-10`
   - **Severity**: Nitpick
   - **Suggested fix**: Minor: the JSDoc can be cleaned up to remove redundant "e.g." examples, e.g. the second example sentence is repetitive of the first.

### What Works Well

1. **Correct approach for tooltip removal**: Removing the `title` attribute from `<video>` eliminates the native browser tooltip that blocked the video content on hover, while preserving the semantic label via `aria-label` on the container region. This is the right pattern.
2. **Safe fullscreen exit utility**: The `exitFullscreenIfActive()` function properly guards against redundant calls with `document.fullscreenElement` check and catches DOM exceptions. Clean API.
3. **Fullscreen exit before celebration**: In `useCompletionFlow.ts`, calling `exitFullscreenIfActive()` before showing the celebration modal and auto-advance countdown correctly addresses the issue where these overlays were hidden behind the fullscreen video.
4. **Minimal change surface**: The diff is tightly scoped and does exactly what it sets out to do — no unnecessary refactoring.

### Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >=4.5:1 | Pass | No color changes in this diff |
| Keyboard navigation | Pass | Video player controls remain keyboard accessible |
| Focus indicators visible | Pass | No focus style changes |
| Heading hierarchy | Pass | No heading changes |
| ARIA labels on icon buttons | Pass | No changes to button ARIA labels |
| Semantic HTML | Pass | `<video>` element correctly used; `role="region"` on container with `aria-label` |
| Form labels associated | N/A | No form changes |
| prefers-reduced-motion | Pass | No animation changes |

### Responsive Design Verification

- **Mobile (375px)**: Pass (courses page renders correctly; mobile bottom nav appears)
- **Tablet (768px)**: Pass (layout reflows correctly)
- **Desktop (1440px)**: Pass (full layout with sidebar)

**Note**: Pre-existing horizontal overflow on mobile (scrollWidth 1278 > clientWidth 375) is caused by the sidebar and is not introduced by this diff.

### Console Errors

No console errors introduced by this diff. Pre-existing Supabase sync errors (`quiz_attempts` and `ai_usage_events` columns not found) are unrelated backend issues.

### Recommendations

1. Consider adding `aria-label` directly to the `<video>` element for defense-in-depth (currently only on the container `<div>`).
2. Ship as-is — the changes are clean, minimal, and correctly target the described UX issues.

### Screenshots

- Desktop 1440px (courses): `desktop-1440-courses.png`
- Tablet 768px (courses): `tablet-768-courses.png`
- Mobile 375px (courses): `mobile-375-courses.png`
- Desktop 1440px (lesson player): `desktop-1440-lesson-player.png`
