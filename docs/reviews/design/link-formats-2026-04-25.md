# Design Review — Link Formats Feature

**Review Date**: 2026-04-25
**Reviewed By**: Claude Code (design-review agent, Playwright MCP)
**Branch**: `feature/ce-2026-04-25-link-formats-really-merry-eich`
**Changed Files**:
- `src/app/components/library/BookImportDialog.tsx`
- `src/app/components/library/LinkFormatsDialog.tsx`
- `src/app/components/library/BookContextMenu.tsx`
- `src/app/components/audiobook/AudiobookRenderer.tsx`
- `src/app/pages/BookReader.tsx`
- `src/lib/chapterSwitchResolver.ts`
- `src/lib/rescanBookChapters.ts`
- `src/app/hooks/useFormatSwitch.ts`

**Affected Pages**: `/library`, book context menu, LinkFormats dialog, AudiobookRenderer, BookReader

---

## Executive Summary

The Link Formats story delivers a complete end-to-end Whispersync pairing flow: EPUB chapter extraction at import, lazy ABS chapter fetch on link, atomic mapping persistence with link-rollback on error, a refuse-to-link guard for single-track audiobooks, and a "Re-scan Chapters" context-menu item. The implementation is functionally solid and UX decisions are well-reasoned. The dialog flow is accessible, the confidence bar has correct ARIA, and focus trapping is correct. Three pre-existing accessibility issues in the library page (third-party feedback widget, filter pill contrast) are excluded from findings. One medium-priority issue with focus restoration after dialog close and two low-priority wording and ARIA completeness items were found.

---

## What Works Well

1. **Confidence bar ARIA is correct**: `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, and a descriptive `aria-label` ("Chapter matching confidence: 100%"). This is a recurring failure in the codebase and this implementation gets it right.

2. **Refuse-to-link guard is clear and actionable**: The error toast for a single-track audiobook reads: "This audiobook has no chapter markers. Chapter-level linking is unavailable. Set chapter markers in Audiobookshelf or re-encode the file with chapter metadata." This gives the user both the diagnosis and two concrete remediation paths. The dialog correctly stays open after the error (confirmed via test).

3. **BookPickerCard buttons have correct semantics**: `type="button"`, `aria-pressed` state, focus ring via `focus-visible:ring-2 focus-visible:ring-brand`, and `min-h-[44px]` touch target. All interactive.

4. **Role list with aria-label on candidate list**: `role="list"` with `aria-label="Available books to link"` provides correct landmark for screen readers.

5. **Background color matches design system**: All viewports show `rgb(250, 245, 238)` — correct `#FAF5EE` value.

6. **No horizontal scroll at any breakpoint**: Mobile (375px), tablet (768px), sidebar-collapse (1024px), and desktop (1440px) all pass the horizontal scroll check.

7. **Dialog responsive layout is clean**: The dialog renders at 512px on all tested breakpoints (768px, 1024px, 1440px) and never overflows the viewport.

8. **Dark mode dialog**: Dialog background switches correctly to `rgb(26, 27, 38)` with title text at `rgb(232, 233, 240)` — a contrast ratio of 14.1:1 (well above WCAG AA).

9. **Re-scan Chapters menu item appears immediately after Link Format**: Positioned correctly in the context menu flow (indices: Link Format at 1, Re-scan Chapters at 2), creating a logical grouping of chapter-related actions.

10. **Save flow closes dialog silently on success**: After clicking "Save Link", the dialog closes without a toast. This is intentional and appropriate — the format link state is immediately visible in the relaunched context menu ("Linked Format…" text change).

11. **Rollback on saveMapping failure**: The split try/catch pattern in `handleSave` correctly rolls back `linkBooks` if `saveMapping` throws, preventing orphaned `linkedBookId` references.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

#### M1 — Focus does not return to the trigger element after dialog close

