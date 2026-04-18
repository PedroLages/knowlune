---
title: "feat: Unified Search Index (E117-S01)"
type: feat
status: active
date: 2026-04-18
epic: E117
story: E117-S01
origin: docs/brainstorms/2026-04-18-global-search-upgrade-requirements.md
---

## Overview

Replace the current palette's mixed-mode search (MiniSearch for notes only; substring filters for everything else) with a single combined MiniSearch instance that indexes all six Knowlune entity types: `importedCourses`, `authors`, `importedVideos`, `books`, `notes`, `bookHighlights`. The palette becomes typo-tolerant and relevance-ranked across every entity, grouped into fixed sections, and accessible on mobile via the existing header search icon. Per-page search inputs on `Courses.tsx` and `Authors.tsx` are refactored to share the same index (quality improves, inputs stay — removal is deferred to Story 3).

This is Story 1 of a three-story split agreed in the origin document after document-review. Story 2 adds ranking/frecency/empty-state; Story 3 handles type-prefix filters and per-page input removal.

## Problem Frame

Four concrete gaps in today's search (see origin: `docs/brainstorms/2026-04-18-global-search-upgrade-requirements.md` §1):

1. **Missing entities** — the palette indexes notes and a legacy static `Course` store (which is actually a no-op stub since Dexie v30, see `src/stores/useCourseStore.ts:1-22`). User-imported courses/lessons, authors, and books are not indexed at all.
2. **Shallow matching** — `SearchCommandPalette.commandFilter` (at `src/app/components/figma/SearchCommandPalette.tsx:177-183`) falls back to cmdk's substring matcher for everything that isn't a bypassed note or highlight. No typo tolerance, no ranking, no field weighting.
3. **Parallel UX** — `Courses.tsx:115-130` and `Authors.tsx:58-65` run independent substring filters with no shared infrastructure.
4. **No cross-entity discovery** — "all the Postgres things" requires visiting multiple pages.

Story 1 fixes gaps 1, 2, and 4 end-to-end, and closes half of gap 3 (shared infrastructure without removing the inputs).

## Requirements Trace

From origin §7 Acceptance Criteria (Story 1 subset, ACs 1–13):

- R1 (AC 1–2): Cmd+K opens the palette on desktop; visible header search icon triggers it on mobile/touch.
- R2 (AC 3): Typed query returns results from all six entity types (when matches exist), grouped in fixed order (Courses → Books → Lessons → Notes → Book Highlights → Authors), capped at 5 per section with "Show all N" inline expansion.
- R3 (AC 4): Typo-tolerant matching works across all entity types — including previously substring-only Courses, Lessons, Book Highlights. Playwright verifies "postgrs→Postgres", "michel→Michael", "introdction→introduction".
- R4 (AC 5): Selecting a result navigates to the correct route (mapping enumerated in §Key Technical Decisions).
- R5 (AC 6): Deleted-entity fallback — toast "Item no longer available" + results refresh; never throw or navigate blank.
- R6 (AC 7): Per-page search inputs on `Courses.tsx` and `Authors.tsx` share the same unified MiniSearch instance. Inputs remain rendered.
- R7 (AC 8): First Cmd+K after app boot returns results in <100ms when index is ready; if not ready, palette opens in <16ms showing empty-state, transitions to live results within 300ms of first keystroke.
- R8 (AC 9): Index incremental update latency <300ms from Dexie change to palette result availability.
- R9 (AC 10): Regression — existing note + highlight search behaviors still work.
- R10 (AC 11): Accessibility — ARIA `role="listbox"` on result list, `role="option"` on rows, `aria-label` on type badges, `aria-live="polite"` announces result count changes, keyboard navigation (arrow, Home, End, Escape) across sections.
- R11 (AC 12): Mobile — bottom-sheet or full-screen palette variant at viewport <640px; touch targets ≥44×44px.
- R12 (AC 13): No Supabase, no network calls, no new dependencies beyond MiniSearch 7.2.0 and cmdk 1.1.1.

## Scope Boundaries

- **No empty-state view** (Continue learning / Recently opened) — Story 2.
- **No Best Matches section** — Story 2 (requires frecency, which requires the recency log).
- **No frecency ranking / recency log / Dexie `searchFrecency` table** — Story 2. Story 1 uses pure MiniSearch relevance for all results.
- **No type-prefix filters** (`c:`, `b:`, `l:`, `a:`, `n:`, `h:`) — Story 3.
- **No per-page input removal** — Story 3 (after measurement window).
- **No legacy `useCourseStore` indexing** — the store is a no-op stub since Dexie v30.
- **No new Dexie version bump** — all six tables exist at v52.

### Deferred to Separate Tasks

