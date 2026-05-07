---
title: Library Browse E2E — dismiss default format chip when seeding mixed local and ABS books
date: 2026-05-07
category: best-practices
module: library
problem_type: best_practice
component: testing_framework
severity: medium
applies_when:
  - "Playwright seeds both local (non-audiobook) and Audiobookshelf books, then navigates to /library?tab=browse"
  - "Tests expect the full seeded shelf to be visible without manually changing Library filters"
tags:
  - e2e
  - playwright
  - library
  - format-filter
  - audiobookshelf
  - session-storage
  - testid
---

# Library Browse E2E — dismiss default format chip when seeding mixed local and ABS books

## Context

Library **Browse** applies a media-first default: when the user has not cleared the format filter for the session, the audiobook format chip is shown and the grid is filtered to audiobooks. Clearing the chip is remembered via `sessionStorage` (`libraryFormatCleared`); see the product write-up in [search-palette-library-ux-regressions-2026-05-03.md](../ui-bugs/search-palette-library-ux-regressions-2026-05-03.md).

E2E helpers that seed **mixed** inventory (e.g. local EPUBs plus ABS audiobooks) and land on Browse can see a **transient empty grid** or stable-but-wrong results: the default chip is still active, so non-audiobook local rows never appear. Flakes show up as timeouts waiting for tiles that are filtered out, not as Dexie or seed failures.

## Guidance

After navigating to `/library?tab=browse` in the seed path, **dismiss the active format filter chip** using the stable test id on the remove control, with a short timeout and a no-op catch if the chip is absent:

```ts
const formatChip = page.getByTestId('library-active-filter-remove-format')
try {
  await formatChip.click({ timeout: 6000 })
} catch {
  // No format filter chip — OK
}
```

Keep this in a shared helper (e.g. `seedLibraryWithAbs` in `tests/e2e/audiobookshelf/browsing.spec.ts`) so every scenario that needs the full mixed shelf gets the same guard.

For **visual / manual verification** (demo reel, QA): the Vite app must be reachable on `127.0.0.1:5173` (or your configured base URL). Cursor’s in-IDE browser automation often fails against `localhost` until the dev server is up; Node Playwright against the same URL is a reliable fallback.

## Why This Matters

The failure mode looks like “data didn’t seed” or “selector wrong,” but the grid is often **correctly** applying the default audiobook filter. Without dismissing the chip, assertions on local EPUB tiles are invalid. A stable `data-testid` on the chip remove control avoids brittle role/text queries when copy or layout shifts.

## When to Apply

- Any new E2E that seeds `books` with multiple formats and opens **Browse**
- When adding ABS integration specs that also include local library rows in the same run
- When debugging “empty library” on Browse after seed — confirm whether the format chip is still active before touching IndexedDB

## Examples

**Pattern in-repo** (`tests/e2e/audiobookshelf/browsing.spec.ts`): `seedLibraryWithAbs` loads onboarding keys, seeds `audiobookshelfServers` and `books`, reloads to `/library?tab=browse`, then clicks `library-active-filter-remove-format` so `ALL_BOOKS` are eligible for assertions.

**UI surface**: `LibraryFilters` exposes `data-testid="library-active-filter-remove-format"` on the format chip’s dismiss control so tests do not depend on visible label strings.

## Related

- [Search palette, navigation, and library format chip UX](../ui-bugs/search-palette-library-ux-regressions-2026-05-03.md) — `libraryFormatCleared` and media-first default behavior
- Plan: [fix library book card audiobook icon / NEW badge / Server label](../../plans/2026-05-07-007-fix-library-book-card-audiobook-icon-new-badge-plan.md)
- **Demo evidence / PR visuals**: The Compound Engineering `ce-demo-reel` skill expects `scripts/capture-demo.py` for detect/preflight/recommend/upload; that script is not in this repo yet. Static screenshots or Playwright captures are valid fallbacks; there is no in-repo upload pipeline unless you add that script or attach artifacts manually.

## Related docs finder (overlap note)

- **vs. search-palette doc**: **Moderate** overlap — same format-chip/session invariant, different angle (product bug vs. E2E harness). Keep both; link between them as above.
- If a future doc only repeats the chip behavior without E2E guidance, prefer **updating** this file or the ui-bug doc instead of adding a third.