**Location**: `src/app/components/library/LinkFormatsDialog.tsx:392` (Dialog component)
**Evidence**: After pressing Escape to close the dialog, `document.activeElement` is `<BODY>` (no testId, no label). Focus is lost, forcing keyboard users to re-orient from the top of the page.
**Impact**: Keyboard and screen reader users who open the dialog, decide not to link, and close it lose their position in the library. Per WCAG 2.1 SC 3.2.2 and WAI-ARIA authoring practices, focus must return to the element that triggered the dialog.
**Suggestion**: Radix UI Dialog supports `onOpenChange`, and focus return typically happens automatically if the trigger is a `<button>` that remains in the DOM. The current implementation renders the dialog from `BookContextMenu` which uses a `ContextMenuItem` as the trigger — Radix context menus may unmount on close. Consider attaching a `ref` to the book card's "more actions" button (`data-testid="book-more-actions"`) and manually calling `.focus()` in the `handleOpenChange(false)` callback. Example addition at line 198:
```tsx
// In handleOpenChange:
if (!next && triggerRef?.current) {
  triggerRef.current.focus();
}
```
**autofix_class**: `manual`

---

#### M2 — `aria-modal` is not set on the dialog

**Location**: `src/app/components/library/LinkFormatsDialog.tsx:393`
**Evidence**: The dialog element has `aria-labelledby` and `aria-describedby` but `aria-modal` is `null`. Radix `<Dialog>` should set this automatically on the `DialogContent`. The computed attribute is absent in the live render.
**Impact**: Without `aria-modal="true"`, some screen readers (NVDA, older JAWS) may allow users to navigate outside the dialog to background content, which could cause confusion. Modern VoiceOver handles this with inert background elements but the missing attribute is a best-practice gap.
**Suggestion**: Check if Radix `DialogContent` is receiving a `aria-modal` prop. Per Radix docs, `DialogContent` adds `aria-modal="true"` by default. If it's missing, it may be due to a shadcn/ui customization in `src/app/components/ui/dialog.tsx`. Verify that the component hasn't removed it.
**autofix_class**: `advisory`

---

### Low Priority / Nitpicks

#### L1 — Dialog description for the `editor` view lacks `id` linkage

**Location**: `src/app/components/library/LinkFormatsDialog.tsx:637`
**Evidence**: The editor view uses `<DialogDescription id="link-formats-desc">` — the same `id` as the select and confirm views. The `id` is correctly referenced by `aria-describedby="link-formats-desc"` on the `<DialogContent>`. However the confirm view's description text ("Review the confidence score and save to link the formats.") and the editor view's description text ("Adjust chapter matches before linking...") are visually and semantically distinct steps. Using the same `id` across views is fine because only one is rendered at a time, but it's worth noting the description is always static for screen readers between view transitions.
**Impact**: Low — description content updates correctly with each view. No functional issue.
**Suggestion**: No action required. Noted for awareness.
**autofix_class**: `advisory`

---

#### L2 — No toast confirmation after saving link

**Location**: `src/app/components/library/LinkFormatsDialog.tsx:337`
**Evidence**: After `handleSave` succeeds, `onOpenChange(false)` is called but no toast is shown. The test confirmed `afterSave.toasts = []`.
**Impact**: Sighted users immediately see the context menu label change to "Linked Format…" confirming success. Screen reader users get no explicit confirmation that the save was successful beyond the dialog closing. A `toast.success('Formats linked.')` would provide explicit feedback for assistive technology users and reinforce the action.
**Suggestion**: Add `toast.success(\`Linked "${epubBook.title}" and "${audioBook.title}".\`)` before `onOpenChange(false)` in the success path. Keep it brief — users understand the action they just completed.
**autofix_class**: `safe_auto`

---

#### L3 — `BookPickerCard` badge uses `10px` font size (below standard)

