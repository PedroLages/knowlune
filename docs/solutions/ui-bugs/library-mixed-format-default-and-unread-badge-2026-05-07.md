---
title: Library mixed inventory showed forced audiobook format filter and wrong Continue hero scope
date: 2026-05-07
category: ui-bugs
module: library
problem_type: ui_bug
component: tooling
severity: medium
symptoms:
  - Browse showed a Format / audiobook filter chip on first load when both audiobooks and ebooks existed, without the user choosing a format tab.
  - Continue tab hero and media shelves behaved like audiobook-only when format was unset, hiding epub titles.
  - Gold "Want to Read" pill appeared on unread book cards and list rows, adding clutter for backlog titles.
root_cause: logic_error
resolution_type: code_fix
tags:
  - library
  - filters
  - format
  - react
  - session-storage
  - playwright
  - book-card
---

# Library mixed inventory showed forced audiobook format filter and wrong Continue hero scope

## Problem

The Library route applied a one-shot media-first default that set `filters.format` to `['audiobook']` whenever any audiobook existed, even if the library also contained ebooks. That surfaced an unwanted Browse chip and prevented a true “all formats” mode on Continue. Unread backlog titles also showed a gold “Want to Read” status pill on cards.

## Symptoms

- **Browse:** `Format: audiobook` active filter without user action when both modalities were present.
- **Continue:** Hero and `modeBooksForMedia` behaved as audiobook-only when `filters.format` was empty.
- **Cards:** `BookStatusBadge` rendered “Want to Read” for `status: unread`.

## What Didn't Work

- Treating “empty format after initial effect” as user chip-clear via a single ref fired incorrectly for mixed libraries (second effect pass could set `libraryFormatCleared`).
- Leaving `initialMediaFormatDefaultAppliedRef` false on StrictMode remount while the store already held a non-empty format from the first mount.

## Solution

1. **`src/lib/libraryMediaFormatDefault.ts`** — Centralize `libraryFormatCleared` key/value, modality checks (`libraryHasAudiobooks` / `libraryHasEbooks`), filter-shape helpers, and pure `chooseFirstEmptyFormatDefault` / `chooseHandledEmptyFormatResync` for unit tests.

2. **`Library.tsx` effect** — Distinguish user chip clear with `prevFilterFormatRef` (non-empty → empty). For mixed inventory, leave format unset on first paint; when inventory **shrinks** from mixed to one modality while format stays empty, re-apply the single-modality default via `chooseHandledEmptyFormatResync`. When inventory **gains** the opposite modality while the tab filter is still audiobook-only or ebook-tab-only, **widen** by `setFilter('format', undefined)` using primed `prevHadEbooksRef` / `prevHadAudiobooksRef`. On any non-empty format, set `initialMediaFormatDefaultAppliedRef` true so remount aligns with store state.

3. **`activeModeLabel` / `modeBooksForMedia`** — Unset format maps to neutral **Items** and all books for the current source scope; empty-state CTAs handle Items mode.

4. **`BookStatusBadge`** — Return `null` for `unread`.

5. **Tests** — Vitest for `libraryMediaFormatDefault`; `BookStatusBadge` + expanded `BookCard` cases; Playwright asserts absence of `library-active-filter-remove-format` with shared `library-tab-seed` helpers.

## Why This Works

Mixed catalog is detected before applying a default filter, so the store stays aligned with “all formats” until the user narrows. Transition refs separate real user clears from intentional empty filters. Widening on new modality fixes staged imports after a single-modality auto-apply. Explicit helpers make the policy testable without mounting the full page.

## Prevention

- Assert format chip via **`data-testid="library-active-filter-remove-format"`** (not fragile label regex); see [best-practices/library-browse-e2e-format-filter-mixed-seeding-2026-05-07.md](../best-practices/library-browse-e2e-format-filter-mixed-seeding-2026-05-07.md) for chip-dismiss patterns in other suites.
- When changing the effect, extend **`libraryMediaFormatDefault.test.ts`** for new modality rules.

## Related Issues

- Plan: `docs/plans/2026-05-07-009-fix-library-browse-audiobook-filter-root-cause-plan.md`
- Browse E2E patterns: [library-browse-e2e-format-filter-mixed-seeding-2026-05-07.md](../best-practices/library-browse-e2e-format-filter-mixed-seeding-2026-05-07.md)
