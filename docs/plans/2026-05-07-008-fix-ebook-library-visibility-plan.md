---
title: "fix: Complete ebook library visibility — update Library.tsx upstream defaults"
type: fix
status: active
date: 2026-05-07
origin: docs/brainstorms/2026-05-07-ebook-library-visibility-requirements.md
related: docs/plans/2026-05-07-006-feat-ebook-library-visibility-plan.md
---

# fix: Complete Ebook Library Visibility — Update Library.tsx Upstream Defaults

## Overview

Plan 006/commit 262aa741 added `'all'` mode to `LibraryMediaShelfColumn` and `LibraryFormatModeTabs`, but the upstream logic in `Library.tsx` was never updated. Three code paths still force audiobooks-only behavior, making the `'all'` mode unreachable. This plan fixes those three paths.

## Problem Frame

When both audiobooks and ebooks exist, users expect to see both on the Continue tab. The downstream components now support rendering both, but `Library.tsx` prevents `'all'` mode from ever activating:

1. **Auto-filter effect** still sets `['audiobook']` when any audiobook exists (line 430-435), so the format filter is never empty when both formats are present
2. **`modeBooksForMedia`** defaults to audiobooks-only when format is unset (line 372-374), so even if the filter is cleared, the Hero and visibility check only see audiobooks
3. **`activeModeLabel`** defaults to `'Audiobooks'` when format is unset (line 359), so the Hero badge, CTA, empty-state messaging, and switch-format logic all use the wrong format name

## Requirements Trace

- **R1** (Show all formats by default when both exist): Fix auto-filter effect + `modeBooksForMedia` so no format filter means "all books"
- **R2** (Preserve single-format default): Auto-filter still applies when only one format exists
- **R3** (Format tabs remain functional): `LibraryFormatModeTabs` already works — no changes needed

## Scope Boundaries

- Only `src/app/pages/Library.tsx` is modified
- No changes to `LibraryMediaShelfColumn`, `LibraryFormatModeTabs`, shelf logic, or ABS sync
- No changes to Browse/Collections/History tabs

## Context & Research

### Relevant Code and Patterns

