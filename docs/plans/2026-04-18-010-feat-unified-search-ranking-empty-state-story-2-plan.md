---
title: "feat: Unified Search — Ranking & Empty State (E117-S02)"
type: feat
status: active
date: 2026-04-18
epic: E117
story: E117-S02
origin: docs/brainstorms/2026-04-18-global-search-upgrade-requirements.md
---

# Unified Search — Ranking & Empty State (E117-S02)

## Overview

Story 2 extends the unified search palette shipped in E117-S01 with three user-visible additions and one persistence layer:

1. **Empty-state view** rendered before any query is typed — a "Continue learning" row (up to 2 items drawn from in-progress courses and partially-read books) followed by a "Recently opened" row (up to 5 items from a localStorage recent list).
2. **Best Matches** section rendered above the fixed grouped sections on typed queries — top 3 cross-entity results ranked by MiniSearch relevance × frecency multiplier. Grouped sections visually dim items that also appear in Best Matches (dedup without removing).
3. **Fresh-install welcome copy** when both empty-state rows are empty.
4. **Persistence**: a new Dexie v53 `searchFrecency` table for `{entityType, entityId, openCount, lastOpenedAt}` counters, and a localStorage `knowlune.recentSearchHits.v1` array of the last 20 entries. Both are written on palette select AND on direct route navigation to an entity page.

Story 1's hook signature `{ ready, search(query, opts) }` is extended with a single `searchBestMatches(query, opts)` method. Empty-state state (Continue learning aggregate + Recently opened list) stays inside the palette component — not on the hook — so the existing per-page consumers (Courses.tsx, Authors.tsx, Notes.tsx) aren't coupled to frecency / route-visit re-renders.

## Problem Frame

Story 1 made the palette typo-tolerant and cross-entity but left three gaps flagged in the origin document (`docs/brainstorms/2026-04-18-global-search-upgrade-requirements.md` §5.1, §5.2, §6.2, §6.3):

- The palette has no state before the user types — Cmd+K opens to a nearly-empty shell (just static nav pages). Users have to remember what they were last working on.
- Grouped sections surface items alphabetically or by raw MiniSearch relevance only. A course the user opens every day isn't ranked above one they imported six months ago and forgot.
- Opening a course via a bookmark, sidebar, or direct URL doesn't contribute to ranking signals at all — frecency is only meaningful if "usage" is tracked consistently regardless of how a user reached the entity.

Story 2 closes all three by introducing persistent recency + frecency signals and a Best Matches surface that applies them, while keeping the grouped-section ordering predictable (pure relevance) so scan-reading isn't disrupted.

## Requirements Trace

From origin §7 Acceptance Criteria (Story 2 subset, ACs 14–20):

- R14 (AC 14): Empty-state shows "Continue learning" (up to 2 items) when qualifying items exist, sourced per §5.1 (in-progress courses + partially-read books, interleaved by recency).
- R15 (AC 15): Empty-state shows "Recently opened" (up to 5 items) from localStorage recent list.
- R16 (AC 16): Fresh-install state (no imports, no opens) shows welcome copy: "Start by importing a course or adding a book. Press Cmd+K anytime to search."
- R17 (AC 17): "Best Matches" section appears for typed queries, top 3 ranked by relevance × frecency per §6.2.
- R18 (AC 18): Frecency counters persist across app restarts via Dexie `searchFrecency` table (v53).
- R19 (AC 19): Writes to recent list AND frecency counters happen on palette select AND on direct route navigation.
- R20 (AC 20): v53 Dexie migration adds `searchFrecency` with correct indexes; migration is idempotent and tested (Dexie upgrade is a no-op for missing-table → create; re-running the upgrade path on an already-v53 DB does not error or duplicate rows).

Cross-cutting (from §5.2 dedup and §6.2 frecency-only-on-Best-Matches):

- R-dedup: Grouped sections visually dim (not remove) items that also appear in Best Matches; keyboard navigation still lands on either copy. Dimmed rows carry `aria-description="Also shown in Best Matches above"` so screen-reader users receive the equivalent of the sighted user's dimming cue (design-lens finding).
- R-frecency-scope: Grouped sections stay on pure MiniSearch relevance (no frecency) — only Best Matches applies the multiplier, which is explicitly capped at 2.0×.
- R-one-write-per-nav: Each navigation triggers exactly one `recordVisit` (palette-initiated navigations skip the route-mount effect via `__viaPalette` location state — scope-guardian finding on openCount inflation).

## Scope Boundaries

- **No type-prefix filters** (`c:`, `b:`, `l:`, `a:`, `n:`, `h:`) — Story 3.
- **No per-page input removal** — Story 3 (after measurement window).
- **No index persistence to IndexedDB.** The MiniSearch instance itself stays in memory. `searchFrecency` persists only the counters, not the index.
- **No new synced table.** `searchFrecency` is intentionally local-only: no `userId`, no `[userId+updatedAt]` index, not in the sync backfill list. The log is device-local signal and has no cross-device semantics.
- **No new MiniSearch corpus.** Story 2 does not touch the unified index shape or the Story 1 corpus — it only adds a ranking transform on top of `search()` results.
- **No denormalized "last course accessed" cache on `importedCourses`.** Continue learning derives the signal at query time from existing `db.progress` rows + `importedCourses.importedAt`. A cache is tempting but is premature; the query is at most "all progress rows for courses the user has touched" and runs only when the palette opens on an empty query.
- **No search analytics / history UI.** The recent list is internal; it does not surface as a history affordance.
- **No LRU eviction on `searchFrecency`.** Bounded naturally by library size (§6.3 rationale).
- **No Best Matches row virtualization.** Fixed cap of 3 rows.

### Deferred to Separate Tasks

- Prefix filters + per-page removal: Story 3 (new plan when Story 2 ships).
- Server-side search / semantic search: future Epic 22 candidate per `docs/planning-artifacts/epic-22-server-side-search-candidate.md`.
- Promotion of Story 2 patterns to `docs/engineering-patterns.md` and a solutions doc: part of Story 2's Documentation / Operational Notes but no separate plan needed.

## Context & Research

### Relevant Code and Patterns

