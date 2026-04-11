# Adversarial Review — Epic 107: Fix Books/Library Core Bugs

**Date:** 2026-04-11
**Scope:** E107-S01 through E107-S07 (7 bug-fix stories in the Books/Library feature)
**Reviewer:** Adversarial Review Agent (bmad-review-adversarial-general)
**Tone:** Cynical and skeptical — assumes problems exist

---

## Summary

Epic 107 ships 7 bug fixes across cover image display (S01), EPUB rendering (S02), TOC loading (S03), About Book dialog (S04), reader theme sync (S05), mini-player interactivity (S06), and M4B cover preview (S07). The fixes are real and address genuine user-facing pain. However, the epic has structural gaps, architectural shortcuts, and testing holes that will resurface as future bugs.

**Total Findings: 14**
**Critical: 3 | High: 4 | Medium: 4 | Low: 3**

---

## Findings

### 1. [CRITICAL] `useBookCoverUrl` Creates N Separate Blob URLs for the Same File

Every consumer of `useBookCoverUrl` independently calls `opfsStorageService.getCoverUrl(bookId)` and owns its own blob URL lifecycle. When `AudiobookRenderer`, `AudioMiniPlayer`, `BookCard`, `BookListItem`, `AboutBookDialog`, and `LinkFormatsDialog` are all mounted simultaneously (entirely plausible in the library grid view while a book is playing), the same OPFS cover file is read and wrapped in N distinct blob URLs. Each is revoked on unmount — but if any component unmounts out of order or if a blob URL is revoked while another consumer is still using a different blob URL pointing to the same file, the browser must keep N file handles open simultaneously.

This is not a theoretical concern: `LinkFormatsDialog` alone calls `useBookCoverUrl` twice on two different books (lines 306–308). The correct solution is a ref-counted blob URL cache at the service layer, not per-component hook instances. The S01 fix created the hook correctly for a single consumer but never addressed the multi-consumer scenario that was predictably coming.

---

### 2. [CRITICAL] Silent Failure in `useBookCoverUrl` OPFS Resolution Masks Real Errors

```typescript
} catch {
  // silent-catch-ok: Resolution failed - show no cover (not an error condition)
  if (!isCancelled) setResolvedUrl(null)
}
```

The `silent-catch-ok` annotation is a lie. OPFS resolution failing is absolutely an error condition — it means the stored book file is gone, corrupted, or the storage service threw an unhandled exception. The hook discards the error entirely without logging, without surfacing to the user, and without any mechanism for the caller to distinguish "no cover was stored" from "cover exists but is unreadable." In a production environment, silent swallow of OPFS errors will lead to phantom bug reports where users see missing covers and have no recourse.

---

### 3. [CRITICAL] Inconsistent `onError` Strategy Between Components