- [src/app/pages/Library.tsx:357-438](src/app/pages/Library.tsx#L357-L438) — the three functions that need fixing
- [src/app/components/library/LibraryMediaShelfColumn.tsx:26-45](src/app/components/library/LibraryMediaShelfColumn.tsx#L26-L45) — already supports `'all'` mode (from commit 262aa741)
- [src/app/components/library/LibraryFormatModeTabs.tsx:11-16](src/app/components/library/LibraryFormatModeTabs.tsx#L11-L16) — already supports `'all'` mode (from commit 262aa741)

### Institutional Learnings

- The original plan 006 correctly identified `Library.tsx` lines 429-435 as needing change, but the commit only modified the two component files

## Key Technical Decisions

- **Keep `modeBooksForMedia` as the source of truth for the Hero and visibility check**: Rather than refactoring the data flow, fix the function to return all books when format is unset. The ShelfColumn already reads from the store independently, so no data flow restructuring is needed.
- **Fix `activeModeLabel` to return `'Books'` for unset/mixed format and update switch-format logic to use `activeFormatTab`**: When format is unset or mixed, return `'Books'` (not `'Audiobooks'`). Where comparison logic checks `activeModeLabel === 'Audiobooks'` (lines 819, 825, 836), switch to using `activeFormatTab` values instead — `activeModeLabel` no longer reliably distinguishes format after the change.

## Implementation Units

- [ ] **Unit 1: Fix auto-filter effect to only fire for single-format libraries**

**Goal:** Stop the one-shot effect from setting `['audiobook']` when both formats exist, so the format filter stays empty and `'all'` mode activates.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: [src/app/pages/Library.tsx](src/app/pages/Library.tsx#L430-L435)
- Test: [tests/e2e/library-tabs.spec.ts](tests/e2e/library-tabs.spec.ts) (add format visibility test)

**Approach:**
- Replace the single `hasAudiobooks` check with a dual check: only set the format filter when the library has exclusively one format
- When both audiobooks AND ebooks exist, leave `filters.format` unset — this lets `getActiveMode()` in downstream components return `'all'`

**Patterns to follow:**
- The existing `books.some()` pattern already used in this effect
- The `hasEbooks` check pattern: `books.some(b => b.format === 'epub' || b.format === 'pdf')` already used elsewhere in the file

**Test scenarios:**
- Happy path: Library has both audiobooks AND ebooks → no format filter is set, `filters.format` remains empty/undefined
- Happy path: Library has ONLY audiobooks → format filter set to `['audiobook']`
- Happy path: Library has ONLY ebooks → format filter set to `['epub', 'pdf']`
- Edge case: Empty library → no filter set, ref is reset for next mount
- Edge case: User previously cleared format filter (sessionStorage flag) → effect does not re-apply
- Edge case: Effect fires again with format already set by user clicking a tab → early return at line 417, no-op

**Verification:**
- On a library with both audiobooks and ebooks, the Continue tab renders both "Continue Listening" and "Continue Reading" shelves without user interaction
- On a library with only audiobooks, behavior is unchanged (auto-filters to audiobooks)

- [ ] **Unit 2: Fix `modeBooksForMedia` and `activeModeLabel` to handle unset format, and update switch-format comparisons to use `activeFormatTab`**

**Goal:** When no format filter is active, `modeBooksForMedia` should return all books (not just audiobooks), `activeModeLabel` should return `'Books'` (not `'Audiobooks'`), and the three switch-format comparison sites (lines 819, 825, 836) should use `activeFormatTab` instead of `activeModeLabel`.

**Requirements:** R1, R3

**Dependencies:** Unit 1 (the auto-filter fix must land first so unset format is actually reachable)

**Files:**

- Modify: [src/app/pages/Library.tsx](src/app/pages/Library.tsx#L357-L380) and lines 819, 825, 836
- Test: [tests/e2e/library-tabs.spec.ts](tests/e2e/library-tabs.spec.ts) (add format visibility test)

**Approach:**

- `modeBooksForMedia`: When format is unset/empty, return `sourceFiltered` directly (all books) instead of filtering to audiobooks. The fallthrough default also returns `sourceFiltered`
- `activeModeLabel` (lines 359, 362): When format is unset (`!f || f.length === 0`) or mixed (fallthrough return), use `'Books'` instead of `'Audiobooks'`
- **Empty state switch-format logic (line 819):** Replace `activeModeLabel === 'Audiobooks'` with `activeFormatTab === 'audiobooks'`
- **Switch button text (line 825):** Replace `activeModeLabel === 'Audiobooks'` with `activeFormatTab === 'audiobooks'` — same pattern
- **Connect Audiobookshelf gate (line 836):** Replace `activeModeLabel === 'Audiobooks'` with `activeFormatTab !== 'ebooks'` — show Connect ABS when not exclusively in ebook mode (including `'all'` mode)

**Patterns to follow:**

- `getModeBooks()` in `LibraryMediaShelfColumn.tsx` already does `if (mode === 'all') return sourceFiltered` — same pattern
- Keep the existing structure: source filtering, then format filtering, then fallthrough

**Test scenarios:**

- Happy path: Format unset, library has both formats → `modeBooksForMedia` returns all books (audiobooks + ebooks), Hero shows the most-recently-opened book regardless of format
- Happy path: Format set to `['audiobook']` → returns only audiobooks (unchanged behavior)
- Happy path: Format set to `['epub', 'pdf']` → returns only ebooks (unchanged behavior)
- Happy path: Format unset/mixed, `activeModeLabel` returns `'Books'` → Hero badge shows `'Books'`, CTA reads "Explore books"
- Happy path: Format unset/mixed, switch-format button text and logic use `activeFormatTab` → button correctly offers to show ebooks in audiobook mode, audiobooks in ebook mode, or audiobooks in `'all'` mode
- Happy path: Format unset/mixed (`'all'` mode), Connect ABS button is visible (line 836) because `activeFormatTab !== 'ebooks'`
- Edge case: Format unset, library has only audiobooks → returns all (which are all audiobooks), auto-filter from Unit 1 ensures this path isn't reached for single-format libraries anyway
- Edge case: Empty state check (line 799) with both formats → `modeBooksForMedia.length > 0` is true, so shelves render instead of empty state

**Verification:**

- The Hero component receives both audiobooks and ebooks when no format filter is active
- Hero badge shows `'Books'` in `'all'` mode instead of `'Audiobooks'`
- The visibility gate at line 799 passes when either format has books
- Empty state switch-format button uses `activeFormatTab` comparisons, correctly toggling between audiobooks/ebooks
- Connect ABS button appears in both `'all'` mode and audiobook-only mode

## System-Wide Impact

- **Interaction graph:** The Continue tab Hero and empty-state gate depend on `modeBooksForMedia`. The ShelfColumn reads independently from the store. The FormatModeTabs read counts from the store. No callbacks or middleware affected.
- **Error propagation:** None — these are pure read-path changes with no side effects
- **State lifecycle risks:** The `initialMediaFormatDefaultAppliedRef` logic in the auto-filter effect must correctly handle the new case where the effect intentionally does NOT set a filter. The existing ref logic already handles this: the ref is set after the first decision, and the `sessionStorage` gate prevents re-application on remount
- **Unchanged invariants:** `getFilteredBooks()` in the Browse tab is unaffected — it uses `filters.format` directly and already handles empty format correctly (no format filter applied)

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Auto-filter effect regression on single-format libraries | Unit 1 test scenarios explicitly cover single-format cases |
| `'all'` mode Hero badge/CTA shows wrong label | `activeModeLabel` feeds the Hero badge text and "Explore books" CTA. We changed the default to `'Books'` which is accurate for `'all'` mode. The switch-format comparison sites now use `activeFormatTab`, so they are unaffected by the label change. Unit 2 test scenarios explicitly verify Hero badge and CTA. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-07-ebook-library-visibility-requirements.md](docs/brainstorms/2026-05-07-ebook-library-visibility-requirements.md)
- Previous plan: [docs/plans/2026-05-07-006-feat-ebook-library-visibility-plan.md](docs/plans/2026-05-07-006-feat-ebook-library-visibility-plan.md)
- Related commit: 262aa741
