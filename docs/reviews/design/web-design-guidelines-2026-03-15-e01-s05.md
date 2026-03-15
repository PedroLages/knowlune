# Web Design Guidelines Review: E01-S05

## Summary

Story E01-S05 adds file status detection for imported course content, displaying badges when files are missing or need re-authorization. The implementation is well-structured with proper accessibility foundations (ARIA attributes, screen reader support, semantic HTML). Six findings identified: one HIGH related to missing visual feedback during the "checking" state, and five MEDIUM/LOW items covering opacity spec deviation, keyboard focus visibility, flex-wrap for narrow viewports, error handling in the hook, and the permission-denied interaction gap.

## Findings

### HIGH: No visual indication during "checking" state

- **Confidence**: 90
- **File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/pages/ImportedCourseDetail.tsx:108`
- **Description**: When `fileStatuses.get(video.id)` returns `'checking'` (the initial state before verification completes), the item renders as a fully clickable link with no loading indicator. The user could click a link to a lesson whose file is actually missing, leading to a confusing error downstream. The `FileStatusBadge` component returns `null` for `'checking'`, so there is zero visual feedback that verification is in progress.
- **Recommendation**: Add a subtle loading indicator (e.g., a `Loader2` spinner icon or a pulsing dot) inside `FileStatusBadge` for the `'checking'` state. Alternatively, disable navigation until verification completes by rendering all items as non-interactive `div` elements during the checking phase.

### MEDIUM: Permission-denied video items missing clickable re-permission interaction

- **Confidence**: 85
- **File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/pages/ImportedCourseDetail.tsx:109,136-141`
- **Description**: The story design guidance specifies that "Permission denied" items should be "Clickable -- triggers re-permission prompt" with opacity 0.65. However, the implementation treats `permission-denied` identically to `missing` via `isUnavailable`, rendering both as a non-clickable `div` with `cursor-not-allowed` and `opacity-50`. This means users cannot re-authorize file access from the UI.
- **Recommendation**: Separate the `permission-denied` case from `missing`. Render permission-denied items as a `<button>` (not a link or div) that calls `handle.requestPermission({ mode: 'read' })` on click. Use `opacity-65` (or the closest Tailwind equivalent, `opacity-[0.65]`) and a pointer cursor instead of `cursor-not-allowed`.

### MEDIUM: No flex-wrap on content item rows for narrow viewports

- **Confidence**: 75
- **File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/pages/ImportedCourseDetail.tsx:138,146`
- **Description**: The story's responsive design guidance states "Badge wraps below filename on very narrow viewports (flex-wrap)." The content item rows use `flex items-center gap-3` without `flex-wrap`, which means on very narrow screens the badge text and duration/page count will be squeezed or overflow rather than wrapping gracefully.
- **Recommendation**: Add `flex-wrap` to the content row containers. Consider using `flex-wrap` on the inner content fragment's parent elements so the badge and metadata can wrap below the filename on screens narrower than ~360px.

### MEDIUM: Promise.allSettled rejection branch loses item identity

- **Confidence**: 80
- **File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/hooks/useFileStatusVerification.ts:64-67`
- **Description**: In the `Promise.allSettled` rejection handler, the code sets `verified.set('unknown', 'missing')`. This loses the association with the actual item ID, meaning: (1) the item that failed verification will not appear in the status map at all (still shows "checking" forever), and (2) if multiple items reject, they all overwrite the same `'unknown'` key. This is a progressive enhancement concern -- the UI would show a perpetually indeterminate state for those items.
- **Recommendation**: Use `items[index]` to recover the item ID in the rejection branch. `Promise.allSettled` preserves ordering, so `results.forEach((result, index) => ...)` allows `items[index].id` as the fallback key.

### LOW: Missing focus-visible outline on unavailable (disabled) content items

- **Confidence**: 70
- **File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/pages/ImportedCourseDetail.tsx:137-141`
- **Description**: Unavailable content items render as `<div aria-disabled="true">` which is not focusable via keyboard. While these items are intentionally non-interactive, screen reader users navigating by list items (`<li>`) may encounter these items without any indication they are disabled beyond the badge text. The `aria-disabled` on a `div` does not prevent focus or convey disabled state to all assistive technologies the way a native `<button disabled>` would.
- **Recommendation**: This is acceptable for the current implementation since the `role="status"` on the badge provides the key information. For enhanced accessibility, consider adding `role="group"` and `aria-label="[filename] - file not found"` to the disabled container so screen readers announce the full context when navigating by list.

### LOW: Opacity-50 used for both missing videos and missing PDFs, deviating from design spec

- **Confidence**: 65
- **File**: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/pages/ImportedCourseDetail.tsx:138,162`
- **Description**: The design guidance specifies opacity 0.5 for "Missing" state and opacity 0.65 for "Permission denied" state. The implementation uses `opacity-50` for missing (correct) but also uses `opacity-50` for missing videos via `isUnavailable` which groups both states. PDFs already had `opacity-75` as a baseline. The distinction between missing and permission-denied opacity is lost for video items.
- **Recommendation**: When the permission-denied interaction is separated (see MEDIUM finding above), ensure video items with `permission-denied` use `opacity-[0.65]` per the design spec, while `missing` retains `opacity-50`.

## Verdict

**PASS with recommendations** -- The implementation has solid accessibility foundations (ARIA attributes, `role="status"` badges, `aria-hidden` on decorative icons, `aria-disabled` on non-interactive items, semantic `<ul>`/`<li>` list structure, design token usage). The HIGH finding about the checking state is a UX gap but not a functional blocker since verification typically completes in milliseconds for local file handles. The two MEDIUM findings about permission-denied interaction and flex-wrap should be addressed before shipping to match the story's design specification. The Promise.allSettled bug (MEDIUM) should be fixed as it could cause permanent "checking" states for edge-case failures.
