## External Code Review: E107-S06 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-11
**Story**: E107-S06

### Findings

#### Blockers

#### High Priority

#### Medium
- **[src/main.tsx:16-23] (confidence: 75)**: The test handle imports `useBookStore` via dynamic `import()` without any cleanup mechanism. If a prior E2E test already registered `__bookStore__` on the window, a subsequent test running in the same browser context could seed data into the wrong store instance, leading to test pollution. The lazy `import()` resolves after app initialization, so there's a timing window where `__bookStore__` is `undefined` even after the page loads — the E2E test's `waitForFunction` handles this, but only for `__audioPlayerStore__`, not `__bookStore__` (the inline `waitForFunction` at line 104 checks `__bookStore__` but its `loadBooks()` call is fire-and-forget inside the predicate). Fix: Add an explicit `await page.waitForFunction(() => !!window.__bookStore__)` before the `loadBooks` call in the E2E test, or move both store registrations into the same promise chain so they're guaranteed available before any E2E test setup runs.

- **[src/app/components/audiobook/AudioMiniPlayer.tsx:46-48] (confidence: 65)**: `resolvedCoverUrl` is a *derived* value from `useMemo`, not a reference-stable object unless its inputs (`currentBookId`, `book?.coverUrl`) change. If `coverUrl` changes from `undefined` → `undefined` (no cover), or if the book object is replaced with an identical cover URL, `resolvedCoverUrl` could be the same string reference. This means `coverError` won't reset when switching between books that have the same cover URL — an unlikely but possible edge case if two books share a cover image. Fix: Use `currentBookId` as an additional dependency in the `useEffect` to ensure `coverError` resets on any book change: `useEffect(() => setCoverError(false), [resolvedCoverUrl, currentBookId])`.

#### Nits
- **[tests/e2e/regression/story-e107-s06.spec.ts:104-118] (confidence: 55)**: The `waitForFunction` predicate calls `state.loadBooks()` as a side effect inside the polling function. If `loadBooks` is async and takes time, the predicate returns `false`, Playwright re-polls, and `loadBooks()` gets called again on each poll — potentially multiple concurrent loads. This is a pre-existing test helper pattern but could cause flaky tests. Fix: Move `loadBooks()` call outside the predicate or guard with a loading flag check.

---
Issues found: 3 | Blockers: 0 | High: 0 | Medium: 2 | Nits: 1