- Empty-state UX + frecency + recency log: Story 2 (new plan when Story 1 ships).
- Prefix filters + per-page removal: Story 3.
- Server-side search (ts_vector / pg_trgm): future Epic 22 candidate per `docs/planning-artifacts/epic-22-server-side-search-candidate.md`.

## Context & Research

### Relevant Code and Patterns

- **`src/lib/noteSearch.ts`** — canonical local MiniSearch pattern. Module-level singleton with `initialized` flag, `fields`/`storeFields`/`searchOptions` config (lines 15-33), `initializeSearchIndex` that calls `removeAll()` + `addAll()` on re-init (lines 75-82), and incremental `addToIndex` / `updateInIndex` / `removeFromIndex` using the try/catch `discard(id)` pattern (lines 87-118). **This module is replaced** by the new unified module; its field config is preserved verbatim for notes within the combined index.
- **`src/app/components/figma/SearchCommandPalette.tsx`** — primary edit target. Key points:
  - `buildSearchIndex(allCourses)` at lines 122-158 consumes the dead `useCourseStore`; replaced by the unified index hook.
  - `commandFilter` at lines 177-183 bypasses cmdk's internal filter for `note:` and `highlight:` values by returning `1`. The bypass list extends to all six entity types.
  - Notes async search effect at lines 208-214.
  - Book highlights substring scan at lines 217-252 — replaced by unified MiniSearch query.
  - Result rendering groups for Notes (311-345), Book Highlights (347-360), Pages (362-381), Courses (383-402), Lessons (404-423).
  - Silent-catch pattern at line 246 uses `// silent-catch-ok: <reason>` per ESLint `error-handling/no-silent-catch` rule.
- **`src/app/components/Layout.tsx`** — header search triggers already wired:
  - Mobile icon-only button at lines 522-533 (existing; AC 2 requires it stay functional).
  - Desktop search bar at 535-552.
  - Cmd+K wiring at 342-346 via `setSearchOpen`.
  - Palette mounted at 679.