- **`src/lib/unifiedSearch.ts`** — the single MiniSearch singleton + `search(query, opts)` surface. `SearchOptions` today takes `{ types?: EntityType[]; limit?: number }` and `UnifiedSearchResult` includes `{ score, displayTitle, subtitle, parentId, parentTitle, ... }`. Extension point for Best Matches: either add a new `searchBestMatches(query, opts)` helper or a new option on `search()`. Decision locked in Key Technical Decisions below.
- **`src/lib/useUnifiedSearchIndex.ts`** — the hook that wraps the singleton, surfaces `{ ready, search }`, and subscribes to Dexie live queries. Extension point: add a `recordVisit(entityType, entityId)` helper (or a separate `useFrecencyLog` hook) that writes to both the localStorage recent list and the Dexie frecency table. Stable closure semantics (`useMemo` ref-write pattern from the non-obvious-invariants doc §1) MUST be preserved — the Story 2 additions must not reintroduce the stale-ref race.
- **`src/app/components/figma/SearchCommandPalette.tsx`** — primary edit target for rendering. `groupedResults` useMemo at lines 202-220 groups by type. New structure: compute `bestMatches` and `groupedResults` from the same `search()` call, mark ids covered by Best Matches so grouped rendering can dim them. Empty-state rendering is currently just `<CommandEmpty>` at line 407; Story 2 replaces the empty path with the two empty-state sections (§5.1) + fresh-install welcome copy.
- **`src/lib/progress.ts`** — `getImportedCourseCompletionPercent(courseId, videoCount)` at lines 440-448 reads `db.progress` and returns the course-level completion %. Reuse this, paired with a parallel "most recent progress row in this course" query (derivable from `MAX(completedAt)` over the course's progress rows, fallback to `importedCourses.importedAt`). See Key Technical Decisions below.
- **`src/db/schema.ts:1387-1513`** — the v52 declaration + `.upgrade(async tx => ...)` pattern. Story 2's v53 declaration follows the same shape: a new `.version(53).stores({ searchFrecency: ... })` call appended *after* the v52 block, plus an empty `.upgrade()` (nothing to backfill — the table is new). The upgrade is inherently idempotent: Dexie only runs it on the version bump.
- **`src/db/checkpoint.ts:23,54-110`** — bump `CHECKPOINT_VERSION` to 53 and add `searchFrecency` to `CHECKPOINT_SCHEMA`. The `schema-checkpoint.test.ts` test then enforces parity between the incremental chain and the checkpoint — it will fail the PR if the two drift.
- **`src/db/__tests__/schema-checkpoint.test.ts`** — the parity test; update the `expectedTables` array and the version assertion.
- **`src/app/pages/BookReader.tsx:237-242`** — canonical "direct-navigation lastOpenedAt write" pattern (Dexie update + optimistic store update, `.catch(err => console.error(...))`). Model the `recordVisit()` call in route components on this.
- **`src/data/types.ts:226-234`** — `VideoProgress` has `completedAt` but **no `lastAccessedAt`**. Planning-time infrastructure correction (resolved): we derive course-level "last accessed" from `MAX(progress.updatedAt)` per course (stamped by `syncableWrite` on every row mutation after v52 — see `src/lib/sync/`). Fallback chain: `MAX(completedAt)` → `importedCourses.importedAt`. Earlier plan draft used `MAX(completedAt)` only, which feasibility + adversarial flagged as excluding every course a user has started but not yet taken a lesson past 90% on. `updatedAt` captures all touches.
- **`src/data/types.ts:732-763`** — `Book.lastOpenedAt` exists and is written by `BookReader.tsx`, `useAudiobookPositionSync.ts`, `useAudiobookshelfSocket.ts`, and `useBookStore.ts`. Use it as the book recency signal directly — no changes needed.
- **`src/app/routes.tsx`** — entity page paths for AC-19 direct-navigation write points:
  - Course: `/courses/:courseId` → `CourseOverview.tsx` (also `courses/:courseId/overview`)
  - Lesson: `/courses/:courseId/lessons/:lessonId` → `UnifiedLessonPlayer.tsx`
  - Book list + detail: `/library/:bookId` → `Library.tsx` (the palette's `handleResultSelect` navigates here for books, per `SearchCommandPalette.tsx:303`). Route-mount `recordVisit` MUST fire from `Library.tsx` gated on `useParams().bookId` — this is the common landing path, NOT `BookReader`.
  - Book reader: `/library/:bookId/read` → `BookReader.tsx`. Also fires `recordVisit` (users can deep-link to the reader bypassing the library list).
  - Author: `/authors/:authorId` → `AuthorProfile.tsx`
  - Note: reached via `/courses/:courseId/lessons/:lessonId?panel=notes` — note opens are recorded when the palette navigates to that query-param'd URL. Direct navigation to a note via UI is already implicit in opening the lesson, so we record it only from palette select (not from the query-param handler, to avoid double-counting).
  - Highlight: `/library/:bookId/read?sourceHighlightId=…` — recorded on palette select only, for the same reason.
- **`src/app/components/figma/SearchCommandPalette.tsx:282-351`** — `handleResultSelect`. This is where the palette-select write happens (one call to `recordVisit()` before navigate + close). **Story 2 also fixes the `'author'` existence check to validate against `getMergedAuthors(storeAuthors)` instead of raw `db.authors.get(result.id)`** — adversarial finding: pre-seeded authors (present in the merged projection but not in Dexie) were silently marked deleted, which is a latent Story 1 bug that Story 2's Recently-opened purge logic would amplify.
- **`docs/solutions/best-practices/unified-search-index-non-obvious-invariants-2026-04-18.md`** — the seven invariants Story 1 relies on. Specifically invariants §1 (useMemo ref-write), §2 (seed from `getIndexedIds`), §3 (don't array-destructure `Promise.allSettled`), §7 (separate `aria-live` settle delay) all apply to Story 2 code. Do not "refactor" away from these patterns when adding frecency.

### Institutional Learnings

- **`docs/solutions/best-practices/unified-search-index-non-obvious-invariants-2026-04-18.md`** (§1–§7): Story 2 must preserve every invariant. The `recordVisit` path is a new write path; it must not cause the hook's `ready` or `search` references to churn on every call (would thrash consumers). The frecency-multiplier transform must not re-sort or mutate the `UnifiedSearchResult` objects returned by `search()` — create new objects for Best Matches so grouped results (which use pure relevance) aren't poisoned.
- **`docs/solutions/logic-errors/audiobook-cover-search-async-timing-2026-04-16.md`**: Boot-time scatter-gather work must expose a real completion signal (`Promise.allSettled`), not a timer. Applied here only in the unlikely case the plan grows a background task (e.g., eagerly loading `searchFrecency` at boot for Best Matches). Current design does not require that: Best Matches reads the frecency table on-demand when the user types a query (one `db.searchFrecency.bulkGet(ids)` per search). Revisit only if that turns out to be a perceptible latency source.
- **`docs/engineering-patterns.md`**: `useEffect` cleanup ignore-flag pattern; silent-catch annotation rules (`// silent-catch-ok: <reason>`); Start Simple, Escalate If Needed (drives the "no denormalized cache for course recency" decision).

### External References

Not used. Story 1's local patterns (MiniSearch surface, Dexie migration shape, useLiveQuery reconcile, cmdk rendering) cover every Story 2 need. The one external reference in the origin document — Mozilla Places frecency formula (§13) — is already encoded in the origin's §6.2 formula and needs no fresh research.

## Key Technical Decisions

- **Frecency applies only to Best Matches.** Grouped sections stay on pure MiniSearch relevance. Rationale: stable grouped order means scan-reading doesn't shift between keystrokes or after an unrelated entity is opened. Best Matches is the "personalized" surface; grouped sections are the "exhaustive" surface.

- **Formula (origin §6.2, with explicit 2x cap — adversarial finding):** `finalScore = miniSearchScore × (1 + 0.5 × clamp((30 - daysSinceLastOpen) / 30, 0, 1) × min(log2(1 + openCount), 2))`. The `min(..., 2)` cap makes the "max multiplier ≈ 2.0" claim actually hold — raw `log2(1 + openCount)` grows unbounded (at openCount=7 it's 3, at 15 it's 4), which would produce runaway frecency and exactly the stale-bias failure mode the plan mitigates against. `daysSinceLastOpen` is `(now - lastOpenedAt) / 86_400_000`. The inner `log2` term is capped at 2 so the overall multiplier maxes at `1 + 0.5 × 1 × 2 = 2.0` (today + 3+ opens).

- **Two separate persistence structures** (origin §6.3, resolved):
  - Recent list → `localStorage` at key `knowlune.recentSearchHits.v1`. Last 20 entries. JSON array of `{type, id, openedAt}`. Cheap to read on palette open; small enough to not hit the LS quota on any plausible device.
  - Frecency counters → Dexie `searchFrecency` table. Keyed on `[entityType+entityId]`. Columns: `{entityType, entityId, openCount, lastOpenedAt}`. Primary-indexed on the compound key; secondary indexes on `entityType` (for any future filtering) and `lastOpenedAt` (for any future decay sweeps). No `userId` — local-only.
  - Rationale: LRU eviction on a single 20-entry list would destroy the frecency signal during bulk imports. Splitting preserves "what did you just touch" (recent) separately from "what do you touch a lot" (frecency).

- **Write path = one function, two structures.** `recordVisit(entityType, entityId)`:
  1. Reads the current recent list from LS; prepends `{type, id, openedAt: nowIso}`; deduplicates by `${type}:${id}` (keep newest); truncates to 20; writes back.
  2. In parallel, does `db.searchFrecency.get([entityType, entityId])` → compute `openCount = prev?.openCount + 1 ?? 1`, `lastOpenedAt = nowIso` → `db.searchFrecency.put({...})`. Errors logged, not swallowed.
  - Both writes are fire-and-forget from the caller's perspective but carry `.catch(err => console.error('[search-frecency] ...', err))` tails — consistent with the Story 1 "don't silently drop" rule.
  - The helper is idempotent on rapid double-calls (e.g., React StrictMode in dev): same `nowIso` bucket and `openCount` increment is fine; double-counting by 1 on a StrictMode render is harmless.

- **Keep the hook API minimal; palette owns empty-state state (review consensus — feasibility, scope-guardian, adversarial).** The hook's job is reactivity of the shared index; consumer-specific state belongs in the consumer. Concrete split:
  - **Hook (`useUnifiedSearchIndex`) adds only:** `searchBestMatches(q, opts)` — a stable `useCallback` that joins `search()` results against `db.searchFrecency.bulkGet(ids)` and applies the multiplier. No new `useLiveQuery` subscriptions added to the hook. No `recentHits` React state on the hook. No `continueLearning` on the hook. Return shape: `{ ready, search, searchBestMatches }`.
  - **Palette (`SearchCommandPalette`) owns:** `recentHits` (local `useState`, initialized from `getRecentHits()` and a `'storage'` event listener for cross-tab sync), `continueLearning` (computed via a one-shot `db.importedCourses.toArray() + db.progress.toArray() + db.books…` inside a `useEffect` gated on `open === true && debouncedQuery === ''`, cached for the open lifetime). The palette also calls `recordVisit(type, id)` in `handleResultSelect`, then updates local `recentHits` state optimistically.
  - **`recordVisit` is imported directly from `src/lib/searchFrecency.ts`** by (a) the palette's `handleResultSelect` and (b) each route-mount `useEffect` in Unit 5. No hook wrapping. Keeps the write path narrow and prevents a hook-level React state update from fanning out re-renders to every hook consumer (Courses.tsx, Authors.tsx, Notes.tsx).
  - Rationale: the earlier "extend the hook" design created a top-level `useLiveQuery(() => db.progress.toArray(), [])` that would re-fire on every video-playback tick, and placed `recentHits` React state on a hook mounted by multiple consumers — producing re-renders that had nothing to do with them. Both are fixed by keeping empty-state state inside the palette component.
  - Hook reference stability is unchanged from Story 1: `{ready, search, searchBestMatches}` memoized with `searchBestMatches` in a `useCallback` keyed only on `ready` (the underlying singleton is stable). No new deps; no stale-ref risk.

- **Continue learning data source (infrastructure correction — feasibility + adversarial findings):**
  - **Courses:** Enumerate `importedCourses`. For each, compute `completionPercent` via `getImportedCourseCompletionPercent` (already in `src/lib/progress.ts`). "In progress" is defined as having **any** progress row with `currentTime > 0` for the course (NOT `completionPercent > 0` — that requires a lesson to have crossed 90%, which misses users who have started but not completed any lesson). Filter `completionPercent < 100` (exclude fully completed).
  - **Course recency signal:** use `MAX(progress.updatedAt)` across the course's progress rows. `progress.updatedAt` is stamped on every `syncableWrite` (post-v52 foundation) — including intermediate scrubs, not just completions — so it's a far better recency proxy than `MAX(completedAt)`. Fallback chain if `updatedAt` is missing on legacy rows: `MAX(completedAt)` → `importedCourses.importedAt`.
  - **TypeScript type extension (feasibility correction — critic finding):** the `VideoProgress` interface in `src/data/types.ts:226-234` does NOT currently declare `updatedAt`, even though `syncableWrite` stamps it on the persisted Dexie row. Without a type declaration, TypeScript will treat `row.updatedAt` as `undefined` on every `VideoProgress[]` query result — causing the fallback chain (`MAX(completedAt) → importedAt`) to fire on every row and silently breaking recency ordering. **Required change as part of Unit 4:** add `updatedAt?: string // ISO 8601 — stamped by syncableWrite` to the `VideoProgress` interface. This is a pure type-level extension; no runtime behavior changes and no Dexie schema change (the column already exists on persisted rows). Do NOT use `as` casts at query sites — fix the type once, centrally.
  - **Books:** Dexie chain is explicit (adversarial finding on non-indexed post-filter): `db.books.where('lastOpenedAt').above('').reverse().filter(b => b.status !== 'finished' && b.status !== 'abandoned' && b.progress < 100).limit(10).toArray()`. Both `status === 'finished'` and `status === 'abandoned'` are excluded — neither belongs in "Continue learning" (scope-guardian finding: abandoned books are explicitly out). The `.filter()` step is documented as non-indexed post-filter; at projected scale (hundreds of books) it's fine, but if library size grows past 1000 books we'd add a compound index.
  - Merge: up to 2 items total, interleaved by recency (most recent first).
  - This runs as a one-shot `Promise.all` query from a palette-open effect, not a top-level `useLiveQuery` (scope-guardian + feasibility + adversarial finding converged on this: subscribing to `db.progress` at the hook level would re-fire on every video playback tick in every hook consumer, even when the palette is closed). Cost analysis: reading `db.importedCourses.toArray()` + `db.progress.toArray()` + the books chain above is bounded by library size. Benchmark at 1000 courses × 10 progress = 10k rows; if >100ms, cache the palette's first result and invalidate only on palette close (the effect already runs once per open).

- **Dedup between Best Matches and grouped sections:** visually dim, don't remove. Implementation: palette computes a `Set<string>` of `${type}:${id}` pairs in Best Matches, passes it to grouped rendering, grouped rows add a `data-in-best-matches` attribute + Tailwind class that drops opacity to ~55% and reduces the badge weight. Keyboard navigation still lands on the row. Rationale: removing duplicates from grouped would make section counts unstable ("Courses (3)" becoming "Courses (2)" after adding a filter would confuse users).

- **Fresh-install detection:** "both empty-state rows are empty" means: `continueLearning.length === 0 AND recentHits.length === 0`. The welcome copy replaces both rows with a centered block. Once either row has content, the welcome copy hides permanently (the "Recently opened" row stays populated from then on).

- **Dexie v53 migration shape:**
  - Append a new `database.version(53).stores({ searchFrecency: '[entityType+entityId], entityType, lastOpenedAt' })` after the v52 block in `src/db/schema.ts`.
  - Empty `.upgrade()` body (nothing to backfill — the table is new). Dexie's own version machinery guarantees idempotence: the upgrade runs exactly once per version bump.
  - Update `CHECKPOINT_VERSION` to 53 and add `searchFrecency` to `CHECKPOINT_SCHEMA` in `src/db/checkpoint.ts`.
  - Update `src/db/__tests__/schema-checkpoint.test.ts` `expectedTables` list and the version assertion.
  - `searchFrecency` is NOT in the sync-backfill list. Do NOT add it to `SYNCABLE_TABLES` — it stays local. (Adversarial review signal for future: if a future story wants to sync it, add `userId` + `[userId+updatedAt]` at that point, not now.)

- **Recent-list schema:** `Array<{type: EntityType, id: string, openedAt: string (ISO 8601)}>`. Length capped at 20. Version key in the LS key itself (`v1`) so a future schema change can bump to `v2` and gracefully ignore `v1`.

- **Corruption handling for the recent list:** on `JSON.parse` failure, log once and treat as empty — same pattern as `src/lib/progress.ts` legacy migration code (line 166-ish). A malformed LS entry should never crash the palette.

- **Deleted entities in recent list:** when the palette renders "Recently opened", each row is validated against the corresponding Dexie table (same pattern as `handleResultSelect` in Story 1). Stale entries are silently skipped and purged from the recent list on the next `recordVisit` call (natural garbage collection — no separate sweep needed). This is a small UX win for consistency with Story 1's AC-6 deleted-entity contract.

- **Best Matches section rendering:** fixed cap of 3 rows. Hidden when there are no matches (same pattern as grouped sections with zero hits in §5.2). Rendered as a distinct `<CommandGroup heading="Best Matches">` above the grouped sections.

- **Live-region announcement (invariant §7):** keep the 400ms settle delay from Story 1. Count the union of unique `${type}:${id}` keys across Best Matches + grouped sections (Best Matches is always drawn from the same underlying result set so unique-count is the right number, even when a Best Match would have fallen outside a grouped section's 5-row cap). Fixed rule — no fallback to grouped-only count (feasibility finding: the earlier "ambiguity fallback" left the ARIA contract under-specified).

## Open Questions

### Resolved During Planning

- **Q: `VideoProgress` has no `lastAccessedAt`. How does "Continue learning" sort courses by recency?** — Resolved: use `MAX(progress.updatedAt)` (stamped by `syncableWrite` on every progress write, including in-progress scrubs). Fallback chain: `MAX(completedAt)` → `importedCourses.importedAt`. The earlier "use `MAX(completedAt)` only" plan excluded in-progress-but-not-yet-completed courses — a common case — because `completedAt` is only set at 90% completion. `updatedAt` captures "was touched" regardless of completion state.
- **Q: Does `searchFrecency` carry `userId`?** — No. It's device-local signal, not synced. If we later decide it should sync, add `userId` + `[userId+updatedAt]` in that migration — not now.
- **Q: Should the recent list live in Dexie?** — No. Origin §6.3 and review finding ADV-03 explicitly split the two structures precisely because Dexie + LRU eviction would destroy the frecency signal. localStorage is the right tool for the 20-entry cap.
- **Q: Does the Best Matches section break keyboard navigation?** — No. It's a new `CommandGroup` rendered before the grouped sections. cmdk handles arrow navigation across groups via `data-value`. The Home/End handler from Story 1 (`handleCommandKeyDown`) already queries for all `[cmdk-item]` elements — it picks up Best Matches rows automatically.
- **Q: What's the extension shape for the hook?** — `searchBestMatches` as a new method rather than an opt-in option on `search()`. Rationale: the return shape is identical (`UnifiedSearchResult[]`) but the compute path is distinct (extra bulkGet + multiplier). A named method makes the intent legible at call sites and avoids an options-struct that mixes orthogonal concerns.
- **Q: Does `recordVisit` need to be debounced?** — No. A rapid double-navigate (e.g., router redirect chains) would double-count `openCount` by 1, which is harmless. The LS write is synchronous + cheap. The Dexie write is async but batching is not needed at expected volume (max a few writes per minute during active use).
- **Q: Where do the route-level `recordVisit` calls live?** — Inside a small `useEffect` in the relevant page components (`CourseOverview`, `UnifiedLessonPlayer`, `BookReader`, `AuthorProfile`). The effect depends on the entity id so it re-fires on route param change. Placed once per page at the top level (same shape as the existing `lastOpenedAt` writes in `BookReader.tsx`).
- **Q: Does Best Matches affect the `announcementText` count in the live region?** — Uses the unique-ids count (see Key Decisions). Announcements stay stable — the Best Matches addition doesn't inflate the screen-reader "N results" number.
- **Q: What happens if `db.searchFrecency.bulkGet` returns `undefined` entries?** — Treated as `{openCount: 0, lastOpenedAt: null}`. Formula with `null` lastOpenedAt: `daysSinceLastOpen → Infinity → clamp(-Inf, 0, 1) = 0`, so multiplier = 1 (pure MiniSearch score). That's the correct behavior for never-opened items.

### Deferred to Implementation

- **Whether `searchBestMatches` should pre-load all `searchFrecency` rows at boot for speed**, or fetch just the N result ids per query via `bulkGet`. Start with `bulkGet` (simpler, bounded by limit); revisit if the benchmark shows perceptible input lag at 5000+ frecency rows.
- **Whether `searchBestMatches` lives on the hook or as a standalone async util** (scope-guardian finding). Current plan: hook method. Flip to standalone util in `searchFrecency.ts` if the implementer sees the palette effect code and decides the util form is cleaner — behavior is identical, the decision doesn't affect any test assertion. Trust the implementer.
- **Exact Continue Learning row layout.** Plan specifies the data shape (`{title, subtitle?, completionPercent?, lastAt}`) but not the rendering. Default: mirror the grouped-section row layout (icon + title + subtitle + type badge) for visual consistency; append `completionPercent%` to the subtitle for course rows (e.g., `"3 of 12 lessons · 45%"`). Implementer + design-review agent settle the final spec.
- **Best Matches loading UX during async resolve.** Preferred: keep previous results visible until the new `searchBestMatches` promise resolves (avoids flicker on each keystroke). The `ignore`-flag cleanup pattern naturally supports this — don't `setBestMatches([])` on effect setup, only on empty query.
- **Recently Opened row timestamp.** Not rendered — title + type badge only. `openedAt` is stored for ordering, not display.
- **Exact Tailwind class combination for "dimmed" grouped rows.** Settle during implementation — options include `opacity-60`, `text-muted-foreground`, or a new `data-[in-best-matches=true]:opacity-60` selector. Whichever lands design review cleanly is fine.
- **Whether `Continue learning` caches its result for the palette-open lifetime.** If the benchmark shows >50ms on cold read, add a simple ref-based cache keyed on the open transition. Otherwise re-derive from the live queries on each palette open.
- **Whether to write a migration test that confirms v53 is a no-op upgrade from v52.** The `schema-checkpoint.test.ts` parity test already covers the "v53 matches checkpoint" invariant; an additional "upgrade from v52 → v53 does not error" test is useful but may be redundant. Decide at test-writing time.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Data flow

```text
                      ┌──────────────────────────────────────────────┐
  palette open        │ SearchCommandPalette.tsx (palette-owned      │
     ───▶             │   state: recentHits, continueLearning,       │
                      │   bestMatches, storage-event listener)       │
                      │                                              │
                      │  if open && query === '':                    │
                      │    effect: Promise.all([                     │
                      │      db.importedCourses.toArray(),           │
                      │      db.progress.toArray(),                  │
                      │      db.books.where('lastOpenedAt').above('') │
                      │        .reverse().filter(...)                │
                      │    ]) → setContinueLearning(...)             │
                      │    render <ContinueLearning> + <Recently>    │
                      │  else (typed query):                         │
                      │    effect: searchBestMatches(q, {limit:3})   │
                      │    render <BestMatches rows={bm} />          │
                      │    render <GroupedSections                   │
                      │       rows={grouped}                         │
                      │       dimIds={ids(bm)}                       │
                      │       bestMatchValuePrefix="bm:" />          │
                      └──────────────────────────────────────────────┘
                                 │              │
                                 │              └───▶ onSelect(r) ────────┐
                                 │                                         │
                                 ▼                                         ▼
                      ┌──────────────────────────┐    ┌──────────────────────────────────────┐
                      │ useUnifiedSearchIndex()  │    │ handleResultSelect(r):               │
                      │                          │    │  - existence check (authors use      │
                      │ { ready, search,         │    │    getMergedAuthors, others use Dexie)│
                      │   searchBestMatches }    │    │  - recordVisit(r.type, r.id)          │
                      │                          │    │  - setRecentHits(getRecentHits())     │
                      │ (no new state; no new    │    │  - navigate(path, {state:             │
                      │  live queries; hook      │    │     {__viaPalette: true}})            │
                      │  consumers unchanged)    │    └──────────────────────────────────────┘
                      └──────────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────────────────────────────┐
                      │ searchBestMatches(q, {limit}):               │
                      │   1) unifiedSearch(q, {limit: 50})           │
                      │   2) db.searchFrecency.bulkGet([[type,id]…]) │
                      │   3) applyFrecency (pure, in searchFrecency) │
                      │      multiplier = 1 + 0.5 × decay ×          │
                      │        min(log2(1+openCount), 2)             │
                      │      ↑ capped so max = 2.0, no runaway       │
                      │   4) sort desc, slice(limit=3)               │
                      └──────────────────────────────────────────────┘


 Entity page mount (direct nav) — Unit 5:
 ┌─────────────────────┐
 │ CourseOverview      │   useEffect(() => {
 │ UnifiedLessonPlayer │     if (!id) return;
 │ Library             │     if (location.state?.__viaPalette) return;
 │ BookReader          │     recordVisit(type, id);
 │ AuthorProfile       │   }, [id, location.state])
 └─────────────────────┘   ↑ skip-if-via-palette guard prevents
                              systematic openCount double-inflation.
```

### Dexie v53 migration (shape only)

```text
database
  .version(53)
  .stores({
    searchFrecency: '[entityType+entityId], entityType, lastOpenedAt',
  })
  .upgrade(async _tx => {
    // No backfill. Table is new. Upgrade is a no-op beyond the schema change.
  })
```

### Frecency formula (origin §6.2 verbatim)

```text
multiplier = 1 + 0.5 × clamp((30 - daysSinceLastOpen) / 30, 0, 1) × min(log2(1 + openCount), 2)
finalScore = miniSearchScore × multiplier
// Max = 2.0 exactly (opened today, 3+ opens — log2(1+3) = 2 hits the cap)
// When lastOpenedAt is null/missing: multiplier = 1 (pure MiniSearch score)
// Without the min() cap, log2(1+openCount) grows unbounded — a power user's
// top-opened item would dominate every Best Matches regardless of query.
```

## Implementation Units

- [ ] **Unit 1: Dexie v53 migration — add `searchFrecency` table**

**Goal:** Schema change only. One new table, empty upgrade body, checkpoint + tests updated. Zero code calls it yet.

**Requirements:** R18, R20.

**Dependencies:** None.

**Files:**
- Modify: `src/db/schema.ts` (append v53 after the v52 block; extend `ElearningDatabase` type with `searchFrecency: Table<FrecencyRow, [string, string]>`; define + export `FrecencyRow` interface so Unit 2 can import it; extract the v53 index string into a shared const `SEARCH_FRECENCY_INDEXES = '[entityType+entityId], entityType, lastOpenedAt'` so both `.stores()` and checkpoint reference the same literal — adversarial finding: prevents single-character drift between incremental and checkpoint)
- Modify: `src/db/checkpoint.ts` (bump `CHECKPOINT_VERSION` to 53, add `searchFrecency: SEARCH_FRECENCY_INDEXES` to `CHECKPOINT_SCHEMA` importing the shared const)
- Modify: `src/db/__tests__/schema-checkpoint.test.ts` (add `searchFrecency` to `expectedTables`, update version assertion)
- Test: `src/db/__tests__/schema.test.ts` (add a case asserting v53 upgrade from v52 succeeds and the table exists with the expected indexes)

**Approach:**

- **Type declarations (feasibility finding):** `db` is typed as `ElearningDatabase` (`src/db/schema.ts:77-131,153`) — a complete enumeration of tables. Any `db.searchFrecency.get/put/bulkGet` call from Unit 2+ fails to typecheck without this extension. Use Dexie's `Table<FrecencyRow, [string, string]>` (compound primary key), NOT `EntityTable<FrecencyRow, 'id'>` (which assumes a single-column `'id'` primary key — wrong shape here). Export `FrecencyRow` from `schema.ts` (or a shared `src/db/types.ts`) so `searchFrecency.ts` imports it from the canonical source.
- v53 `.stores({ searchFrecency: SEARCH_FRECENCY_INDEXES })`. Compound key `[entityType+entityId]` means a single row per entity; `put` has the right semantics. Secondary indexes on `entityType` and `lastOpenedAt` are defensive for future sweeps.
- `.upgrade(async _tx => {})` — no backfill. Document in a one-line inline comment that the empty body is intentional.
- Checkpoint update: `searchFrecency: SEARCH_FRECENCY_INDEXES` — the shared const guarantees the two declarations cannot drift.
- `schema-checkpoint.test.ts`: add `'searchFrecency'` to the sorted `expectedTables` array (insert alphabetically between `screenshots` and `shelves`); update `expect(CHECKPOINT_VERSION).toBe(52)` → `.toBe(53)`.
- **Do NOT** add `searchFrecency` to `SYNCABLE_TABLES_V52` in the v52 upgrade body (it's v53-only and local-only), and **do NOT** add `userId` or `[userId+updatedAt]` to its index string.

**Execution note:** Test-first. Write the schema-checkpoint test update first so the failing version assertion anchors the change.

**Patterns to follow:**
- `src/db/schema.ts:1387-1513` — the v52 block is the template. v53 is simpler (new table only).
- `src/db/checkpoint.ts:54-110` — alphabetical ordering of `CHECKPOINT_SCHEMA` keys.

**Test scenarios:**
- Happy path: `CHECKPOINT_VERSION === 53` after the change.
- Happy path: `CHECKPOINT_SCHEMA.searchFrecency === '[entityType+entityId], entityType, lastOpenedAt'`.
- Happy path (parity test): full migration chain DB and checkpoint DB both expose a `searchFrecency` table with identical primary key + indexes.
- Happy path (upgrade test): a v52 DB opened with the v53 schema runs the upgrade, ends at version 53, `searchFrecency` table is queryable, is empty.
- Happy path: `db.searchFrecency.put({entityType: 'course', entityId: 'c1', openCount: 1, lastOpenedAt: nowIso})` then `db.searchFrecency.get(['course', 'c1'])` returns the row.
- Edge case: `put` with identical compound key overwrites (doesn't duplicate).
- Edge case: query `db.searchFrecency.where('entityType').equals('book').toArray()` returns only books.
- Integration: schema-checkpoint parity test still passes (existing test guards against drift).

**Verification:**
- `npm run test:unit -- schema-checkpoint` passes.
- `npm run test:unit -- schema` passes including the new v52 → v53 case.

---

- [ ] **Unit 2: `recordVisit` + recent-list / frecency persistence layer**

**Goal:** A pair of tightly-scoped helpers that write both persistence structures in a single call. Extract into a new module so hook extension (Unit 3) and route-level writes (Unit 6) share the same implementation.

**Requirements:** R18, R19.

**Dependencies:** Unit 1.

**Files:**
- Create: `src/lib/searchFrecency.ts` — exports: `recordVisit`, `getRecentHits`, `applyFrecency`, `RECENT_LIST_KEY = 'knowlune.recentSearchHits.v1'`, `RECENT_LIST_MAX = 20`, types `RecentHit` and `FrecencyRow`. (Note: `getFrecencyCounter` and `loadRecentListFromStorage` were removed — scope-guardian finding: `getFrecencyCounter` had no caller beyond its own self-referential test, and `loadRecentListFromStorage` duplicated `getRecentHits`. One function per concern.)
- Create: `src/lib/__tests__/searchFrecency.test.ts`
- Reference: `src/app/pages/BookReader.tsx:237-242` (error-logging pattern for Dexie writes)

**Approach:**

- `recordVisit(entityType, entityId)`:
  1. `const nowIso = new Date().toISOString()`
  2. LS side: read current list, prepend `{type, id, openedAt: nowIso}`, dedup by `${type}:${id}` (first occurrence wins = newest), slice to 20, `localStorage.setItem(RECENT_LIST_KEY, JSON.stringify(list))`.
  3. Dexie side — wrap in a transaction to serialize concurrent RMW (feasibility finding on lost-update race):
     ```ts
     await db.transaction('rw', db.searchFrecency, async () => {
       const prev = await db.searchFrecency.get([entityType, entityId]);
       await db.searchFrecency.put({
         entityType, entityId,
         openCount: (prev?.openCount ?? 0) + 1,
         lastOpenedAt: nowIso,
       });
     }).catch(err => console.error('[search-frecency] put failed for %s:%s', entityType, entityId, err));
     ```
     Without the transaction, two concurrent calls on the same key both read `prev.openCount = N`, each put `N+1`, and the second overwrites the first — silently dropping one increment. The transaction serializes them so two calls produce `N+2`.
- `getRecentHits(): RecentHit[]` — read LS, `JSON.parse` within try/catch, return `[]` on corruption + log once. Defensive shape-validation: filter entries that don't have `{type: string, id: string, openedAt: string}` so a half-migrated v1 blob can't break rendering.
- `applyFrecency(results, frecencyMap, nowMs)` — pure helper, lives here rather than in `unifiedSearch.ts` (scope-guardian finding: keeping the pure index module persistence-free). See Unit 3 for scenarios.
- Types (exported from this module):
  - `interface RecentHit { type: EntityType; id: string; openedAt: string }`
  - `interface FrecencyRow { entityType: EntityType; entityId: string; openCount: number; lastOpenedAt: string }` — imported by `src/db/schema.ts`'s `ElearningDatabase` type declaration (Unit 1).
- No module-level state. Each call is self-contained. `recentHits` React state lives in `SearchCommandPalette` (Unit 4), not here.
- **Reset/clear hook (critic finding — requirement removed):** the original plan directed a `clearSearchFrecency()` call into `src/lib/importService.ts`, but that file only exports `importFullData` and has no clear-all flow. The actual clear-all is `resetAllData()` in `src/lib/settings.ts:244-252`, which already calls `db.delete()` (full DB drop including `searchFrecency`) + `localStorage.clear()` (wipes `knowlune.recentSearchHits.v1`). Both concerns are fully addressed. **Do NOT export `clearSearchFrecency()` and do NOT modify `importService.ts` or `settings.ts`.** Stale-row-from-reused-entity-id is a real concern only for partial resets, which do not exist in the codebase today — defer to a future story if such a flow is added.

**Execution note:** Test-first for the LS side (deterministic, easy to isolate). Dexie side uses `fake-indexeddb/auto` via the existing test setup.

**Patterns to follow:**
- `src/app/pages/BookReader.tsx:237-242` — Dexie update + `.catch(console.error)` tail.
- `src/lib/progress.ts:158-176` — LS read with try/catch + migration fallback (analogous to corruption handling).
- `.claude/rules/automation.md` → `error-handling/no-silent-catch` — every catch carries a `// silent-catch-ok:` annotation OR a visible log. We use visible logs.

**Test scenarios:**
- Happy path (LS): first call adds an entry to an empty list. `getRecentHits()` returns `[{type, id, openedAt}]`.
- Happy path (LS): second call for a different entity prepends; list order is newest-first.
- Happy path (LS, dedup): calling `recordVisit('course', 'c1')` twice with different `openedAt` results in a single entry at the top with the newer `openedAt`.
- Happy path (LS, cap): 21 distinct calls leave exactly 20 entries; oldest is dropped.
- Happy path (Dexie): first call creates a row with `openCount: 1`.
- Happy path (Dexie): second call for same entity increments to `openCount: 2`, updates `lastOpenedAt`.
- Happy path (Dexie, concurrency): two concurrent `recordVisit` calls for the same entity (Promise.all) produce `openCount: 2` — the transaction serializes the RMW so the second call sees the first's increment. Without the transaction this test fails (drops to `openCount: 1`).
- ~~Happy path (`clearSearchFrecency`)~~: REMOVED per critic finding. `resetAllData()` in `src/lib/settings.ts` already handles the clear path via `db.delete()` + `localStorage.clear()` — no new test needed. If a partial-reset flow is added in a future story, add a test then.
- Edge case (LS corruption): `localStorage.setItem(RECENT_LIST_KEY, '{not-json')`; `getRecentHits()` returns `[]` + one console warning; `recordVisit` still succeeds and writes a fresh list.
- Edge case (LS parse succeeds but shape wrong): `setItem(..., '[{"bogus":1}]')`; `getRecentHits()` filters to valid-shape entries (defensive cast) or returns `[]`. Document whichever decision is made.
- Edge case (Dexie unavailable): mock `db.searchFrecency.put` to reject; `recordVisit` logs the error via `console.error`; does not throw to caller.
- Edge case (rapid same-entity double call): two `recordVisit('course', 'c1')` in immediate succession produce `openCount: 2` (not 3, not 1); the two LS writes collapse to one entry at the top (last writer wins).
- Error path: `recordVisit` called with empty-string id does not throw; a no-op is acceptable (document). Rationale: defensive against route components that fire before `useParams` resolves.
- Integration: `getFrecencyCounter` returns the exact row written by `recordVisit`.

**Verification:**
- `src/lib/__tests__/searchFrecency.test.ts` passes.
- No ESLint violations (`error-handling/no-silent-catch`, design tokens N/A — pure logic module).

---

- [ ] **Unit 3: Extend `useUnifiedSearchIndex` with `searchBestMatches` only + add `applyFrecency` helper**

**Goal:** Add exactly one new method to the hook (`searchBestMatches`) and one new pure helper (`applyFrecency`) in the frecency module. Do NOT add Continue Learning, Recent Hits, or `recordVisit` to the hook — those are palette-component concerns owned in Unit 4. This keeps Courses.tsx / Authors.tsx / Notes.tsx (other hook consumers) insulated from frecency/visit-write re-renders.

**Requirements:** R17.

**Dependencies:** Unit 1, Unit 2.

**Files:**
- Modify: `src/lib/useUnifiedSearchIndex.ts` — add `searchBestMatches` to the return; no new live queries; no new React state.
- Modify: `src/lib/searchFrecency.ts` — add the `applyFrecency` pure helper here (it imports `FrecencyRow` from this module, so this is its natural home — `unifiedSearch.ts` stays persistence-free per scope boundary "No new MiniSearch corpus").
- Modify: `src/lib/unifiedSearch.ts` — **no change.** (Earlier plan had placed `applyFrecency` here; scope-guardian correctly flagged that would couple the pure index module to persistence.)
- Test: `src/lib/__tests__/searchFrecency.test.ts` — extend with `applyFrecency` cases.
- Test: `src/lib/__tests__/useUnifiedSearchIndex.test.ts` — extend with `searchBestMatches` cases.

**Approach:**
- `applyFrecency(results, frecencyMap, nowMs)` in `src/lib/searchFrecency.ts`:
  - Inputs: `UnifiedSearchResult[]`, `Map<string, FrecencyRow>` keyed by `${type}:${id}`, and `nowMs`.
  - For each result, look up frecency by `${r.type}:${r.id}`; compute `daysSinceLastOpen = lastOpenedAt ? (nowMs - Date.parse(lastOpenedAt)) / 86_400_000 : Infinity`; compute the multiplier per the §6.2 formula **including the `min(log2(1+openCount), 2)` cap**; return a new array with `{...r, score: r.score * multiplier}` — never mutate the input (assert this in tests).
  - Pure function, no IO, fully isolable.
- `searchBestMatches(query, opts?)` in the hook:
  - Signature: `(query: string, opts?: { limit?: number; poolSize?: number }) => Promise<UnifiedSearchResult[]>`.
  - Body: call `unifiedSearch(query, { limit: opts?.poolSize ?? 50 })`; `bulkGet` frecency rows keyed by `[r.type, r.id]`; build the `frecencyMap`; call `applyFrecency(..., Date.now())`; sort desc by score; slice `opts?.limit ?? 3`.
  - Empty-query short-circuit: return `[]` before any IO.
  - Wrapped in `useCallback` with `[ready]` as the only dep; the singleton is stable, so identity holds across all re-renders where `ready` hasn't changed.
- **Hook return shape after Unit 3:** `{ ready, search, searchBestMatches }`. Memoized `useMemo` keyed on `[ready]`. No added state. No added live queries. No `recordVisit` / `recentHits` / `continueLearning` fields.
- **Do NOT** add frecency to the main `search()` path. Grouped sections stay on pure relevance (R-frecency-scope).
- Preserve Story 1 invariants (`docs/solutions/best-practices/unified-search-index-non-obvious-invariants-2026-04-18.md`):
  - §1 (useMemo render-phase ref writes): no change.
  - §3 (don't destructure `allSettled`): N/A in Unit 3 — no parallel IO added.
  - Memoization: `searchBestMatches` in `useCallback([ready])`; hook return `useMemo([ready])`. Both stable.

**Execution note:** Test-first for `applyFrecency` (pure; isolated; trivially testable). Dexie-backed test for `searchBestMatches` ordering (with `fake-indexeddb/auto`). No hook-level state tests — Continue Learning / Recent Hits moved to Unit 4 (palette-owned).

**Patterns to follow:**
- `src/lib/useUnifiedSearchIndex.ts:138-244` — existing hook shape; keep the `useMemo([ready])` pattern identical, only adding `searchBestMatches` to the returned object.
- `docs/solutions/best-practices/unified-search-index-non-obvious-invariants-2026-04-18.md` §1, §3 — invariants to preserve.
- `src/lib/progress.ts:440-448` — `getImportedCourseCompletionPercent` math (referenced by Unit 4's palette-owned Continue Learning, not by Unit 3).

**Test scenarios for `applyFrecency` (pure helper):**
- Happy path: `score: 10`, `lastOpenedAt = today`, `openCount = 3` → `finalScore = 20` (hits 2.0 cap: `1 + 0.5 × 1 × min(log2(4), 2) = 2.0`).
- Edge case: `score: 10`, `lastOpenedAt = today`, `openCount = 1000` → `finalScore = 20` (cap holds; no runaway).
- Happy path: result not in `frecencyMap` → unchanged score (multiplier = 1).
- Edge case: `lastOpenedAt = 31 days ago` + `openCount = 10` → multiplier = 1 (decay clamps to 0).
- Edge case: `openCount = 0` → multiplier = 1 (log2(1) = 0).
- Edge case: `frecencyMap` entry with `lastOpenedAt: null` or undefined → multiplier = 1.
- Invariant: input array is not mutated (assert same object references in the input still carry the original score after the call).

**Test scenarios for `searchBestMatches` (hook method):**
- Happy path: seed 3 courses; `searchFrecency` pre-populated so course A has 3 opens today, B has 1 open today, C has no frecency row. `searchBestMatches('shared-term', {limit: 3})` returns `[A, B, C]` in that order.
- Happy path: `{limit: 1}` returns `[A]`.
- Edge case: empty query → `[]`, and `bulkGet` is NOT called (assert via spy).
- Edge case: frecency table empty → order matches pure MiniSearch relevance (every multiplier = 1).
- Edge case: `ready === false` → returns `[]` synchronously; no IO.
- Integration: `searchBestMatches` reference identity is stable across renders where `ready` hasn't changed (assert via ref-capture in a test wrapper). Avoids thrashing the palette's own memos.
- Regression: Story 1 hook tests still pass — `ready`, `search`, reconcile semantics unchanged by Unit 3.

**Verification:**
- `npm run test:unit -- useUnifiedSearchIndex` green.
- `npm run test:unit -- unifiedSearch` green (including new `applyFrecency` cases).

---

- [ ] **Unit 4: Palette rendering — Best Matches section + empty-state view + dedup dimming**

**Goal:** Wire the hook's new fields into `SearchCommandPalette.tsx`. Add Best Matches `CommandGroup` above grouped sections on typed queries; render Continue Learning + Recently Opened + fresh-install welcome on empty query; dim grouped rows that also appear in Best Matches. Call `recordVisit` from `handleResultSelect`.

**Requirements:** R14, R15, R16, R17, R-dedup.

**Dependencies:** Unit 3.

**Files:**
- Modify: `src/app/components/figma/SearchCommandPalette.tsx`
- Modify: `src/app/components/figma/__tests__/SearchCommandPalette.test.tsx` (extend with Story 2 cases)
- Modify: `src/data/types.ts` — add `updatedAt?: string // ISO 8601 — stamped by syncableWrite` to `VideoProgress` interface (critic finding; enables `MAX(progress.updatedAt)` course recency to compile without casts)
- Test: `tests/e2e/search-palette-empty-state.spec.ts` (new Playwright spec — covers R14, R15, R16)
- Test: `tests/e2e/search-palette-best-matches.spec.ts` (new Playwright spec — covers R17, R-dedup)

**Approach:**

- Destructure hook: `const { ready, search, searchBestMatches } = useUnifiedSearchIndex()`. (No `recordVisit` / `recentHits` / `continueLearning` on the hook — palette owns them.)
- **Palette-owned state:**
  - `const [recentHits, setRecentHits] = useState<RecentHit[]>(() => getRecentHits())` — synchronous LS read on mount.
  - A `window.addEventListener('storage', ...)` effect that re-reads `getRecentHits()` when another tab writes to `knowlune.recentSearchHits.v1` (cross-tab sync — adversarial finding on dual-source-of-truth race).
  - `const [continueLearning, setContinueLearning] = useState<ContinueLearningItem[] | undefined>(undefined)` — initially `undefined` to distinguish "still loading" from "empty".
  - A `useEffect` gated on `open === true && debouncedQuery === ''` that does a one-shot `Promise.all([db.importedCourses.toArray(), db.progress.toArray(), db.books.where('lastOpenedAt').above('').reverse().toArray()])` (see data-source rules in Key Technical Decisions), aggregates in-memory, and calls `setContinueLearning(...)`. Cached for the palette's open lifetime (effect runs once per open).
- **Best Matches:** `const [bestMatches, setBestMatches] = useState<UnifiedSearchResult[]>([])`. An effect keyed on `debouncedQuery` that clears on empty, else awaits `searchBestMatches(q, {limit: 3})` and calls `setBestMatches`. Use an `ignore` flag in the cleanup (engineering-patterns `useEffect` cleanup) — this is critical to prevent a slow in-flight request from overwriting the state of a newer keystroke.
- Compute `bestMatchIds = useMemo(() => new Set(bestMatches.map(r => \`${r.type}:${r.id}\`)), [bestMatches])`.
- Rendering order on typed query: `<CommandGroup heading="Best Matches">` (only if `bestMatches.length > 0`), then existing grouped sections, then Pages.
- **Dedup — distinct cmdk values (adversarial finding on duplicate `value` collision):** Best Matches rows use `value={bm:${type}:${id}}`; grouped rows keep `value={${type}:${id}}`. This gives cmdk two distinct items for keyboard nav (both are reachable via ArrowDown). Grouped rows whose `${type}:${id}` is in `bestMatchIds` additionally carry `data-in-best-matches="true"` + the dimmed visual class AND an `aria-description="Also shown in Best Matches above"` so screen-reader users get the semantic context sighted users do (design-lens finding).
- **Dimming style (design-lens finding on WCAG contrast):** dimmed rows apply `text-muted-foreground` on the title + `opacity` unchanged (no opacity modifier). `text-muted-foreground` is a theme token with pre-computed WCAG-AA contrast in both light and dark themes; stacking an `opacity-*` modifier on top of OKLCH-computed colors would produce unpredictable contrast ratios per theme and is an anti-pattern. The type badge on a dimmed row drops to `bg-muted text-muted-foreground` (already the `note` badge class — reuses an existing token). Locked choice, not deferred.
- Rendering on empty query:
  - If `continueLearning === undefined`: render `<Pages>` group only (no welcome copy, no empty-state sections — avoids the flash-of-welcome before Dexie resolves). This is the intentional loading state.
  - If `continueLearning.length > 0`: `<CommandGroup heading="Continue learning">` with up to 2 rows. Each row's `onSelect` calls a shared `navigateToEntity(type, id)` helper that calls `recordVisit` then navigates.
  - If `recentHits.length > 0`: `<CommandGroup heading="Recently opened">` with up to 5 rows. Each row validates against Dexie before navigating (reuse `handleResultSelect` existence check); stale entries are omitted from render AND purged from the local `recentHits` state (which writes back to LS via `setRecentHits` + an effect).
  - If `continueLearning.length === 0` AND `recentHits.length === 0` (not undefined): render a `<div>` with the welcome copy (R16). Use `text-muted-foreground` + center alignment. Suppress the `Pages` group when welcome copy shows (adversarial finding: nine nav items contradict the "nothing here yet" welcome message).
  - In all loaded states with either section present: render the `Pages` group below.
- `handleResultSelect`: after the existence check passes, call `recordVisit(result.type, result.id)` (imported from `src/lib/searchFrecency.ts`), then `setRecentHits(getRecentHits())` (re-read LS for optimistic update), then `navigate(path)`.
- **Palette-select vs route-mount double-fire (scope-guardian finding on systematic openCount inflation):** pass a transient "came from palette" signal via `navigate(path, { state: { __viaPalette: true } })`. The route-mount `useEffect` in Unit 5 reads `useLocation().state?.__viaPalette` and skips `recordVisit` when true. Resets to normal behavior on next navigation. This prevents every palette-selected navigation from double-counting openCount.
- Live-region announcement: `totalResults` counts the union of unique `${type}:${id}` across Best Matches + grouped (Best Matches are always a subset of the broader result set, so unique count is the right number).
- Preserve invariant §7: the 400ms settle delay for `announcedCount` stays unchanged.

**Execution note:** Failing Playwright first (empty-state visible + Best Matches with seeded frecency). Unit-level render tests follow.

**Technical design:** *(decision matrix for empty-state branching)*

| `continueLearning` | `recentHits` | Render |
|---|---|---|
| `undefined` (loading) | any | Pages only (suppress empty-state until Dexie resolves — prevents welcome-copy flash) |
| `[]` | `[]` | Welcome copy (Pages suppressed — welcome message conflicts with a 9-item nav list) |
| `[a]` | `[]` | Continue learning + Pages |
| `[]` | `[a, b]` | Recently opened + Pages |
| `[a, b]` | `[c, d]` | Continue learning + Recently opened + Pages |

**Patterns to follow:**
- `src/app/components/figma/SearchCommandPalette.tsx:282-351` — `handleResultSelect` existence-check pattern (reused for Recently-opened stale entries).
- `src/app/components/figma/SearchCommandPalette.tsx:228-243` — 400ms settle delay for `aria-live` (invariant §7).
- `docs/engineering-patterns.md` — `useEffect` ignore-flag cleanup for the async `searchBestMatches` effect.
- `src/app/components/figma/SearchCommandPalette.tsx:44-75` — `SECTION_ORDER`, `TYPE_BADGE_LABEL`, `TYPE_BADGE_CLASS` — reuse for Best Matches rows (badges identical to grouped rows).
- `.claude/rules/styling.md` — design tokens only. `text-muted-foreground`, `bg-muted`, etc. for the welcome copy.

**Test scenarios:**

- Happy path (unit): open palette with no query, `continueLearning = [course-a]`, `recentHits = []` → renders `Continue learning` heading + one row + `Pages` group.
- Happy path (unit): open palette with no query, both empty → renders welcome copy with the exact text from R16; `Pages` group suppressed.
- Edge case (unit): `continueLearning === undefined` (still loading) + any `recentHits` → renders `Pages` group only; no empty-state sections; no welcome copy (prevents flash).
- Happy path (unit): typed query with `bestMatches.length > 0` → renders `Best Matches` heading with up to 3 rows; grouped sections render unchanged below.
- Happy path (unit): dimming — a course in `bestMatches` and also in grouped Courses → the grouped row has `data-in-best-matches="true"`, the dimmed class, AND `aria-description="Also shown in Best Matches above"`.
- Happy path (unit): cmdk value uniqueness — the Best Matches row has `value="bm:course:<id>"`; the grouped row has `value="course:<id>"`. Distinct values so cmdk treats them as separate selectable items.
- Happy path (unit): keyboard ArrowDown from first Best Matches row visits each subsequent item including the dimmed duplicate (assert `data-selected` cycles through both).
- Edge case (unit): typed query returns 0 Best Matches but 3 grouped hits → no Best Matches heading rendered.
- Edge case (unit): `recentHits` contains an entry whose Dexie row was deleted (and for authors: not present in `getMergedAuthors()` either) → row is omitted from render AND purged from LS via optimistic `setRecentHits`.
- Edge case (unit): `recentHits` contains a pre-seeded author (not in `db.authors` but in `getMergedAuthors()`) → row renders and is NOT purged. Locks down the Story 1 latent-bug fix.
- Error path (unit): `searchBestMatches` rejects (simulated) → Best Matches state stays `[]`, palette does not crash, console.error logged.
- Error path (unit): in-flight `searchBestMatches` for query "foo" is superseded by a new query "bar" before resolving → the `ignore` flag in the cleanup drops the stale result; only "bar" results render.
- Integration (Playwright): fresh-install state — clear Dexie + LS, open palette, query empty → welcome copy visible (`data-testid` assertion); no Pages group visible.
- Integration (Playwright): record 3 visits to different entities, close/reopen palette → Recently opened shows 3 rows in correct order.
- Integration (Playwright): record 6 visits → Recently opened shows 5 rows (cap).
- Integration (Playwright): seed a course with `progress.currentTime > 0` but `completionPercentage < 90` on every lesson → Continue learning shows that course (using `updatedAt` as the recency signal, NOT `completedAt`).
- Integration (Playwright): seed a course with completionPercentage 30–80% on one lesson → Continue learning shows that course.
- Integration (Playwright): Best Matches ranking — seed `searchFrecency` so course A has 3 opens today, B has 1, both matching the query → A above B in Best Matches.
- Integration (Playwright): Best Matches multiplier caps at 2x — seed 1000 opens for course A vs 3 opens for B, both matching → finalScore ratio stays bounded; A not runaway-dominant.
- Integration (Playwright): dedup — a course in Best Matches also appears (dimmed) in grouped Courses; keyboard ArrowDown visits both copies.
- Integration (Playwright): palette-select navigates + `recordVisit` runs once (not twice) — assert `searchFrecency.openCount = 1` after a single palette-initiated navigation (route-mount effect skipped via `__viaPalette` location state).
- Integration (Playwright): cross-tab sync — open two tabs, `recordVisit` in tab A, open palette in tab B → Recently opened reflects the new entry (via `storage` event listener).
- Integration (axe): palette with empty-state rendered — no axe violations; dimmed rows expose `aria-description` to screen readers.
- Regression (Playwright): Story 1 smoke spec still passes — typo tolerance, grouped sections, deleted-entity fallback.

**Verification:**
- `tests/e2e/search-palette-empty-state.spec.ts` green.
- `tests/e2e/search-palette-best-matches.spec.ts` green.
- Unit tests green.
- Manual smoke at 375px, 768px, and 1440px viewports (tablet 768px is the ambiguous in-between that project design-review rules require — design-lens finding).

---

- [ ] **Unit 5: Route-level `recordVisit` calls for direct-navigation (AC 19)**

**Goal:** Fire `recordVisit` from the top of each entity page's component when the entity id changes. This closes AC-19 ("writes happen on palette select AND on direct route navigation").

**Requirements:** R19.

**Dependencies:** Unit 2 (uses `recordVisit` from `src/lib/searchFrecency.ts` directly — no need to funnel through the hook; this avoids coupling page mounts to the hook lifecycle). Unit 5 should land after Unit 4 because the `__viaPalette` location-state flag that Unit 5 reads is set by Unit 4's `handleResultSelect`.

**Files:**
- Modify: `src/app/pages/CourseOverview.tsx` — add route-mount `recordVisit` effect at the top.
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx` — same for `(lessonId)`, type `'lesson'`. One write per lesson view — don't double-fire when video position changes.
- Modify: `src/app/pages/Library.tsx` — add a `recordVisit('book', bookId)` effect gated on `useParams().bookId` being truthy. Rationale (feasibility + adversarial finding): the palette's own `handleResultSelect` for books sets `path = /library/${result.id}` which routes to `LibraryPage` (not `BookReader`), and direct URL/sidebar links to `/library/:bookId` also land here. Without this, AC-19's direct-navigation contract is silently broken for the most common book route.
- Modify: `src/app/pages/BookReader.tsx` — also add `recordVisit('book', bookId)` for the `/library/:bookId/read` path. (Users can deep-link straight to the reader; capturing both landing routes ensures AC-19 coverage regardless of entry point. Idempotent with Unit 4's skip-if-via-palette logic below.)
- Modify: `src/app/pages/AuthorProfile.tsx` — same for `(authorId)`, type `'author'`.
- Test: `tests/e2e/search-frecency-direct-navigation.spec.ts` — new spec asserting that a direct URL navigation writes to both LS and Dexie.

**Approach:**

- One `useEffect` per page, gated on a truthy id AND on `useLocation().state?.__viaPalette !== true` (palette-initiated navigation already called `recordVisit` in `handleResultSelect` — skipping here prevents systematic openCount inflation per scope-guardian finding).
- **Author existence check for Recently-opened and handleResultSelect must use `getMergedAuthors()`, not raw `db.authors` (adversarial finding):** pre-seeded authors are not present in `db.authors` but are renderable via `AuthorProfile`. Update `handleResultSelect` for the `'author'` case in Unit 4 to call `getMergedAuthors(storeAuthors).find(a => a.id === result.id)` and compare against that set. Same check is used to filter stale entries from `recentHits` render. Without this fix, every pre-seeded-author row would be classified as "deleted" and purged on the next `recordVisit`.
- Deliberately *not* adding write points for Note or Highlight page visits — notes and highlights are reached via lesson/book routes, and the parent route's write is sufficient for "did they interact with this area." Recording notes/highlights on direct nav would require URL-param sniffing that isn't worth the complexity (origin §5.1 and review decision — notes/highlights are palette-select-only for frecency).
- Import `recordVisit` directly from `src/lib/searchFrecency.ts`, not via the hook. Rationale: these pages don't need the full hook (no `search`, no reconcile); importing the helper keeps the dependency narrow.
- No cleanup function needed — `recordVisit` is fire-and-forget.
- Effect id-gate: skip when the entity id is `undefined` (router first render) OR when the URL is a 404 pattern like `/courses/undefined` that React Router can still match (defensive).

**Execution note:** Start with a failing Playwright test that navigates to `/courses/:id` directly (bypassing the palette) and asserts the LS recent list contains `{type: 'course', id: ':id'}` afterwards.

**Patterns to follow:**
- `src/app/pages/BookReader.tsx:237-242` — existing `lastOpenedAt` write is the template. Add `recordVisit` above or next to it.
- `docs/engineering-patterns.md` — `useEffect` ignore-flag is not strictly needed here (fire-and-forget, idempotent), but add if a sync linter flags it.

**Test scenarios:**
- Happy path (Playwright): open `/courses/course-a` directly → LS recent list contains one entry for `course-a`.
- Happy path (Playwright): open `/library/book-a` directly → LS recent list contains `book-a`; Dexie `searchFrecency` row exists with `openCount: 1` (write fires from `Library.tsx`, not `BookReader.tsx`).
- Happy path (Playwright): open `/library/book-a/read` directly → same row now at `openCount: 2` (second write fires from `BookReader.tsx` since this is a distinct direct navigation).
- Happy path (Playwright): navigate `/courses/a` → `/courses/b` → `/courses/a` → recent list newest-first is `[a, b, a]` deduped to `[a, b]` (a bumped back to top).
- Happy path (Playwright): open `/authors/author-a` → `searchFrecency` row exists for `('author', 'author-a')`.
- Happy path (Playwright): open the same course twice in two separate session (close tab, reopen) → `searchFrecency.openCount === 2`.
- Critical (Playwright): palette-select → `handleResultSelect` records visit, passes `state: { __viaPalette: true }` to navigate, route mounts → Unit 5 effect reads location state, skips recordVisit. Assert `searchFrecency.openCount === 1` after exactly one palette-select (no double-count).
- Critical (Playwright): direct URL bar → `/courses/course-a` — `__viaPalette` is absent in location state, effect fires, `openCount === 1`. Combined with the palette test above, both AC-19 paths are covered without double-counting.
- Edge case (Playwright): pre-seeded author `/authors/pre-seeded-1` → recent list entry persists across palette open/close cycles (not purged by the existence-check fix in Unit 4).
- Edge case: navigate to `/courses/undefined` (bad route) → effect gate skips, no write.
- Edge case: router renders with id first, then updates — effect fires once per unique id, not per render.
- Regression (Playwright): existing `lastOpenedAt` write on `/library/:id/read` still works (don't break the book reader).

**Verification:**
- `tests/e2e/search-frecency-direct-navigation.spec.ts` green.
- Manual smoke: open a course via sidebar → close Cmd+K palette → reopen → Recently opened shows the course at the top.

---

- [ ] **Unit 6: Seed helpers + Playwright e2e coverage tuning**

**Goal:** Make Story 2 e2e specs reliable and deterministic. Add any missing seed helpers (frecency rows, recent-list entries) so tests aren't implementation-dependent. Ensure deterministic time handling per `.claude/rules/testing/test-patterns.md` so the 30-day decay math doesn't flake.

**Requirements:** R14, R15, R17, R19 (test infrastructure only; no production code).

**Dependencies:** Units 4, 5.

**Files:**
- Modify or Create: `tests/helpers/seedSearchFrecency.ts` (wraps `page.evaluate` Dexie writes + LS writes for test setup).
- Modify: `tests/e2e/search-palette-empty-state.spec.ts` and `search-palette-best-matches.spec.ts` to use the helpers.
- Modify: `src/test/setup.ts` (only if a `requestIdleCallback` polyfill is still needed — inherited from Story 1, no change expected).

**Approach:**
- Add `seedRecentList(page, entries)` and `seedFrecency(page, rows)` helpers that run a single `page.evaluate` each. Keep them in `tests/helpers/` following existing conventions.
- For the 30-day decay math: use the deterministic `FIXED_DATE` helper from `.claude/rules/testing/test-patterns.md` (ESLint `test-patterns/deterministic-time` will flag any raw `Date.now()` or `new Date()`).
- All `waitForTimeout` usages require justification comments per ESLint `test-patterns/no-hard-waits` — prefer `expect(...).toBeVisible()` and event-based waits.
- No virtual time library needed; the frecency formula handles fixed-date inputs cleanly.

**Execution note:** Stand this unit up alongside Unit 4 if the specs there flake. If they don't flake, this unit is lightweight (just extracting helpers). The goal is to lock determinism before the first CI run, not after.

**Patterns to follow:**
- `.claude/rules/testing/test-patterns.md` — FIXED_DATE, IndexedDB seeding via `page.evaluate`, deterministic time.
- `.claude/rules/testing/test-cleanup.md` — Playwright context isolation for Dexie state.
- Existing `tests/helpers/` modules (if present) for naming conventions.

**Test scenarios:**
*Test expectation: none — infrastructure-only unit. All behavioral coverage lives in Units 1–5 specs.*

**Verification:**
- All Story 2 e2e specs pass on 10 consecutive runs (burn-in per `.claude/rules/workflows/story-workflow.md`).

## System-Wide Impact

- **Interaction graph:**
  - The unified-search hook gains exactly one new return field: `searchBestMatches`. Story 1 consumers (`Courses.tsx`, `Authors.tsx`, `Notes.tsx`) destructure only what they need — no re-render fanout from frecency/visit writes. `recentHits` and `continueLearning` live inside `SearchCommandPalette` as local state.
  - Five entity page components gain a `recordVisit` call gated on `__viaPalette` location state: `CourseOverview`, `UnifiedLessonPlayer`, `Library` (new — for `/library/:bookId`), `BookReader` (for `/library/:bookId/read`), `AuthorProfile`. Zero UI change; only a new side effect.
  - ~~`src/lib/importService.ts` gains a `clearSearchFrecency()` call~~ — REMOVED per critic finding. `resetAllData()` in `src/lib/settings.ts` already handles clear via `db.delete()` + `localStorage.clear()`. No modification to `importService.ts` or `settings.ts`.
  - The palette's rendering tree gains a Best Matches section (typed queries), two empty-state sections (empty query), a welcome block, and a `storage` event subscription. No changes to the existing grouped rendering logic beyond a per-row `data-in-best-matches` attribute + `aria-description` on dimmed rows.
- **Error propagation:** `recordVisit` failures are logged but never propagated — missing a recency write must never block navigation. `searchBestMatches` failures degrade gracefully to an empty Best Matches section; the palette still renders grouped results. Corrupt recent list → treated as empty (one log, proceed).
- **State lifecycle risks:**
  - `searchFrecency` can grow unboundedly in theory (one row per entity the user ever opens). In practice, bounded by library size. Adversarial: if a test or script synthetically opens 100k entities, `bulkGet` may become slow. Mitigation: the production path reads at most `limit: 50` rows per search, not the full table. Revisit if library sizes ever exceed 5k entities.
  - LS recent list is capped at 20 entries × ~80 bytes each = ~1.6KB. Safe.
  - Hook reference stability: `searchBestMatches` and `recordVisit` MUST be memoized via `useCallback` with stable deps. If they change identity per render, the palette's `useEffect`s will thrash. Test asserts this invariant.
- **API surface parity:** no public API exported from the codebase changes. `useUnifiedSearchIndex` gains fields (additive). `src/lib/unifiedSearch.ts` gains `applyFrecency` and possibly a `searchBestMatchesCore` helper — both exported for testability, both pure.
- **Integration coverage:** The `recordVisit` write path crosses LS + Dexie + React state. Unit mocks can't prove all three stay consistent; e2e tests cover the round trip (navigate → record → close palette → reopen → Recently opened shows entry).
- **Unchanged invariants:**
  - Story 1 `search()` semantics: same query → same pure-relevance results. Best Matches computes on top, does not replace.
  - Story 1 grouped-section ordering: fixed (Courses → Books → Lessons → Notes → Highlights → Authors). Not affected by frecency.
  - Story 1 ARIA contract: `role="listbox"`, `role="option"`, `aria-live="polite"`, 400ms settle delay — all preserved. New sections inherit `CommandGroup` / `CommandItem` roles from cmdk.
  - Story 1 Cmd+K binding, mobile trigger, full-screen sheet styling — unchanged.
  - Story 1 non-obvious invariants (`docs/solutions/best-practices/unified-search-index-non-obvious-invariants-2026-04-18.md` §1–§7) — all preserved; no refactor of the reconcile layer.
  - `schema-checkpoint.test.ts` parity — maintained by updating both sides together in Unit 1.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Best Matches latency adds perceptible lag to each keystroke | `searchBestMatches` runs on a debounced query (inherits the palette's 150ms debounce). `bulkGet` is bounded by `limit: 50`. If latency shows up in the performance benchmark, pre-load the frecency table into an in-memory map at boot (deferred decision — see Open Questions). |
| `recordVisit` Dexie write fails during a burst (storage quota) | `.catch(console.error)`; no user-visible failure. Navigation proceeds. |
| LS recent list gets corrupted by an extension or another tab | `try/catch` around `JSON.parse`; treat as empty; log once; `recordVisit` continues with a fresh list. |
| v53 migration drift between incremental chain and checkpoint | `schema-checkpoint.test.ts` catches it. Story 1 already relies on this guard. |
| Invariant regression — someone "simplifies" the ref/memo pattern in Unit 3 | Comment in-place + the solutions doc already calls this out. Code review gate. |
| Dedup dimming reduces discoverability | A dimmed row is still visible + keyboard-navigable (data-attribute + opacity reduction, not `display: none`). Tested in the e2e spec. |
| `VideoProgress` has no `lastAccessedAt` — course recency needed for Continue Learning | Use `MAX(progress.updatedAt)` (stamped by `syncableWrite` on every row write, including scrubs). Fallback: `MAX(completedAt)` → `importedCourses.importedAt`. Adding `lastAccessedAt` to VideoProgress as a new column is out of scope (sync-relevant migration). |
| Hook-level `useLiveQuery(db.progress.toArray(), [])` would re-fire on every video playback tick in every hook consumer | Addressed in Unit 3 + Unit 4: Continue Learning lives inside SearchCommandPalette as a one-shot `Promise.all` query gated on `open === true && debouncedQuery === ''`. Hook return is just `{ready, search, searchBestMatches}` — no new live subscriptions. |
| Fresh-install welcome copy flashes briefly on users whose state is still loading | Addressed in Unit 4: `continueLearning` initial state is `undefined` (not `[]`); while loading, the palette renders the `Pages` group only. Welcome copy renders only when `continueLearning === []` AND `recentHits === []` (both definitively resolved empty). No flash, no blank-palette gap. |
| Cross-tab recentHits drift (multi-tab users see stale Recently opened) | Addressed in Unit 4: palette subscribes to `window 'storage'` events for the recent-list key and re-reads `getRecentHits()` when another tab writes. Tests assert cross-tab sync. |
| Palette scroll / touch-target sizing regressions from the new sections | Units 4 Playwright specs include 375px viewport assertions; `min-h-[44px]` class reused from Story 1 for all new rows. Design review agent will also validate. |
| Bundle size regression from the new `applyFrecency` + persistence module | Small (~2KB gzipped estimated). `/review-story` bundle analysis will flag if over the 25% budget (project guardrail). MiniSearch is already vendored separately. |
| `searchFrecency` unintentionally synced in a future sync-story change | Documented in Scope Boundaries + the v53 migration comment. If any future syncable-tables change considers including it, the reviewer must note that sync for a local-signal table is a behavioral change (device-specific ranking becomes shared). |
| Race: `recordVisit` fires from palette select AND from the page mount `useEffect` | Addressed in Unit 4 + Unit 5: palette's `handleResultSelect` passes `{state: {__viaPalette: true}}` to `navigate`; Unit 5 route-mount effects read `useLocation().state?.__viaPalette` and skip when true. Result: exactly one `recordVisit` per navigation regardless of path (palette, sidebar, URL, etc.). Without this guard, every palette-initiated navigation systematically inflates `openCount` — scope-guardian finding showed this would produce ~34% multiplier distortion for the primary use case. |
| Concurrent `recordVisit` lost-update race (RMW without transaction) | Addressed in Unit 2: both branches (Dexie put + LS write) now run inside `db.transaction('rw', db.searchFrecency, async () => {...})` which serializes concurrent calls on the same compound key. Two simultaneous calls produce `openCount: N+2`, not `N+1`. Test coverage explicitly asserts this. |
| `searchFrecency` accumulates rows for deleted entities after library resets | Already handled by existing `resetAllData()` in `src/lib/settings.ts` — `db.delete()` drops all tables including `searchFrecency`, and `localStorage.clear()` wipes the recent list. No code change needed. Partial-reset scenarios (not currently in codebase) deferred to future story. |
| cmdk 1.1.1 keyboard nav breaks when Best Matches + grouped sections carry the same `value` attribute | Addressed in Unit 4: Best Matches rows use `value="bm:${type}:${id}"`, grouped rows keep `value="${type}:${id}"`. Distinct values so cmdk treats them as separate selectable items. Playwright test asserts ArrowDown visits both copies. |
| Pre-seeded authors get falsely purged from Recently-opened as "deleted" (Story 1 latent bug) | Addressed in Unit 4: `handleResultSelect` and recent-list existence check validate via `getMergedAuthors(storeAuthors)` instead of raw `db.authors`. Story 1 invariant §5 explicitly calls this out as the canonical author corpus. |
| Best Matches multiplier runaway — formula as written grows unbounded via `log2(1+openCount)` | Addressed in Key Technical Decisions + Unit 3 scenarios: explicit `min(log2(1+openCount), 2)` cap so multiplier stops at 2.0 (today + 3+ opens). Tests assert `openCount = 1000` yields same score as `openCount = 3`. Without the cap, the "stale bias" risk below is not actually mitigated. |
| Playwright determinism around the 30-day decay | FIXED_DATE per `.claude/rules/testing/test-patterns.md`; specs seed frecency rows with absolute timestamps relative to FIXED_DATE. No real-time arithmetic in tests. |

## Documentation / Operational Notes

- **Sprint status:** (a) immediately before Story 2 kickoff, flip `117-1-unified-search-index: in-progress` → `done` — Story 1 is merged on `main` (PR #350, commits 1e1e2887..86cfc0f6); this is a drift correction that should land before Story 2 work begins so the tracker reflects reality; (b) on Story 2 kickoff, flip `117-2-ranking-frecency-empty-state: backlog` → `in-progress`; (c) on Story 2 merge, flip → `done`. Coherence finding: the original wording bundled both flips at merge time, which is inconsistent with Story 1 being complete now.
- **Solutions doc:** on merge, append a Story 2 section to `docs/solutions/best-practices/unified-search-index-non-obvious-invariants-2026-04-18.md` with any new invariants discovered during Story 2 implementation (specifically: frecency applied only to Best Matches, not to `search()`; `recordVisit` reference identity stability; fresh-install detection semantics). If the additions are substantive, split into a sibling solutions doc; otherwise extend in place.
- **Engineering patterns:** add a small subsection to `docs/engineering-patterns.md` referencing the "persistence helper + hook + route-mount effect" pattern for any future feature that needs similar "track usage across palette selects AND direct navigation" semantics.
- **No README / CLAUDE.md change.**
- **PR description:** link the brainstorm, Story 1 plan, and this plan. Include a screenshot of the empty-state + Best Matches for the design-review agent.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-global-search-upgrade-requirements.md](../brainstorms/2026-04-18-global-search-upgrade-requirements.md)
- **Story 1 plan:** [docs/plans/2026-04-18-009-feat-unified-search-index-story-1-plan.md](./2026-04-18-009-feat-unified-search-index-story-1-plan.md)
- **Story 1 non-obvious invariants:** [docs/solutions/best-practices/unified-search-index-non-obvious-invariants-2026-04-18.md](../solutions/best-practices/unified-search-index-non-obvious-invariants-2026-04-18.md)
- **Parent plan:** `.claude/plans/https-www-youtube-com-watch-v-tdondbmynx-gleaming-frog.md` (Workstream A)
- Related code:
  - `src/lib/unifiedSearch.ts` — MiniSearch singleton + `SearchOptions` surface
  - `src/lib/useUnifiedSearchIndex.ts` — hook extended in Unit 3
  - `src/app/components/figma/SearchCommandPalette.tsx` — rendering edit target
  - `src/db/schema.ts`, `src/db/checkpoint.ts`, `src/db/__tests__/schema-checkpoint.test.ts` — v53 migration
  - `src/lib/progress.ts` — `getImportedCourseCompletionPercent` reused; `CourseProgress` localStorage for legacy courses (not Story 2's source)
  - `src/data/types.ts` — `VideoProgress`, `Book`, `ImportedCourse` types
  - `src/app/pages/CourseOverview.tsx`, `UnifiedLessonPlayer.tsx`, `BookReader.tsx`, `AuthorProfile.tsx` — route-mount `recordVisit` sites
- Project rules: `.claude/rules/automation.md`, `.claude/rules/testing/test-patterns.md`, `.claude/rules/testing/test-cleanup.md`, `.claude/rules/styling.md`, `.claude/rules/workflows/story-workflow.md`, `.claude/rules/workflows/design-review.md`
- Sprint status entry: `docs/implementation-artifacts/sprint-status.yaml` → `117-2-ranking-frecency-empty-state`
