---
title: Authors silent sync reload, viewport-safe edit dialog, and Vitest Sonner mock isolation
date: 2026-05-04
category: developer-experience
module: authors / useAuthorStore / useSyncLifecycle / AuthorFormDialog
problem_type: developer_experience
component: development_workflow
severity: medium
applies_when:
  - A periodic sync or background refresh reloads Dexie-backed lists and the UI flashes skeletons or resets in-flight edits.
  - A centered `Dialog` with header/footer clips content or traps scroll on short viewports.
  - Vitest asserts `toast.*` was not called but failures show stale calls from earlier tests.
tags:
  - authors
  - zustand
  - dexie
  - sync-lifecycle
  - vitest
  - sonner
  - dialog-layout
  - test-isolation
---

# Authors silent sync reload, viewport-safe edit dialog, and Vitest Sonner mock isolation

## Context

Several issues surfaced together on the Authors experience:

1. **Perceived “refresh” / churn** — Authors and author profile views appeared to reload on a timer. Investigation pointed at **`useSyncLifecycle`** (sync nudge interval on the order of tens of seconds) combined with **`loadAuthors()`** behaviour that flipped **cold-load** flags (`isLoaded: false`), which retriggers skeleton-style loading even when data was already on screen (session history: churn model vs hunting a shorter unrelated interval).

2. **Author edit modal UX** — The edit **`AuthorFormDialog`** could clip below the viewport or fight **`DialogContent`**’s centered `fixed` + translate positioning when **`overflow-y-auto`** alone lived on the content shell.

3. **Silent reload failures** — Background **`loadAuthors({ silent: true })`** could fail without surfacing anything while users kept stale lists — overlapping the repo’s recurring theme of **silent failure** gaps ([README](../../../CLAUDE.md) lists solutions patterns); contrast with intentional “silent success” guards elsewhere.

4. **Vitest / Sonner** — A test expected **`toast.warning`** not to run on a silent failure **before** first successful load; the failure was **mock call history leaking** across tests, not store logic.

Auto memory notes flagged generic **silent failure** classes (empty catches, swallowed async) as recurring review themes — useful tone context, not primary evidence for this fix path (auto memory [claude]). See [CLAUDE.md](../../../CLAUDE.md) for where documented solutions live in this repo.

## Guidance

### A. Separate “cold load” from “background refresh” for Dexie-backed lists

- Add an options bag on reload (`loadAuthors(options?: { silent?: boolean })`).
- **`silent: true`** should refresh **`authors`** from Dexie **without** clearing **`isLoaded`** or forcing skeleton semantics used for first paint.
- Call **`loadAuthors({ silent: true })`** from **`useSyncLifecycle`** (or equivalent) after sync downloads authors so the UI does not flash loading chrome on every nudge.

### B. Protect long-running edits from background merges

- Track **`isDirty`** (or equivalent) on the form/dialog and avoid overwriting controlled fields when sync pushes new author rows while the user is typing — otherwise silent refresh feels like data loss.

### C. Viewport-safe dialog shell (header / scroll / footer)

- Prefer a **column flex** shell on the modal: **`max-h-[…]`**, **`min-h-0`**, **`overflow-hidden`** on the outer dialog body.
- Put **`overflow-y-auto`** on a **middle** region only; keep **`DialogFooter`** outside that scroll region so actions stay reachable on short viewports.

### D. Surface selective errors for silent paths

- When **`silent`** reload fails **after** data was successfully loaded once, set a **dismissible in-page banner** (and optionally a **throttled** **`toast.warning`**) so operators notice refresh failures without spamming every interval tick.
- Clear that error on the next successful load.

### E. Vitest: reset **`vi.mock('sonner')`** call history between tests

- **`vi.restoreAllMocks()`** restores **spy** implementations; it does **not** reliably clear call history for **`vi.fn()`** instances created inside **`vi.mock`** factories.
- In shared **`beforeEach`**, call **`vi.clearAllMocks()`** after **`vi.restoreAllMocks()`** (or **`mockClear`** targeted mocks) when asserting **`not.toHaveBeenCalled()`** on toast methods.

### F. App-wide store subscriptions

- Avoid subscribing **`App`** to broad Zustand stores for one-shot startup work; call **`getState().method()`** inside a mount-only **`useEffect`** with **`[]`** deps when you only need initial side effects (reduces rerenders — aligned with session-history follow-up on **`recoverOrphanedSessions`**).

## Why This Matters

- **Silent reload** without **`isLoaded`** discipline makes mature SPA screens feel broken (“why does this page refresh?”) and wastes layout stability users rely on for forms.
- **Dialog clipping** is a common shadcn/Radix pitfall: **`fixed` + translate + nested overflow** needs explicit **`min-h-0`** / flex discipline.
- **Leaked toast mocks** produce **false failing tests** and burn time chasing application bugs that are purely test harness hygiene — a sharp contrast when the real bug was mock isolation (session history).

## When to Apply

- Any store with **`isLoading` / `isLoaded`** paired with **periodic sync** or **`refetch`** style triggers.
- Any modal with **sticky footer** + **scrollable body** inside **`DialogContent`**.
- Any Vitest suite mocking **`sonner`** (or similar module-level **`vi.fn`** toast APIs) with **`toHaveBeenCalled`** / **`not.toHaveBeenCalled`** across examples.

## Examples

### Silent reload sketch

```typescript
loadAuthors: async (options?: { silent?: boolean }) => {
  const silent = options?.silent === true
  if (!silent && get().isLoaded) return
  if (!silent) set({ isLoading: true, error: null })
  try {
    const rows = await db.authors.orderBy('createdAt').reverse().toArray()
    set({ authors: rows, isLoading: false, isLoaded: true, error: null })
  } catch (e) {
    if (silent) {
      if (get().isLoaded) {
        // Throttled toast + set inline error for banner
      }
      return
    }
    // Cold-load error path: toast.error, etc.
  }
}
```

### Vitest teardown sketch

```typescript
beforeEach(async () => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  useAuthorStore.setState({ authors: [], isLoading: false, isLoaded: false, error: null })
})
```

## Related

- [Pure router shell / `useSyncLifecycle` placement](../best-practices/pure-router-shell-structural-refactoring-2026-04-21.md) — where sync lifecycle and toast shell wiring were established.
- [Learning paths dialog remount after Zustand parent updates](../best-practices/learning-paths-import-from-path-patterns-2026-05-03.md) — dialog stability when stores churn parent renders (orthogonal but same UX class).
- [Single write path for synced mutations](../best-practices/single-write-path-for-synced-mutations-2026-04-18.md) — Dexie + sync responsibilities; silent divergence risks if stores bypass shared helpers.
- Session-history synthesis for this cluster: Knowlune Cursor thread “Author modal viewport and Authors sync churn” (modal shell + **`loadAuthors({ silent: true })`** + Vitest mock leakage diagnosis).

## Refresh follow-up (optional)

Overlap with cross-cutting **silent sync** docs is **moderate** — no duplicate authors-store lifecycle doc existed. If **`pure-router-shell`** gains authors-specific callouts later, run **`/ce-compound-refresh`** with scope **`pure-router-shell`** rather than a broad sweep.