- **`src/main.tsx:42-78`** — existing `deferInit(fn)` helper wraps `requestIdleCallback` with `setTimeout(fn, 1)` fallback. Currently feeds `initializeSearchIndex` via `buildCourseLookup([])` + `db.notes.toArray()` at lines 58-71. **Reuse this helper**; don't roll a new one.
- **`src/db/checkpoint.ts`** — Dexie v52 schema; all six target tables present with `userId, [userId+updatedAt]` compound indexes. `importedCourses` (line 55), `importedVideos` (56), `notes` (60-61), `authors` (75), `books` (89-90), `bookHighlights` (91-92). `CHECKPOINT_VERSION = 52` at line 23.
- **`src/lib/authors.ts:61-65`** — `getMergedAuthors(storeAuthors)` reconciliation. No `getMergedCourses` equivalent exists — index from `db.importedCourses` directly.
- **`src/stores/useCourseStore.ts:1-22`** — **deprecated no-op stub**. Do not read from it.
- **`src/hooks/useCourseAdapter.ts:22-35`** — reference for `useLiveQuery` from `dexie-react-hooks` (one of only three places it's used; each call site opens its own subscription; no shared helper exists).
- **`src/app/pages/Courses.tsx:115-130`** — per-page 250ms-debounced substring filter; refactor to call the new unified search with a scoped `type: 'course'` option.
- **`src/app/pages/Authors.tsx:58-65`** — per-page useMemo substring filter; same refactor.
- **`docs/engineering-patterns.md`** — project patterns include: `useEffect` cleanup with `ignore` flag, silent-catch annotation rules, "Start Simple, Escalate If Needed" decision framework (relevant to §Key Technical Decisions on incremental-vs-rebuild).

### Institutional Learnings

- **`docs/solutions/logic-errors/audiobook-cover-search-async-timing-2026-04-16.md`** — tangentially relevant: boot-time scatter-gather work should expose a real completion signal (`Promise.allSettled`) rather than timer-based "I think we're done." Applied here: the 6-table index build uses `Promise.allSettled` so a failure in one table doesn't block the others, and callers awaiting "index ready" observe real completion.
- **`docs/implementation-artifacts/31-1-add-catch-to-fire-and-forget-indexeddb-reads.md`** — referenced in the cover-search post-mortem. Analogous: any Dexie read during index build that can throw must be caught or logged, not fire-and-forget.
- `docs/solutions/` corpus is otherwise empty for MiniSearch, cmdk, `requestIdleCallback`, and incremental update patterns. Story 1 will generate new solutions docs on landing.

### External References

Not used — local patterns are sufficient (`noteSearch.ts`, `deferInit`, `useLiveQuery` examples). External research skipped per Phase 1.2.

## Key Technical Decisions

- **Single combined MiniSearch instance** with a `type` discriminator field and `storeFields: ['id', 'type', 'parentId', 'parentTitle', 'displayTitle', 'subtitle', ...]`. Rationale: makes cross-entity scoring tractable for Story 2's Best Matches; avoids per-entity singleton proliferation (origin resolves finding F-05). MiniSearch's single-corpus IDF is a known limitation but is the right trade-off for a palette where users want a consistent score ordering.
- **Reuse `deferInit` from `src/main.tsx`**. Rationale: a second `requestIdleCallback` path would drift. Extend the existing boot hook to also run the unified-index builder after `initializeSearchIndex` (notes) completes — actually, **replace** the notes-only bootstrap with the unified builder.
- **Per-entity isolation via `Promise.allSettled`**. If one entity's `db.table.toArray()` throws, other entities still index. Failures logged via `console.error` (not silent). Matches the "real completion signal" learning.
- **Incremental updates via `dexie-react-hooks.useLiveQuery`, one subscription per table**. On each snapshot, diff the new list against last-seen IDs and call MiniSearch `add` / `replace` / `remove` per affected doc. The `replace` path uses the `try { discard(id) } catch {}` pattern from `noteSearch.ts:97-104`. Rationale: full rebuilds on every note-edit keystroke would thrash (adversarial review ADV-02); incremental updates are the approach.
- **Debounce trailing 300ms on incremental update batches** during bulk import (Dexie liveQuery fires on every write; batching is essential).
- **cmdk global filter bypass**. Set `<Command filter={() => 1}>` on the root. MiniSearch becomes the sole ranker; cmdk is just the UI shell for keyboard nav and focus. Rationale: extending the per-item bypass to all 6 entity types is more invasive than one prop change, and global bypass removes a class of "typo fuzzy match silently hidden" bugs.
- **Route mapping** (R4):
  - Course → `/courses/:id`
  - Book → `/books/:id`
  - Lesson (importedVideo) → `/courses/:courseId/videos/:videoId`
  - Note → course+video view with note highlighted (same pattern as today at `SearchCommandPalette.tsx:261-281`)
  - Highlight → book reader at anchor (same pattern as today)
  - Author → `/authors/:id`
- **Do NOT persist the index to IndexedDB**. Rebuild cost at current scale is bounded; persistence adds staleness + migration surface with no near-term payoff. Revisit in Story 2 or future Epic 22 if the benchmark shows it's needed.
- **Type badge copy**: "Course", "Book", "Lesson", "Note", "Highlight", "Author". Single-word labels. No icons required for Story 1 (origin §5.2 — type badge, optional row metadata deferred).
- **ARIA contract**: palette root = `role="dialog" aria-label="Search"`; result container = `role="listbox"`; each `CommandItem` row = `role="option"`; type badges use `aria-label` (e.g., `aria-label="Course"`) so screen readers announce them; a polite live region outside the list announces "N results" on query change (debounced 250ms to avoid spam).
- **Mobile viewport < 640px**: palette renders as full-screen sheet (leveraging shadcn/cmdk's existing responsive patterns; the header mobile trigger at `Layout.tsx:522-533` is already wired).

## Open Questions

### Resolved During Planning

- **Where does unified-search code live?** — New file `src/lib/unifiedSearch.ts` (replaces `src/lib/noteSearch.ts` internals; the old module is deleted with a migration comment in the PR description).
- **Does Story 1 require a Dexie version bump?** — No. All six tables exist at v52. No migration risk.
- **How does incremental update observe Dexie changes?** — Per-table `useLiveQuery` inside a new hook `useUnifiedSearchIndex()` that wraps the MiniSearch singleton. Six subscriptions; each diffs its previous snapshot against the new one to produce add/replace/remove calls.
- **How is "index ready" signaled to the palette?** — The new hook exposes `{ ready: boolean, search(query, opts) }`. Palette renders empty-state (today's courses/pages baseline) when `ready === false`; swaps to live results once `ready === true`.
- **What happens on first Cmd+K before idle callback fires?** — Palette opens immediately showing the existing palette baseline (pages + pre-indexed quick actions). No blocking spinner. Once the hook reports ready, results become live on next keystroke.
- **What about the existing note-search prefix/fuzzy config?** — Preserved verbatim for the notes subset of the combined index (same boosts: `tags`2×, `courseName` 1.5×; `prefix: true`, `fuzzy: 0.2`, `combineWith: 'OR'`). Unified index applies field-specific boosts per the origin §4 table.

### Deferred to Implementation

- **Exact diffing algorithm for per-table incremental updates.** Two plausible approaches: (a) maintain a `Map<id, updatedAt>` per table and compare on each liveQuery snapshot, (b) use Dexie's change events (`db.on('changes')`) directly. (a) is simpler and sufficient; (b) is lower-overhead. Start with (a); revisit only if liveQuery overhead is measurable.
- **Whether `requestIdleCallback` needs a polyfill for Safari < 16.4.** The existing `deferInit` already provides `setTimeout(fn, 1)` fallback; confirm behavior at implementation time on an actual iOS Safari device.
- **Exact shape of the `<Command filter={() => 1}>` bypass on cmdk 1.1.1.** May require `shouldFilter={false}` instead depending on the installed cmdk version API. Verify at implementation by reading the installed node_modules types.
- **Result virtualization threshold.** AC 12 doesn't require virtualization at Story 1 scope; origin §5.3 defers to 50+ items. If benchmark at 1000 courses shows jank, revisit.
- **Test-double for `requestIdleCallback` in Vitest.** `src/test/setup.ts` has no existing polyfill. First boot-path unit test will need one — cheapest is `globalThis.requestIdleCallback = (fn) => setTimeout(fn, 0)`.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
                    ┌────────────────────────────────────────────────┐
  app boot  ───▶    │ src/main.tsx   deferInit(requestIdleCallback)  │
                    └────────────────────────────────────────────────┘
                                          │
                                          ▼
                    ┌────────────────────────────────────────────────┐
                    │ initializeUnifiedSearchIndex()                 │
                    │   Promise.allSettled([                         │
                    │     indexCourses(db.importedCourses),          │
                    │     indexAuthors(db.authors),                  │
                    │     indexLessons(db.importedVideos),           │
                    │     indexBooks(db.books),                      │
                    │     indexNotes(db.notes),                      │
                    │     indexHighlights(db.bookHighlights),        │
                    │   ])                                           │
                    │   → single MiniSearch instance, storeFields    │
                    │     include type discriminator + parent refs   │
                    └────────────────────────────────────────────────┘
                                          │
                                          ▼
                    ┌────────────────────────────────────────────────┐
                    │ useUnifiedSearchIndex() hook                    │
                    │  - 6× useLiveQuery(db.<table>)                  │
                    │  - diff snapshot → add/replace/remove            │
                    │  - 300ms trailing debounce per-table             │
                    │  - exposes { ready, search(q, opts) }            │
                    └────────────────────────────────────────────────┘
                                          │
                       ┌──────────────────┼──────────────────┐
                       ▼                  ▼                  ▼
                ┌─────────────┐    ┌─────────────┐    ┌────────────────────┐
                │ palette     │    │ Courses.tsx │    │ Authors.tsx        │
                │ cmdk root   │    │ per-page    │    │ per-page           │
                │ filter=()=1 │    │ input uses  │    │ input uses         │
                │ groups by   │    │ search({    │    │ search({           │
                │ type, 5 ea, │    │   types:    │    │   types:           │
                │ Show all N  │    │   ['course']│    │   ['author']       │
                └─────────────┘    │ })          │    │ })                 │
                                   └─────────────┘    └────────────────────┘
```

Grouped rendering order (origin §5.2.2, fixed): Courses → Books → Lessons → Notes → Book Highlights → Authors.

## Implementation Units

- [ ] **Unit 1: Create `src/lib/unifiedSearch.ts` — combined MiniSearch singleton + field config**

**Goal:** Establish the core module — one MiniSearch instance, a `type` discriminator, per-entity document shaping (`toSearchable<Entity>` helpers), and imperative `addToIndex` / `updateInIndex` / `removeFromIndex` functions that follow the `discard`-in-try/catch pattern from `noteSearch.ts`. No Dexie subscriptions yet — that lands in Unit 3.

**Requirements:** R2, R3, R9.

**Dependencies:** None (file creation only).

**Files:**
- Create: `src/lib/unifiedSearch.ts`
- Create: `src/lib/__tests__/unifiedSearch.test.ts`
- Reference: `src/lib/noteSearch.ts` (preserve notes field config verbatim)

**Approach:**
- Single MiniSearch instance configured with `idField: '_searchId'` (synthetic, `${type}:${id}`) to avoid collisions across entity tables.
- `fields`: union of all searchable fields with per-entity boosts mapped via `searchOptions.boost`.
- `storeFields`: at minimum `id`, `type`, `parentId`, `parentTitle`, `displayTitle`, `subtitle` — enough to render a result row and build a route without re-querying Dexie.
- Six `toSearchable<Entity>` helpers map raw Dexie records to the shared document shape. Notes helper reuses `noteSearch.ts` field config exactly. **Authors helper takes `getMergedAuthors(storeAuthors)` output** — not raw `db.authors` — so the index matches what the Authors page renders. This is established in Unit 1 so tests lock the right contract from the start (not overridden later in Unit 4).
- Public surface: `initializeUnifiedSearch(docs: SearchableDoc[])`, `addToIndex(doc)`, `updateInIndex(doc)`, `removeFromIndex(id)`, `search(query, { types?: EntityType[], limit?: number })`.

**Execution note:** Implement test-first for the `search()` public surface and the mapping helpers. Each entity type's shape is a known contract; tests should fail before the mapper exists.

**Patterns to follow:**
- `src/lib/noteSearch.ts` — module-level singleton, initialization guard, `discard`-in-try/catch.
- `docs/engineering-patterns.md` → "Start Simple, Escalate If Needed" — use a plain MiniSearch config first; revisit only if benchmarks fail.

**Test scenarios:**
- Happy path: initialize with 3 courses + 2 books + 5 notes → `search('postgres')` returns all 10 docs ranked by relevance, each carrying a `type` field.
- Happy path: `search('postgres', { types: ['course'] })` returns only course results.
- Edge case: empty query → returns empty array (no accidental return-all).
- Edge case: 1-character query → returns empty or `prefix: true` matches only (match `noteSearch.ts` behavior).
- Edge case: ID collision across entity types — a course with `id: 'abc'` and a note with `id: 'abc'` both index without overwriting each other.
- Error path: `updateInIndex` on a doc that was never added → does not throw (discard-in-try/catch).
- Error path: `removeFromIndex` on unknown id → does not throw.
- Integration (light): field boosts actually influence ranking — a query that matches `course.name` outranks a query that only matches `course.source`.
- Typo tolerance: "postgrs" matches "Postgres"; "michel" matches "Michael"; "introdction" matches "introduction".

**Verification:**
- `src/lib/__tests__/unifiedSearch.test.ts` runs green.
- Manual smoke: `node -e "require('./src/lib/unifiedSearch')"` imports without side effects.

---

- [ ] **Unit 2: Extend cmdk filter bypass + refactor palette rendering to consume unified search**

**Goal:** Replace `SearchCommandPalette.tsx`'s mixed-mode rendering with a single query to `unifiedSearch.search()`. Set `<Command filter={() => 1}>` (or equivalent per installed cmdk API) so MiniSearch is the sole ranker. Render results grouped in the fixed order Courses → Books → Lessons → Notes → Book Highlights → Authors, capped at 5 each with "Show all N" inline expansion. Type badges on every row.

**Requirements:** R2, R3, R4, R5, R9, R10.

**Dependencies:** Unit 1.

**Files:**
- Modify: `src/app/components/figma/SearchCommandPalette.tsx`
- Test: `tests/e2e/search-palette-unified.spec.ts` (new Playwright spec; covers R3 typo tolerance, R4 route nav, R5 deleted-entity, R10 a11y keyboard nav)
- Test: `src/app/components/figma/__tests__/SearchCommandPalette.test.tsx` (new; unit-level render + interaction coverage)

**Approach:**
- Remove `buildSearchIndex(allCourses)` (consumer of the dead `useCourseStore`) and the per-type substring-scan blocks for `bookHighlights`.
- Replace with a single call to the `useUnifiedSearchIndex()` hook from Unit 3 (forward-looking; Unit 2 stubs this with a mock until Unit 3 lands).
- cmdk: set filter bypass at the `Command` root. Keep per-`CommandItem` `value={...}` contracts stable for keyboard nav.
- Rendering: map `result.type → CommandGroup heading`. Each row shows `displayTitle` + optional `subtitle` + type badge. "Show all N" row appears when a section has >5 results; clicking or selecting expands inline to show up to 50.
- Deleted-entity fallback: on row select, attempt navigation; if the target entity no longer exists, surface a `toast.error("Item no longer available")` and `window.location.reload()` is not used — instead, remove the stale item from the local result set and keep the palette open.
- ARIA: add `role="listbox"` to the Command.List container, `role="option"` inherited from `CommandItem`, type badge spans get `aria-label`, and a sibling `<div role="status" aria-live="polite">` reports "N results" post-debounce.
- No Story 2 features: Best Matches section not rendered; empty-state remains today's baseline (pages + quick actions).

**Execution note:** Start with a failing Playwright test for AC 4 (typo tolerance across new entity types) to lock the contract before refactoring the palette.

**Technical design:** *(optional — decision matrix)*

| Situation | cmdk filter | MiniSearch behavior |
|---|---|---|
| Query empty | bypass (1) | return [] (palette shows quick actions) |
| Query typed, all types | bypass (1) | rank all 6 entity types together |
| Query typed, scoped (Story 3) | bypass (1) | `types: ['course']` limits corpus |
| No results | bypass (1) | empty-results copy (Unit defers to Story 2 for full styling) |

**Patterns to follow:**
- Existing bypass-by-value-prefix at `SearchCommandPalette.tsx:177-183` (extending the concept globally).
- `useEffect` cleanup pattern from `docs/engineering-patterns.md` (ignore-flag).
- Silent-catch annotation on the navigation fallback: `// silent-catch-ok: deleted entity handled via toast + result refresh`.

**Test scenarios:**
- Happy path (Playwright): seed 3 courses, 2 books, 2 authors, 5 notes, 3 highlights. Press `Cmd+K`. Type "postgres". All matching sections appear in fixed order with correct counts.
- Happy path (Playwright): mobile viewport 375px. Tap header search icon. Palette opens as full-screen sheet. Touch targets ≥44px (Playwright `getBoundingBox`).
- Happy path (unit): rendering with 8 courses matching a query shows 5 rows + "Show all 3 more" row; clicking it expands to 8.
- Edge case: query returns zero results → sections collapse; palette shows "No results" placeholder.
- Edge case (Playwright): select a result row with arrow keys + Enter → navigates to the correct route. One case per entity type.
- Error path (Playwright): seed a note → delete it from IndexedDB while palette is still open → select the (stale) result. Toast "Item no longer available" fires; palette stays open; stale row disappears.
- Integration (Playwright): typo tolerance end-to-end — type "postgrs" → Postgres course appears; type "michel" → Michael author appears; type "introdction" → lesson "Introduction" appears.
- Integration (unit + axe): render palette with seed data → no axe a11y violations (`role="listbox"`, `role="option"`, `aria-live` region present).
- Integration (Playwright): keyboard nav — arrow down cycles through sections; Escape closes; Home/End jump to first/last option.

**Verification:**
- `tests/e2e/search-palette-unified.spec.ts` green.
- `src/app/components/figma/__tests__/SearchCommandPalette.test.tsx` green.
- Manual smoke with `npm run dev` at 375px + 1024px viewports.

---

- [ ] **Unit 3: Build `useUnifiedSearchIndex()` hook — boot + incremental updates**

**Goal:** A React hook that wraps the `unifiedSearch` singleton from Unit 1 with Dexie reactivity. On mount, kicks off `initializeUnifiedSearch` via the existing `deferInit` helper. On each `useLiveQuery` snapshot (one per table), diffs the previous snapshot and calls `addToIndex` / `updateInIndex` / `removeFromIndex`. Exposes `{ ready, search }`. Failures in any entity type are isolated via `Promise.allSettled`.

**Requirements:** R7, R8, R9, R12.

**Dependencies:** Unit 1.

**Files:**
- Create: `src/lib/useUnifiedSearchIndex.ts`
- Create: `src/lib/__tests__/useUnifiedSearchIndex.test.ts`
- Modify: `src/main.tsx` (replace the notes-only `initializeSearchIndex` boot block at lines 58-71 with the unified-search bootstrap)

**Approach:**
- Six `useLiveQuery(() => db.<table>.toArray(), [])` subscriptions.
- Per-table last-snapshot `Map<id, updatedAt>` kept in a ref; compare against the new snapshot to compute added/changed/removed ids.
- Debounce applied at the batch level (300ms trailing) so a bulk import doesn't fire six update calls per keystroke.
- `ready` flips to `true` after the first `Promise.allSettled` resolves (regardless of partial failures — graceful degradation).
- `search(query, opts)` delegates to `unifiedSearch.search()` but guards on `ready === false` (returns empty + quickly-resolving state).
- Bootstrap in `src/main.tsx`: `deferInit(async () => { const results = await Promise.allSettled([db.importedCourses.toArray(), ...]); const docs = results.flatMap(r => r.status === 'fulfilled' ? r.value : []); await initializeUnifiedSearch(docs); })`. Each rejected result logs `console.error('[unified-search] failed to index <entity>:', result.reason)`. Note: `Promise.allSettled` returns `{status: 'fulfilled', value}` or `{status: 'rejected', reason}` wrappers — never unpack with array destructuring directly.

**Execution note:** Test-first for the diff algorithm (Unit 3's novel complexity). Hook-level tests follow.

**Patterns to follow:**
- `src/hooks/useCourseAdapter.ts:22-35` — `useLiveQuery` pattern.
- `src/main.tsx:42-78` — `deferInit` usage and existing notes bootstrap (replace).
- `docs/engineering-patterns.md` → `useEffect` cleanup ignore-flag pattern.
- `docs/engineering-patterns.md` → fire-and-forget IndexedDB reads must be caught (surfaced via `console.error`, not swallowed).

**Test scenarios:**
- Happy path: initial mount → `ready` flips to `true` after all 6 tables resolve. `search('x')` returns results.
- Happy path: add a new course in Dexie → within 300ms, `search(courseName)` returns the new course. `tests/e2e/` asserts this via `page.evaluate` Dexie write.
- Happy path: update a course name → within 300ms, `search(oldName)` no longer returns it; `search(newName)` does.
- Happy path: delete a course → within 300ms, removed from index.
- Edge case: all six Dexie tables empty at boot → `ready === true`, `search('x')` returns empty array.
- Edge case: one table throws on `toArray()` (simulated mock) → `ready === true` still; error logged; other tables fully indexed; search works across the remaining 5 types.
- Edge case: rapid bulk import (500 courses inserted in 2s) → debounce prevents thrash; `search` returns consistent results once debounce settles; no dropped inserts.
- Error path: `updateInIndex` called with a doc id never indexed → does not throw (try/catch discard).
- Integration: `main.tsx` boot replaces the notes-only bootstrap; existing note search behavior (searching from palette) still works (R9 regression).

**Verification:**
- `src/lib/__tests__/useUnifiedSearchIndex.test.ts` green.
- R9 regression: existing note-search Playwright smoke still green.
- Manual smoke: import a course via the UI → within 1s, it appears in Cmd+K results.

---

- [ ] **Unit 4: Refactor per-page search inputs in Courses.tsx and Authors.tsx to use the shared index**

**Goal:** Replace the two substring filters with scoped calls to `unifiedSearch.search(query, { types: ['course' | 'author'] })`. Per-page inputs remain rendered and feel identical (same debounce behavior, same input placement), but quality improves to match the palette (typo tolerance, field boosts). Both ESLint save-time rules and design tokens are satisfied.

**Requirements:** R6, R9.

**Dependencies:** Unit 3 (needs the hook).

**Files:**
- Modify: `src/app/pages/Courses.tsx` (lines 31-38 state, 115-130 filter)
- Modify: `src/app/pages/Authors.tsx` (lines 49 + 58-65 filter)
- Test: `tests/e2e/per-page-search.spec.ts` (new Playwright spec covering both pages)

**Approach:**
- Courses.tsx: keep the existing 250ms debounced state. Replace the `.filter(c => c.name.toLowerCase().includes(q) || c.tags.some(...))` with a call to the hook's `search(q, { types: ['course'] })`. Map the returned `id`s back to `importedCourses` rows (the hook returns `storeFields`; lookup via a `Map<id, ImportedCourse>` built from the same source data).
- Authors.tsx: equivalent change for `types: ['author']`. Because `getMergedAuthors` is the source of truth for the Authors page (pre-seeded + imported), either (a) index only the imported set and accept that pre-seeded authors are palette-only for Story 1, or (b) extend Unit 1's `indexAuthors` step to consume `getMergedAuthors(storeAuthors)` instead of `db.authors.toArray()`. **Decision: (b)** — consistency with the page's own behavior matters; mismatch would be a regression.
- No UI copy changes. No styling changes beyond what shared search forces.
- ESLint: design-tokens and `react-hooks-async/async-cleanup` apply; verify locally before pushing.

**Execution note:** Start with a failing Playwright test asserting typo tolerance on each page's input (e.g., type "postgrs" into Courses input → Postgres course row appears); the current substring filter fails that test, which is the behavior change we want.

**Patterns to follow:**
- Existing 250ms debounce pattern in `Courses.tsx:31-38`.
- `docs/engineering-patterns.md` → `useEffect` cleanup.
- Silent-catch annotations if any catch is introduced.

**Test scenarios:**
- Happy path (Playwright): Courses page → type "postgres" → only course cards with "postgres" in name/tags render. Matches unified index output.
- Happy path (Playwright): Authors page → type "michael" → only authors with "michael" in name/specialties render.
- Edge case (Playwright): typo tolerance — "postgrs" on Courses → Postgres card appears. "michel" on Authors → Michael card appears. This is the delta vs current substring behavior.
- Edge case (Playwright): empty input → all courses/authors visible (today's behavior preserved).
- Edge case: very fast typing that exceeds debounce window → final value is the search value; no intermediate flicker.
- Integration (Playwright): same query typed into per-page input AND Cmd+K returns identical result set for the matching type (proves shared index).
- Regression (Playwright): existing non-search filters (topic chips, tabs) on both pages still work alongside the refactored input.

**Verification:**
- `tests/e2e/per-page-search.spec.ts` green.
- Manual smoke: type into Courses input → matches palette behavior.
- No ESLint errors on changed files.

## System-Wide Impact

- **Interaction graph:** The unified-search hook becomes a shared dependency of the palette, Courses.tsx, and Authors.tsx. Any future page (e.g., MyClass, Reports) can opt in by importing the hook. `src/main.tsx` boot sequence changes — the notes-only `initializeSearchIndex` call is replaced.
- **Error propagation:** Per-entity failures during index build are logged via `console.error` but do not block other entities (graceful degradation). Palette works with partial data. Navigation to a deleted entity surfaces a toast; the palette stays open and removes the stale row.
- **State lifecycle risks:** The MiniSearch instance is module-level — duplicated re-init would leak memory (hence the `initialized` guard pattern from `noteSearch.ts`). Module-level state must survive HMR; add an `import.meta.hot.dispose` safety if it becomes flaky.
- **API surface parity:** `noteSearch.ts` is deleted. Any other consumer of `searchNotes` / `searchNotesWithContext` must migrate to the unified API. Grep confirms the only caller is `SearchCommandPalette.tsx` — low risk.
- **Integration coverage:** Unit-test mocks can't fully prove `useLiveQuery` + incremental update + render. E2E tests cover the full loop (Dexie write → palette row appears).
- **Unchanged invariants:** Existing Cmd+K binding (Layout.tsx:342-346) and palette mount point (Layout.tsx:679) unchanged. Existing `CommandGroup` structure for Pages/quick actions preserved. Notes field config preserved verbatim (no regression in note search quality).

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Bundle regression — unified module larger than noteSearch.ts alone | Benchmark via `/review-story` pre-checks; must stay within 25% regression budget (project guardrail). MiniSearch is already a separate vendor chunk. |
| Combined index memory at 10k lessons | Origin §10 risk — hard NFR: <80MB, <500ms build. Benchmark with 1000 courses × 10 videos seed before merge. If fails: fall back to lazy-build lessons (defer to Story 2 decision). |
| HMR leaks module-level MiniSearch state | Add `import.meta.hot.dispose` if flaky during dev. Not an AC; quality-of-life. |
| cmdk 1.1.1 filter API shape differs from assumption | Deferred to implementation — read installed types. Either `filter={() => 1}` or `shouldFilter={false}`. |
| Mobile viewport Cmd+K is unavailable | AC 2 requires the existing header mobile icon works — already wired at Layout.tsx:522-533. |
| `useCourseStore` has lingering consumers we missed | Grep broadly for `useCourseStore` before Unit 4; the store is a no-op stub but if any page still imports its methods, those calls become no-ops (consistent with current behavior). |
| Authors page uses `getMergedAuthors` but palette indexes `db.authors` only | Resolved: Unit 4 extends Unit 1 to index `getMergedAuthors(storeAuthors)` instead of raw Dexie. |
| Regression in note search (R9) | Preserve note field config verbatim; Unit 1 tests include a note-specific regression case. |
| Bundle baseline drift from unrelated E92 branch | Branch Story 1 from main (not from the current E92-S08 branch) to get a clean baseline. |
| Playwright spec flakiness on debounce timing | Use deterministic time helpers per `.claude/rules/testing/test-patterns.md`; avoid raw `waitForTimeout`. |

## Documentation / Operational Notes

- New `docs/solutions/` entries expected on landing: "MiniSearch incremental updates via Dexie liveQuery", "cmdk global filter bypass gotchas", "requestIdleCallback Safari < 16.4 fallback behavior". These close the gap identified by the learnings researcher (empty corpus today).
- `docs/engineering-patterns.md`: add a "Unified Search Index" section cross-referencing this pattern for future similar work.
- README / CLAUDE.md: no change.
- Sprint tracking: **E117-S01** added to `docs/implementation-artifacts/sprint-status.yaml` under new Epic 117 (Global Search Upgrade). Story 1 of 3 (Story 2: ranking/frecency; Story 3: prefix filters + input removal).

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-global-search-upgrade-requirements.md](../brainstorms/2026-04-18-global-search-upgrade-requirements.md)
- **Parent plan:** `.claude/plans/https-www-youtube-com-watch-v-tdondbmynx-gleaming-frog.md` (Workstream A)
- Related brainstorm: [docs/brainstorms/2026-04-18-postgres-server-platform-requirements.md](../brainstorms/2026-04-18-postgres-server-platform-requirements.md) (future Epic 22 server-side search)
- Related code:
  - `src/lib/noteSearch.ts`
  - `src/app/components/figma/SearchCommandPalette.tsx`
  - `src/app/components/Layout.tsx`
  - `src/main.tsx`
  - `src/db/checkpoint.ts`
  - `src/lib/authors.ts`
  - `src/stores/useCourseStore.ts` (deprecated stub — do not read)
  - `src/hooks/useCourseAdapter.ts` (liveQuery reference)
  - `src/app/pages/Courses.tsx`, `src/app/pages/Authors.tsx`
- Related artifact: `docs/implementation-artifacts/31-1-add-catch-to-fire-and-forget-indexeddb-reads.md`
- Related solution: `docs/solutions/logic-errors/audiobook-cover-search-async-timing-2026-04-16.md`
- Project rules: `.claude/rules/automation.md`, `.claude/rules/testing/test-patterns.md`, `.claude/rules/workflows/story-workflow.md`