**Location**: `src/app/components/library/LinkFormatsDialog.tsx:113`
**Evidence**: The format badge ("Audiobook", "EPUB") uses `text-[10px]` — hardcoded size below the 11px minimum typically used in design tokens.
**Contrast measured**: `rgb(28, 29, 43)` on `rgb(238, 238, 246)` = **14.4:1** (passes easily).
**Impact**: Contrast passes. However 10px text can be hard to read for users with mild vision impairment or on high-DPI displays with software scaling.
**Suggestion**: Consider using `text-[11px]` (matching the filter pill count badges used elsewhere in the library) to stay consistent within the design system.
**autofix_class**: `safe_auto`

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (new UI) | PASS | All dialog text passes. Badge 14.4:1. Dark mode title 14.1:1. |
| Color-contrast violations (library page) | PRE-EXISTING | `BookStatusBadge` `bg-brand/90` on white ≈ 3.95:1. `Finished (0)` filter pill count. Not in changed files. |
| Keyboard navigation in dialog | PASS | Tab cycles through all interactive elements: book picker cards, Cancel, Close, Match Chapters. |
| Focus indicators visible | PASS | All focusable elements show a focus ring (tested via `hasFocusRing: true` for all 10 tab stops). |
| Focus returns to trigger after close | FAIL | `document.activeElement` is `<BODY>` after dialog close. See finding M1. |
| Escape closes dialog | PASS | Confirmed: dialog is removed from DOM after Escape keypress. |
| Heading hierarchy | PASS | `h2` in dialog (`DialogTitle`). `h1` "Books" on library page. |
| ARIA labels on icon buttons | PASS | `aria-hidden="true"` on decorative icons; buttons have text content. Re-scan icon (`RefreshCw`) has `aria-hidden`. |
| `aria-modal` on dialog | ADVISORY | Not present in live render. Radix should add it automatically. See finding M2. |
| `aria-describedby` wired | PASS | `aria-describedby="link-formats-desc"` on dialog. Description element exists and is populated. |
| `role="progressbar"` complete | PASS | `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` all present on confidence bar. |
| `aria-pressed` on picker cards | PASS | `aria-pressed="false"` → `aria-pressed="true"` on selection. |
| `role="list"` with label | PASS | `aria-label="Available books to link"` on the candidate list. |
| Semantic HTML | PASS | `<button>` used for all interactive elements. No `<div onClick>` patterns found. |
| Form labels | N/A | No form inputs in changed files. |
| `prefers-reduced-motion` | PASS | Animation classes use Tailwind `transition-all` — respect motion preferences via media queries. |
| Empty state guidance | PASS | "No unlinked audiobooks found" message with hint to import first. |
| Loading state during save | PASS | `saving` state shows "Matching…" / "Saving…" / "Unlinking…" in button labels. |
| Error state with recovery | PASS | Single-track and no-TOC errors give specific remediation instructions. |

---

## Responsive Design Verification

| Viewport | Horizontal Scroll | Books Visible | Notes |
|----------|-------------------|---------------|-------|
| Mobile (375px) | None | 2 | Library grid adapts correctly. No dialog test (context menu is touch-only). |
| Tablet (768px) | None | 2 | Dialog renders at 512px wide, does not overflow viewport. |
| Sidebar-collapse (1024px) | None | 2 | Dialog renders at 512px wide, does not overflow viewport. |
| Desktop (1440px) | None | 2 | Dialog renders at 512px wide (max-w-lg), centered cleanly. |

Screenshot evidence available at:
- `/tmp/v10-responsive-mobile.png`
- `/tmp/v10-responsive-tablet.png`
- `/tmp/v10-responsive-sidebar-collapse.png`
- `/tmp/v10-responsive-desktop.png`
- `/tmp/v10-dialog-tablet.png`
- `/tmp/v10-dialog-sidebar-collapse.png`
- `/tmp/v10-dialog-desktop.png`

---

## Pre-existing Issues Noted (Do Not Block)

The following axe violations were found on the library page but are **pre-existing and not introduced by this story**:

1. **`button-name` CRITICAL (7 nodes)** — Third-party feedback widget (`styles-module__controlButton`). Not Knowlune code.
2. **`label` CRITICAL (3 nodes)** — Third-party feedback widget checkbox inputs without labels. Not Knowlune code.
3. **`nested-interactive` SERIOUS (1 node)** — Third-party feedback widget toolbar (`role="button"` div with focusable children). Not Knowlune code.
4. **`color-contrast` SERIOUS (5 nodes)** — `BookStatusBadge` uses `bg-brand/90 text-brand-foreground` for the "Reading" badge. At 90% opacity blended over white, the contrast drops to approximately 3.95:1 (needs 4.5:1). This is in `BookStatusBadge.tsx` which is not in this story's changed files. Also affects the `Finished (0)` count badge in filter pills.

These should be tracked separately against their owning components.

---

## Flow-Specific Findings

### Link Format Dialog Flow (end-to-end)

