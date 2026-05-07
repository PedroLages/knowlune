---
title: Library Continue hero CTAs, shared finished semantics, E2E hygiene, and Vite fs.allow in worktrees
date: 2026-05-07
category: docs/solutions/best-practices/
module: library
problem_type: best_practice
component: testing_framework
severity: low
applies_when:
  - Changing Library Continue tab hero labels or shelf “finished” behavior
  - Writing or extending Playwright library tab specs that seed IndexedDB
  - Running Vite from a git worktree while assets resolve to a parent checkout node_modules
  - Capturing browser demo evidence when automated seeding must share the same browser profile as screenshots
tags:
  - library
  - playwright
  - vite
  - worktree
  - indexeddb
---

# Library Continue hero CTAs, shared finished semantics, E2E hygiene, and Vite fs.allow in worktrees

## Context

Work on the Library **Continue** tab added hero primary actions (“Continue reading/listening”, “Read/Listen again”) and context menus on shelf tiles. Follow-up review asked for: one definition of **finished** for hero and shelves, clearer E2E seeds (especially “unread-only” hero), less brittle console filtering, stable **Vite** reads when using **git worktrees**, Vitest coverage for the hero, and stronger shelf/context-menu tests. Demo capture also surfaced that **Playwright** and **agent-browser** use different browser profiles, so IndexedDB seeded in one tool is invisible to the other unless you reconnect or use one tool for both seed and capture.

## Guidance

1. **Single “finished” predicate** — Export a small helper (e.g. `isFinished(book)` in `libraryShelves.ts`: `status === 'finished' || progress >= 100`) and use it in shelves, hero CTAs, and any other “read again / listen again” branching so labels stay consistent when progress and status drift.

2. **Vite `server.fs.allow` in worktrees** — If dev logs show requests blocked outside the allowed list (often `@fontsource` or other packages resolved to a **parent** `node_modules`), extend `server.fs.allow` with the worktree root plus `node_modules` at `./`, `../`, and `../../` (or the concrete paths for your layout). Prefer fixing the server allow list over permanently filtering `403` in E2E console assertions.

3. **E2E book store cleanup** — Add a thin `clearBooksStore(page)` that delegates to the existing `clearIndexedDBStore(page, 'ElearningDB', 'books')` instead of duplicating raw `indexedDB.open` blocks in specs.

4. **Hero tests must match seed reality** — `pickHeroBook` prefers **in-progress** titles with `lastOpenedAt`. A spec named for “newest unread ebook” must **clear** the store and seed **only** unread titles (or only the hero candidate you intend); otherwise the hero will be an in-progress book from `tabSeedsBase()` and the test name will lie.

5. **Console error guards** — After fixing root causes (e.g. font 403), remove broad ignores like `403 (Forbidden)` from “no console errors” tests so real regressions surface.

6. **Vitest for hero and shelves** — Cover primary label branches (in-progress vs finished vs unread; ebook vs audiobook) with mocked `useNavigate` and `useBookCoverUrl`. For context menus on shelves, scope interactions to a single rail (e.g. `within(screen.getByTestId('media-shelf-continue'))`) when the same `book-tile-{id}` could appear in multiple shelves.

7. **Demo / GIF capture** — To show the Library with seeded books, run **seed and screenshot in the same Playwright context** (or the same `agent-browser` session with in-page seeding). Seeding in Playwright and then opening `agent-browser` will usually show an empty library.

## Why this matters

Duplicated “finished” logic and misleading seeds create passing tests that don’t match product semantics. Worktree + Vite 403 noise trains contributors to suppress console failures. Split browser profiles waste time when recording demos. A single helper and honest seeds keep UI, tests, and evidence aligned.

## When to apply

- Any change to **`LibraryMediaHero`**, **`libraryShelves`**, or **library-tabs** E2E.
- When moving between main checkout and **worktrees** and seeing dev-server file allow errors.
- When automating **PR demo** captures for Library tab UX.

## Examples

**Shared predicate (conceptual):**

```typescript
export function isFinished(book: Book): boolean {
  return book.status === 'finished' || book.progress >= 100
}
```

**Clear + seed in E2E:**

```typescript
await clearBooksStore(page)
await seedBooks(page, [/* single unread epub */])
await page.goto('/library?tab=continue')
```

**Vite (conceptual):**

```typescript
server: {
  fs: {
    allow: [
      path.resolve(__dirname),
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '..', 'node_modules'),
      path.resolve(__dirname, '..', '..', 'node_modules'),
    ],
  },
  // ...proxy, headers, etc.
}
```

## Related

- [Library tabbed IA patterns](./library-page-tabbed-ia-refactor-patterns-2026-05-02.md)
- [Library browse E2E mixed format seeding](./library-browse-e2e-format-filter-mixed-seeding-2026-05-07.md)
- [Library mixed format default / unread badge](../ui-bugs/library-mixed-format-default-and-unread-badge-2026-05-07.md) — UI area overlap; different angle (Browse chip / badges).
- `CLAUDE.md` — worktree E2E note (port 5173 / stale dev server).
- If older library E2E docs still recommend filtering `403` globally or inlining IndexedDB clears, run a narrow **`ce-compound-refresh`** on library-tab / browse E2E docs to align with `server.fs.allow` and `clearBooksStore`.