`AudiobookRenderer` handles cover load failure by mutating `e.currentTarget.style.display = 'none'` — an inline style injection that bypasses React's reconciliation, leaves the fallback `<BookOpen>` icon hidden behind the now-invisible image element, and is explicitly banned by the project's `react-best-practices/no-inline-styles` ESLint rule. Meanwhile `AudioMiniPlayer` correctly uses a `coverError` state boolean and renders the fallback icon. `AboutBookDialog` has no `onError` handler at all on its cover `<img>` — if the resolved URL becomes stale (blob revoked by another component's unmount), the cover renders as a broken image with no fallback. Three components, three different (in)correct strategies for the same error condition. There is no shared `CoverImage` component enforcing consistent behavior.

---

### 4. [HIGH] TOC 5-Second Timeout Is Arbitrary and Not Configurable

The `isTocLoading` state in `BookReader.tsx` falls back to `false` after a hardcoded 5-second `setTimeout`. There is no justification for 5 seconds specifically. On slow devices or large EPUBs with deep TOC trees, 5 seconds may be insufficient and the user will see an empty TOC that silently failed. On fast devices, the spinner adds unnecessary visual noise for EPUBs that load in 100ms. There is no way for the timeout duration to vary by file size, device capability, or user preference. The timeout is also reset on book change (`setIsTocLoading(true)`) but the previous timeout is not cancelled before the new one starts — a race condition where navigating quickly between two books could trigger double-reset of `isTocLoading`.

---

### 5. [HIGH] No Regression E2E Tests for S02 (EPUB Rendering) and S03 (TOC Loading)

Stories S01, S05, and S06 have regression specs in `tests/e2e/regression/`. S02 (EPUB rendering — the most visually complex fix involving ResizeObserver, spread layout, and interaction zones) and S03 (TOC loading and timeout fallback) have no regression spec. Unit tests exist for these components, but unit tests mock the EPUB view entirely and cannot catch real rendering regressions in a browser. S04 has only an active spec (`story-e107-s04.spec.ts`), not a regression spec — it will be deleted when the story is archived. S07 (M4B cover preview) has no test of any kind at the E2E layer.

---

### 6. [HIGH] `readerThemeConfig.ts` Hardcodes Hex Values That Diverge From `theme.css`

The `THEME_COLORS` map in `readerThemeConfig.ts` contains hardcoded hex strings (`#faf5ee`, `#1a1b26`, `#f4ecd8`, etc.) copied from `theme.css`. These are now two sources of truth. If a designer updates the Professional background from `#faf5ee` to any other value in `theme.css`, the EPUB reader will silently render with the old background — there is no compile-time or runtime check that these stay in sync. The doc comment says "Values sourced from CSS custom properties in theme.css" but there is no mechanism to enforce or verify this claim. This is a maintenance landmine disguised as a design feature.

---

### 7. [HIGH] `AboutBookDialog` Has No `onError` Handler and No Loading State for Cover

The `AboutBookDialog` renders a cover `<img>` without an `onError` handler. If `resolvedCoverUrl` is non-null but the blob has since been revoked (e.g., by `BookCard` unmounting), the dialog displays a broken image icon — the native browser broken-image glyph, not the designed `<BookOpen>` fallback. Additionally, the dialog has no loading state: the cover area is empty while `useBookCoverUrl` is resolving asynchronously, causing a layout shift. For large OPFS files, this is noticeable. The S04 implementation treats the async cover resolution as instantaneous, which it is not.

---

### 8. [MEDIUM] M4B Cover Preview (S07) Leaks if Import Is Cancelled Mid-Flow

The `AudiobookImportFlow` creates a blob URL for the M4B cover preview via `URL.createObjectURL(m4bParsed.coverBlob)` in a `useEffect`. The cleanup revokes the URL when `m4bParsed` changes or the component unmounts. However, if the user cancels the import after the M4B is parsed (calling `onCancel`), the component unmounts and the effect cleanup runs — which is correct. But if the component is remounted (e.g., the dialog is closed and immediately reopened) before the previous async OPFS write completes, the `bookId` embedded in `m4bParsed` is stale and a new one is generated, potentially leaving an orphaned OPFS cover file that the new import will never clean up.

---

### 9. [MEDIUM] `AudiobookRenderer` Artwork URL Protocol Guard Is Redundant and Fragile

```typescript
artworkUrl:
  resolvedCoverUrl && /^(blob:|https?:|data:image\/)/.test(resolvedCoverUrl)
    ? resolvedCoverUrl
    : undefined,
```

`useBookCoverUrl` already guarantees that its return value is either `null`, a `blob:` URL, an `https?:` URL, or a `data:image/` URL — the protocol guard in `useBookCoverUrl` rejects everything else. This redundant check suggests the author did not trust the hook's own contract, which either means the hook's contract is unclear or the check was cargo-culted. If someone changes the hook to return a different URL type, this check will silently discard it. The duplication is tech debt.

---

### 10. [MEDIUM] `ReaderHeader` Chapter Fallback Uses Progress Percentage as a Chapter Name

When `currentChapter` is undefined, `ReaderHeader` displays the reading progress as a percentage in the position normally occupied by the chapter name. This is semantically wrong — the chapter name slot is displaying a progress metric. A user who opens a book with no TOC sees "42%" where they expect a chapter title. The correct fallback is "No chapters" or "Chapter 1" — a label, not a number. This was supposedly fixed in S03 but the fallback behavior remains confusing.

---

### 11. [MEDIUM] `useBookCoverUrl` Does Not Handle `bookId` Being an Empty String

In `AudioMiniPlayer`, `useBookCoverUrl` is called with:
```typescript
bookId: currentBookId ?? '',
```
When `currentBookId` is null, `bookId` is an empty string. The hook's `useEffect` depends on `[bookId, coverUrl]`. If `coverUrl` is also undefined (which it will be when `currentBookId` is null), the hook short-circuits and returns `null` — correct. But if `coverUrl` is somehow non-null when `currentBookId` is null (a bug scenario), the hook calls `opfsStorageService.getCoverUrl('')` with an empty string ID. The service's behavior with an empty string ID is unspecified and likely returns garbage. The hook should validate that `bookId` is a non-empty string before attempting resolution.

---

### 12. [LOW] `AboutBookDialog` Renders Format Twice in the Same View

The `AboutBookDialog` renders the book format in two places: as a `<Badge>` under the title in the cover section, and again as a row in the Metadata grid. If the format is "epub", the user sees "EPUB" badge and "EPUB" metadata row. This is pure redundancy that wastes vertical space in a dialog that is already constrained to `max-w-md`. The metadata grid row adds no value that the badge doesn't already communicate.

---

### 13. [LOW] Stale Closure Comment Is Misleading

The comment on `handlePlayPause` in `AudioMiniPlayer` reads:

```typescript
// E107-S06: Read isPlaying from store.getState() to avoid stale closure
```

This is accurate for why `getState()` is used inside the callback, but the `isPlaying` subscription is retained at the component level for "render (icon + aria-label)" — a distinction documented in a separate comment above. Two comments for the same variable's dual purpose increases cognitive load and is evidence that the underlying architecture (subscribing to the same store key twice with different access patterns) is awkward. The correct fix is a Zustand selector pattern that colocates the two usages, not two comment blocks explaining why the code is split.

---

### 14. [LOW] No Accessibility Test for Mini-Player Focus Styles Added in S06

S06 adds `focus-visible:ring-2 focus-visible:ring-ring` to six buttons in `AudioMiniPlayer`. There is no automated accessibility test (axe, or Playwright `expect(element).toHaveAccessibleName()`) that verifies these focus indicators appear correctly. The regression spec (`story-e107-s06.spec.ts`) tests interactivity but not keyboard navigation or focus ring visibility. This is particularly ironic given that the entire point of S06 was to fix interactivity — the gap is in the very area being fixed.

---

## Verdict

The seven stories in Epic 107 are not embarrassing individually, but collectively they reveal a pattern: **each story fixes one visible symptom without addressing the systemic cause.** Cover image display was broken in four different ways because there was no shared, tested cover image component — and there still isn't one. EPUB rendering had multiple bugs because epub.js integration lacked integration tests — and it still does at the E2E layer for S02. The mini-player had stale closure bugs because the audio player store is accessed inconsistently — and the fix papers over the inconsistency with a `getState()` call instead of a clean store API.

The technical debt introduced by the hook-per-consumer blob URL pattern (Finding 1) will compound as the Books feature grows. A cover image cache at the service layer, and a shared `<CoverImage>` component with consistent error handling, should be the first priorities in the next epic touching the Books feature.