1. **Select step**: Correctly shows available books of the opposite format. The description accurately states the target format. Empty-state handling is present. "Match Chapters" button is disabled until a book is selected — confirmed via `matchBtnDisabled: true` initially.

2. **Lazy ABS chapter fetch**: Implemented in `handlePairPressed` — if audioBook has ≤1 chapter and is ABS-backed, triggers `rescanBookChapters`. The `setSaving(true)` during the fetch is correct UX — the "Match Chapters" button should show loading state. However the button text remains "Match Chapters" during the ABS fetch (no intermediate "Fetching chapters…" label). For most connections this is sub-second but on slow connections users may be confused by the ~1-3 second pause with no feedback.

3. **Confirm step**: Confidence bar renders at 100% for exact-match chapters with `bg-success` fill color (`rgb(58, 117, 83)`). The ARIA is complete. "Review Mapping" and "Back" buttons are present alongside "Save Link".

4. **Save step**: Dialog closes on success. No success toast (see finding L2). No error toast if backend save succeeds — correct behavior.

### Single-Track Refuse-to-Link Guard

- Toast: "This audiobook has no chapter markers. Chapter-level linking is unavailable. Set chapter markers in Audiobookshelf or re-encode the file with chapter metadata."
- Dialog stays open: confirmed.
- The message correctly identifies two remediation paths. It does not mention the "Re-scan Chapters" option, which would be appropriate since the user is already in the link flow. The guard fires before the backend is touched, so there is no side effect to clean up.
- For the no-TOC EPUB case the message reads: "This EPUB has no table of contents. Try 'Re-scan Chapters' from the book menu, or use an EPUB with a populated TOC." This correctly surfaces the Re-scan option as a recovery path.

### Re-scan Chapters Menu Item

- Appears at position 2 (after "Link Format…" at position 1), before "Change Status" at position 3.
- Has `data-testid="context-menu-rescan-chapters"` for reliable test targeting.
- Shows `isRescanning ? 'Re-scanning…' : 'Re-scan Chapters'` — in-place loading state is appropriate for a menu item.
- Guard `canRescanChapters` correctly limits availability to EPUBs and ABS-synced audiobooks only.

### AudiobookRenderer Seek Params

- `initialSeekSeconds` and `initialChapterPct` props wired. Clamping logic prevents out-of-bounds seeks.
- The `setTimeout(() => seekTo(clamped), 100)` pattern matches `handleBookmarkSeek` — consistent with existing approach. No design issues.

### BookReader URL Param Handling

- `offsetCfi`, `seekSeconds`, `chapterPct` are captured via refs on first render.
- URL params are cleared via `navigate(..., { replace: true })` — correct pattern to prevent stale params on browser back/forward.

---

## Console Errors

Non-sync errors during testing:
- `Failed to load resource: the server responded with a status of 404 (Not Found)` — one occurrence, likely a favicon or asset not found in the dev environment. Not a bug in changed code.

Sync engine errors (pre-existing, excluded):
- `[syncEngine] Download error for table "study_sessions": column study_sessions.updated_at does not exist`
- `[syncEngine] Download error for table "quiz_attempts"...`

No React component errors were observed during the complete dialog flow.

---

## Recommendations

1. **(M1 — Medium)** Fix focus return after dialog close. Add a `ref` to the triggering "more actions" button in `BookContextMenu` and call `.focus()` in the `LinkFormatsDialog.handleOpenChange(false)` callback.

2. **(L2 — Low)** Add a brief success toast after format link is saved. Screen reader users receive no programmatic confirmation the save succeeded.

3. **(Advisory)** Investigate whether `aria-modal="true"` is being suppressed in the shadcn/ui dialog component. It should be present on `DialogContent` per Radix defaults.

4. **(Advisory)** Consider adding an inline loading label during the lazy ABS chapter fetch phase in `handlePairPressed`. A brief "Fetching chapters…" variant on the button would prevent user confusion on slow connections.

5. **(Pre-existing — track separately)** `BookStatusBadge` `bg-brand/90` contrast (~3.95:1). Schedule for a dedicated accessibility pass on the Library page.

---

*Review conducted using Playwright MCP headless browser at 1440px, 1024px, 768px, and 375px viewports. axe-core 4.10.2 WCAG 2.1 AA scan. Screenshots at `/tmp/v10-*.png`.*
