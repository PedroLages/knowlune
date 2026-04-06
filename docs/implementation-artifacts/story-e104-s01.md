---
story_id: E104-S01
story_name: "Link Formats Dialog — Book Pairing Entry Point"
status: done
started: 2026-04-06
completed: 2026-04-06
reviewed: true
review_started: 2026-04-06
review_scope: full
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, glm-code-review, openai-code-review-skipped]
burn_in_validated: false
---

# Story E104-S01: Link Formats Dialog — Book Pairing Entry Point

## Story

As a reader with both an EPUB and audiobook edition of the same title,
I want to link them together via a "Link Format" dialog from any book's context menu,
so that Whispersync (format-switching with position sync) becomes reachable for that pair.

## Acceptance Criteria

- AC1: From any book's context menu / detail view, the user can tap "Link Format" to open the pairing dialog
- AC2: The dialog shows unlinked EPUBs and unlinked audiobooks as selectable targets (already-linked books excluded)
- AC3: On pairing, `computeChapterMapping()` runs and shows a confidence score
- AC4: Low-confidence mappings (<0.85) open `ChapterMappingEditor` for manual review before saving
- AC5: High-confidence mappings (≥0.85) auto-save after a confirmation step
- AC6: Once linked, both books show "Also available as [Audiobook/EPUB]" badge (already implemented in E103-S03 — activated by `linkedBookId`)
- AC7: Unlinking is possible from the same dialog (for already-linked books)

## Tasks / Subtasks

- [x] Task 1: Add `unlinkBooks` action to `useBookStore` (AC7)
  - [x] 1.1 Optimistic update: clear `linkedBookId` on both books
  - [x] 1.2 Atomic Dexie transaction: unset field on both records
  - [x] 1.3 Rollback on failure with `toast.error`

- [x] Task 2: Create `LinkFormatsDialog` component (AC1–AC7)
  - [x] 2.1 Dialog wrapper using shadcn/ui Dialog
  - [x] 2.2 Target book selector (filtered to compatible unlinked books)
  - [x] 2.3 Run `computeChapterMapping` and show confidence score
  - [x] 2.4 High-confidence path: confirmation + auto-save
  - [x] 2.5 Low-confidence path: show `ChapterMappingEditor`
  - [x] 2.6 Unlink path for already-linked books
  - [x] 2.7 Keyboard nav, focus trap, ARIA labels

- [x] Task 3: Add "Link Format" / "Unlink Format" to `BookContextMenu` (AC1)
  - [x] 3.1 Add to ContextMenu (desktop right-click)
  - [x] 3.2 Add to DropdownMenu (mobile "..." button)
  - [x] 3.3 Mount `LinkFormatsDialog` in context menu tree

## Design Guidance

- Dialog: `max-w-lg`, centered, scrollable content area
- Book selector: card-style options with cover thumbnail, title, author
- Confidence meter: progress bar with color coding (green ≥0.85, yellow 0.7–0.84, red <0.7)
- Use design tokens exclusively — no hardcoded colors
- Touch targets ≥44px on all interactive elements
- Focus trap inside dialog (shadcn/ui Dialog handles this)

## Implementation Notes

- `LinkFormatsDialog` receives `book` (the initiating book) as prop
- Filters candidate books: opposite format (epub↔audiobook), not already linked
- `computeChapterMapping` converts `Book.chapters` → `EpubChapterInput[]` / `AudioChapterInput[]`
- Confidence threshold for auto-save: 0.85 (above `DEFAULT_CONFIDENCE_THRESHOLD` of 0.70)
- `unlinkBooks` mirrors `linkBooks` pattern (optimistic + atomic tx + rollback)

## Testing Notes

- Unit tests for `unlinkBooks` action
- Unit tests for `LinkFormatsDialog`: renders correct candidate list, hides already-linked books
- E2E: context menu → dialog → link flow (happy path, high confidence)

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] Type guards on all dynamic lookups
- [ ] At every non-obvious code site, add `// Intentional: <reason>` comment
- [ ] For every async callback that reads Zustand state: reads from `get()` inside callback

## Design Review Feedback

_(pending)_

## Code Review Feedback

_(pending)_

## Challenges and Lessons Learned

- **Chapter mapping integration**: Converting `Book.chapters` to the `EpubChapterInput[]` / `AudioChapterInput[]` types required by `computeChapterMapping()` needed careful type guards, since chapters from IndexedDB may have missing or undefined fields. Defensive fallbacks for `title` and `lengthMs` prevent runtime errors.
- **Optimistic unlink pattern**: The `unlinkBooks` action mirrors `linkBooks` with optimistic UI update + atomic Dexie transaction + rollback on failure. Keeping both actions structurally identical reduces cognitive overhead when debugging sync issues.
- **Confidence threshold UX**: Two thresholds coexist — `DEFAULT_CONFIDENCE_THRESHOLD` (0.70, from chapterMatcher) and the auto-save threshold (0.85). The dialog uses 0.85 as the gate for skipping manual review, which is intentionally stricter than the matcher's minimum. This distinction should be documented in the component for future maintainers.
- **Context menu mounting**: `LinkFormatsDialog` is mounted inside `BookContextMenu` to share the same book reference. This avoids prop-drilling through layout but means the dialog state resets when the context menu closes — addressed by keeping dialog open state independent of menu open state.
