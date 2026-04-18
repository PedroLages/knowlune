# Requirements: Global Search Upgrade (Unified CommandPalette)

**Date:** 2026-04-18 (revised after document-review)
**Status:** Requirements captured — ready for `/ce-plan`
**Scope:** 3 sequential stories (see §2.1)
**Upstream context:** [.claude/plans reference](../../../../Users/pedro/.claude/plans/https-www-youtube-com-watch-v-tdondbmynx-gleaming-frog.md) — Workstream A from the "Postgres transcript insights" plan.

**Revision history:**
- v1 (2026-04-18 initial): single-story scope.
- v2 (2026-04-18 post-review): split into 3 stories, corrected infrastructure mismatches found in review (lessons source, course progress source, existing palette behavior, highlight search, cmdk filter collision, mobile trigger).

---

## 1. Problem

Knowlune search has four concrete gaps:

1. **Missing entities.** `SearchCommandPalette` (Cmd+K) indexes Notes, Book Highlights, and the *legacy static* `Course` store (`useCourseStore` — seed data). User-imported content in `importedCourses` + `importedVideos` is not indexed. Authors and Books are not indexed at all.
2. **Shallow matching.** The palette uses cmdk's default substring `commandFilter` (SearchCommandPalette.tsx:177-183) for pages/courses/lessons, not MiniSearch. Notes use MiniSearch (via `noteSearch.ts`) with fuzzy=0.2; everything else is plain substring. Book Highlights search is a linear table scan with `String.includes` and limit(5).
3. **Parallel UX.** `Courses.tsx:118-123` and `Authors.tsx:59-65` run their own in-page substring filters. No ranking, no typo tolerance, no shared infrastructure with the palette.
4. **No cross-entity ranking.** Finding "all the things about Postgres" across courses, books, lessons, notes, and highlights requires visiting multiple pages or scanning multiple groups in the current palette.

## 2. Goal

Ship a unified, typo-tolerant, ranked search across all major Knowlune entities, accessible via Cmd+K on desktop and a visible header search icon on mobile/touch, matching the hybrid UX pattern validated by Linear, Notion, and Slack (see §13 research).

### 2.1 Delivery split (3 stories, sequential)

Document-review flagged that the full scope is too large for one PR. Split:

| Story | Scope | Delivers |
|---|---|---|
| **Story 1 — Unified Index** | §4 (all 6 entities in one MiniSearch instance), §5.2 grouped sections only, §6.1 indexing strategy, §6.4 local-only, §6.6 cmdk filter bypass, §6.7 infrastructure corrections, mobile header trigger. **Keeps per-page search on Courses/Authors** (they share the same MiniSearch instance, so quality improves but inputs stay). | Core user value: one palette that finds all entities with typo tolerance and field-boosted ranking. |
| **Story 2 — Ranking & Empty State** | §5.1 empty state (Continue learning + Recently opened), §5.2 Best Matches section, §6.2 ranking formula, §6.3 recency/frecency log. | Frecency-weighted surfacing of recent items; empty-state guidance before any query is typed. |
| **Story 3 — Power-User & Per-Page Cleanup** | §5.3 prefix filters, §5.4 per-page input removal (after 2-week measurement window), any polish. | Power-user scoping; codebase de-duplication once palette has proven itself. |

Each story ships as its own PR with its own review cycle. Story 2 depends on Story 1. Story 3 depends on Story 2 and on a measurement observation from Story 1.

## 3. Users & Value

**Primary user:** Pedro (solo learner), and eventual Knowlune users with dozens to hundreds of courses and thousands of lessons/notes.

**Value:**
- Single known entry point for every "where is my X" query.
- Typo-tolerant (misremembering a title doesn't block recall).
- Frecency-weighted (recently-used items surface first) — Story 2.
- Cross-entity discovery (typing a topic surfaces the course, the book, the lesson, and the note at once).

## 4. In-Scope Entities (all 3 stories)

The palette must index and return matches from all six entity types in a **single combined MiniSearch instance** with a `type` discriminator field (decision: resolves review finding F-05 — avoids per-entity singleton proliferation and makes cross-entity scoring tractable for Best Matches in Story 2).

| Entity | Source (VERIFIED AGAINST CODEBASE) | Indexed fields (with boosts) |
|---|---|---|
| Courses | `importedCourses` Dexie table (NOT `useCourseStore` legacy static data) + merged pre-seeded courses where `getMergedCourses` exists | `name` (3x), `tags` (2x), `source` |
| Authors | `authors` Dexie table + pre-seeded authors from `getMergedAuthors` (reconcile both sources — review finding) | `name` (3x), `specialties` (2x) |
| Lessons | `importedVideos` Dexie table (separate table keyed by `courseId`; has `filename`, NOT `title` — review finding). Join course name at index time. | `filename` (3x), parent course `name` (1.5x) |
| Books | `books` Dexie table | `title` (3x), `author` (2x), `series` |
| Notes | `notes` Dexie table (reuse existing `noteSearch.ts` field config — don't regress prefix/fuzzy settings) | `content`, `tags` (2x), `courseName` (1.5x), `videoTitle` |
| Book Highlights | `bookHighlights` Dexie table — **upgrade from current substring-only `textAnchor.includes()` to MiniSearch typo-tolerant matching** | `textAnchor` (3x), parent book `title` (1.5x) |

Every index entry stores enough context (`id`, entity type, parent refs) to build a jump-to-route on selection.

**Legacy `useCourseStore` behavior:** This store holds static seed data that predates the imported-course pipeline. Story 1 switches the palette's course/lesson source to `importedCourses` + `importedVideos`. The legacy store is NOT indexed.

## 5. UX Requirements

### 5.1 Empty-state view (Story 2)

Two sections, in order:

1. **Continue learning** — up to 2 total items:
   - Courses: join `importedCourses` with aggregated `progress` rows (progress table keyed by `[courseId+videoId]`) to compute course-level percent-complete; include where 0 < percent < 100, sorted by most recent `progress.lastAccessedAt`. **Review finding:** `importedCourses` has no `progress` column; progress is derived. Story 2 must compute this at query time or pre-aggregate.
   - Books: `books` where `lastOpenedAt IS NOT NULL` AND book is not fully read, sorted by `lastOpenedAt`.
   - Merged set: up to 2 items total, interleaved by recency.
2. **Recently opened** — last 5 items across all entity types, ordered by recency. Backed by the recency log (§6.3).

**Fresh-install state (review finding — unspecified):** If both sections are empty (no imports, no opens), palette shows a welcome block: "Start by importing a course or adding a book. Press Cmd+K anytime to search."

### 5.2 Typed-query view (hybrid layout — Stories 1 + 2)

**Story 1 ships grouped sections only** (no Best Matches). Best Matches lands in Story 2 with frecency.

1. **Best Matches** section (Story 2) — top 3 results across all entity types, ordered by combined score (MiniSearch relevance × frecency multiplier per §6.2). Each row shows the title + a small type badge.
2. **Grouped sections** (Story 1), in this fixed order:
   - Courses
   - Books
   - Lessons
   - Notes
   - Book Highlights
   - Authors

   **Ordering rationale (review finding F10):** Mirrors how users encounter content in their own learning flow — content containers (courses, books) → atomic content (lessons, notes, highlights) → attribution (authors). Authors last because author name is rarely the primary search intent; it surfaces via course/book rows via boosts.
3. Each grouped section capped at 5 visible results; hidden remainder surfaced via a "Show all N" row that expands inline (see §5.2.1 for states).
4. Sections with zero matches for the current query are hidden entirely.
5. **Dedup policy (Story 2, review finding):** Best Matches and grouped sections may show the same item. Grouped section visually dims items already shown in Best Matches to indicate they're the same; keyboard nav can still land on either. (Rationale: removing duplicates from grouped would make section counts unstable and harder to scan.)

#### 5.2.1 Interaction states (review finding — unspecified)

- **Index building**: If user opens palette before `requestIdleCallback` fires, show empty-state sections (recency, welcome) immediately. Trigger index build inline. Show a subtle "Indexing your library…" hint until ready. No spinner blocking the UI.
- **Index ready, empty query**: Show §5.1 empty state.
- **Index ready, query typed, zero results**: Show "No results for '{query}'. Try fewer characters." plus recency section as fallback. If in scoped mode, also offer "Clear filter" affordance.
- **"Show all N" expansion**: In-place expand (no palette resize); expanded section becomes scrollable (max-height clamped to 40% of palette); sibling sections stay visible; collapse control replaces the "Show all" row.
- **Index error**: If MiniSearch throws on an entity, that entity type is removed from results for the session (graceful degradation) — other entities remain functional. Logged to console; not user-visible.

### 5.3 Type-prefix filters (Story 3)

Typing a prefix scopes the palette to a single entity type:

| Prefix | Scope |
|---|---|
| `c:` | Courses |
| `b:` | Books |
| `l:` | Lessons |
| `a:` | Authors |
| `n:` | Notes |
| `h:` | Book Highlights |

**Parsing rules (review finding ADV-06 — collision with literal content):**
- Prefix must appear at position 0 of the query, followed by a single colon, followed by at least one space OR at least one non-space character.
- After parse, render a visible pill/chip in the input showing the active scope (e.g., `[Courses] postgres`), and the prefix text is removed from the query. Backspacing the chip removes the scope.
- If a user types a literal string that starts with `c:` (e.g., a note title "C: The Language"), the chip pattern + Backspace exit provides an escape path. For raw content search including the prefix characters, users type a space first (`" c:..."`).
- Empty scoped query (`c:` alone, no content): show all matching items in that entity type, capped at 50 with "Show all" expand (no virtualization required below 50 — review finding ADV-09).

**Discoverability (review finding F05):** Palette empty state shows a hint row: "Tip: type `c:`, `b:`, `l:`, `a:`, `n:`, or `h:` to filter by type." Hint row dismissible (remembered in localStorage).

### 5.4 Per-page filter removal (Story 3, with caveats)

- **Story 1 keeps** per-page search inputs on `Courses.tsx` and `Authors.tsx`, but refactors them to share the same unified MiniSearch instance (so quality improves — typo tolerance, ranking — even before palette removal).
- **Story 3 removes** inputs only after a 2-week observation window (review finding: don't bundle workflow change with infrastructure change):
  - Measurement: if the user reports they stopped using the per-page inputs OR telemetry shows < 1 usage/week, proceed with removal.
  - Replacement: each page gets a visible "Search" button in the page header that opens the palette pre-scoped (`c:` or `a:` respectively).

## 6. Technical Requirements

These are high-level technical constraints. Detailed implementation is the planner's job.

### 6.1 Indexing strategy — eager background build (Story 1)

- On app boot, schedule index construction via `requestIdleCallback` (fallback `setTimeout(100)` on unsupported browsers — Safari iOS).
- Build **one combined MiniSearch instance** with `storeFields: ['id', 'type', 'parentId', 'parentTitle', ...]` and a `type` discriminator on every document. (Resolves review F-05.)
- Index construction waits for store hydration (`useCourseStore`, `useBookStore`) before it begins — `requestIdleCallback` must no-op if stores aren't ready and reschedule.
- **Incremental updates (review finding ADV-02):** Subscribe to Dexie changes via `useLiveQuery` or `liveQuery` per table. On change, compute the diff (added/updated/removed docs) and call MiniSearch `add` / `replace` / `remove` per affected doc. Do NOT full-rebuild on every change.
- Full rebuild only on schema change, user-triggered "Rebuild search index" action (future), or index corruption fallback.
- Debounce incremental updates to 300ms trailing edge during bulk imports.
- **Do not persist indexes to IndexedDB** in Story 1. Revisit if Workstream B (server-side) lands.
- **Per-entity isolation:** If building one entity type throws, skip it and continue with the rest. Log the failure.

### 6.2 Ranking — relevance × frecency (Story 2)

- Base score: MiniSearch relevance score with field boosts per §4.
- Frecency multiplier applied to **Best Matches section only**: `score × (1 + 0.5 × clamp((30 - daysSinceLastOpen) / 30, 0, 1) × log2(1 + openCount))`.
  - `daysSinceLastOpen` from recency log `openedAt`.
  - `openCount` from recency log (capped effectively by log-scaling).
  - Maximum multiplier ≈ 2.0 (when opened today with 7+ opens).
- Grouped sections use pure relevance (no frecency) — user doesn't see rankings shift unexpectedly.
- **Reuse existing signals first (review finding F-02):** Before writing to the recency log, piggyback on existing `books.lastOpenedAt` and `progress.lastAccessedAt` fields — the log adds the missing cross-entity + openCount data, it doesn't duplicate existing fields.

### 6.3 Recency log (Story 2)

Split into two separate data structures (review finding ADV-03):

1. **Recent list** — `localStorage` key `knowlune.recentSearchHits.v1`, JSON array of last 20 `{type, id, openedAt}` entries. Written on palette select. Used for "Recently opened" empty-state section. No Dexie migration required. (Resolves review F-01.)
2. **Frecency counters** — new Dexie table `searchFrecency` (v53 migration): `{ entityType, entityId, openCount, lastOpenedAt }` keyed by `[entityType+entityId]`. Written on palette select AND on direct navigation (route handler hook). No eviction — bounded naturally by library size. Not synced (no `userId`, stays local). Used for Best Matches frecency multiplier only.

Rationale: two structures prevent LRU eviction from destroying the frecency signal during bulk imports while keeping the recent-list cheap.

### 6.4 Local-only (all stories)

- No Supabase, no network calls in the search path.
- Index in memory; recent list in localStorage; frecency counters in Dexie.
- Compatible with local-first architecture (see §9).

### 6.5 Reuse & integration (all stories)

- **Preserve** `src/lib/noteSearch.ts` field config and MiniSearch settings for notes. The unified index replaces the existing note index but copies its tokenizer/processor/searchOptions verbatim.
- **Preserve** bookHighlights integration from E86-S03 — just upgrade its matcher to MiniSearch.
- **Extend** `src/app/components/figma/SearchCommandPalette.tsx` — don't create a parallel component. Replace `buildSearchIndex` (lines 122-158) with the new unified-index hook.

### 6.6 cmdk filter bypass (Story 1, review finding)

cmdk's default `commandFilter` does substring matching on every CommandItem `value`. MiniSearch's fuzzy results won't survive that filter. Story 1 must:
- Globally set `filter={() => 1}` (or equivalent bypass) on the Command root, OR
- Use the existing per-item bypass pattern (where `value="type:id"` and the cmdk filter always returns 1) for all MiniSearch-sourced items.
- Decision: global bypass is simpler. The palette becomes "we control ranking via MiniSearch, cmdk is just the UI shell."
- Trade-off: losing cmdk's internal sort means we must produce fully sorted results from MiniSearch + frecency before rendering.

### 6.7 Infrastructure corrections (Story 1)

Confirmed against code during review:
- `importedCourses` does NOT have a `videos` nested array. Videos are in `importedVideos` (checkpoint.ts:56) keyed by `courseId`.
- `ImportedVideo.filename`, not `.title` (types.ts:183-202).
- `importedCourses` has no `progress` column. Derived from per-video `progress` rows.
- Authors page uses `getMergedAuthors(storeAuthors)` — pre-seeded + imported merged.
- Courses page uses `importedCourses` directly but `useCourseStore` holds separate legacy static `Course[]`.

The index build hook must reconcile these (merge pre-seeded + imported where applicable, join tables where needed).

## 7. Acceptance Criteria (split by story)

### Story 1 — Unified Index

1. Cmd+K opens the palette (existing behavior preserved).
2. Desktop: Cmd+K; Mobile/touch: tap a visible header search icon (existing header search button in Layout.tsx wired as the mobile trigger).
3. Typing a query returns results from all six entity types (when matches exist), grouped per §5.2 in fixed order, capped at 5 per section with "Show all N" expansion.
4. Typo-tolerant matching works across all entity types, including previously substring-only ones (Courses, Lessons, Book Highlights). Verify via Playwright: "postgrs" → "Postgres", "michel" → "Michael", "introdction" → "introduction".
5. Selecting a result navigates to the correct route. Route mapping documented in the plan: courses → `/courses/:id`, books → `/books/:id`, lessons → `/courses/:courseId/videos/:videoId`, notes → course+video view with note highlighted, highlights → book reader at anchor, authors → `/authors/:id`.
6. **Deleted-entity fallback**: If the selected entity no longer exists (e.g., recently deleted but still in recent list), palette shows a toast "Item no longer available" and refreshes results. Does not throw or navigate to blank.
7. Per-page search inputs on Courses.tsx and Authors.tsx use the same unified MiniSearch instance (same quality bar). Inputs remain rendered.
8. First Cmd+K after app boot returns results in < 100ms when the index is ready; if the index is not ready, palette opens in < 16ms showing empty-state, and transitions to live results within 300ms of first keystroke.
9. Index incremental update latency < 300ms from Dexie change to availability in palette results.
10. All existing note-search and highlight-search behavior still works (regression check).
11. Accessibility: ARIA `role="listbox"` on result list, `role="option"` on rows, `aria-label` on type badges, `aria-live="polite"` region announces result count changes on query input, keyboard navigation (arrow keys, Home, End, Escape) works across sections.
12. Mobile: palette uses a bottom-sheet or full-screen variant on viewports < 640px; touch targets ≥ 44×44px per project standards.
13. No Supabase, no network, no new dependencies beyond MiniSearch 7.2.0 and cmdk 1.1.1.

### Story 2 — Ranking & Empty State

14. Empty-state shows "Continue learning" (up to 2 items) when qualifying items exist, sourced per §5.1.
15. Empty-state shows "Recently opened" (up to 5 items) from localStorage recent list.
16. Fresh-install state (no imports, no opens) shows welcome copy per §5.1.
17. "Best Matches" section appears for typed queries, top 3 ranked by relevance × frecency per §6.2.
18. Frecency counters persist across app restarts (Dexie `searchFrecency` table).
19. Writing to recent list and frecency counters happens on palette select AND on direct route navigation (not palette-only).
20. v53 Dexie migration adds `searchFrecency` table with correct indexes; migration is idempotent and tested.

### Story 3 — Power-User & Per-Page Cleanup

21. Prefix filters `c:`, `b:`, `l:`, `a:`, `n:`, `h:` scope results correctly per §5.3.
22. Prefix parsing produces a visible chip in the input; Backspace removes the chip.
23. Empty prefix query (`c:` with no content) shows top 50 items in that entity type by frecency.
24. Per-page search inputs on Courses.tsx and Authors.tsx are removed only if measurement criteria met (see §5.4). If not met, Story 3 ships prefix filters only.
25. Header-level "Search" button on each page opens the palette pre-scoped.
26. Discoverability hint row appears in empty state; dismissing persists in localStorage.

## 8. Non-Goals

- **No server-side search.** Captured in `docs/brainstorms/2026-04-18-postgres-server-platform-requirements.md` §4.1 (Workstream B future epic brief) — candidate Epic 22, triggered only when local MiniSearch hits scaling limits, cross-user discovery appears, or multi-device thin-client search is needed.
- **No semantic / embedding search.** Future epic (E93 already plans pgvector for embedding sync; cross-entity semantic search captured in Workstream B §4.4).
- **No search analytics / tracking.** Local-first, privacy-respecting.
- **No saved searches or search history UI.** Recency log is internal only.
- **No index persistence to IndexedDB.** Revisit if Workstream B lands.
- **No legacy `useCourseStore` indexing.** Switch entirely to `importedCourses`.

## 9. Constraints & Assumptions

- **Local-first architecture** is a stated project principle (confirmed in `docs/analysis/integration-strategy.md:42` and `docs/planning-artifacts/quiz-ux-design-specification.md`). No explicit NFR53/56/64 clause was located in the codebase scan; planner should link to whatever the canonical NFR doc is if one exists.
- MiniSearch 7.2.0 and cmdk 1.1.1 are already dependencies.
- Dexie v52 schema has `[userId+updatedAt]` compound indexes on all relevant tables. Story 2 adds v53 for `searchFrecency`.
- React 19.2.4.
- PWA is the primary deployment (project memory: Tauri rejected 2026-03-28). Mobile UX is a first-class concern.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Combined index memory footprint at 10k lessons | Benchmark at 1000 courses × 10 videos = 10k lessons before Story 1 merge. Hard NFR: index < 80MB memory, build < 500ms on mid-tier hardware. If fails: lazy-build lessons on first `l:` prefix or palette scroll. |
| useLiveQuery thrash on note-editing | §6.1 incremental updates — never full-rebuild on note edit. Per-record `replace` only. |
| Frecency bias toward stale items | §6.2 log-scaled openCount + 30-day decay + 2x cap; Best Matches only. |
| Prefix collision with literal content | §5.3 visible chip + Backspace exit; literal content searchable by leading space. |
| Mobile Cmd+K unavailable | Story 1 AC 2: visible header search icon wired to same palette. Required, not optional. |
| Existing palette's legacy static course data gets orphaned | Story 1 removes legacy course indexing entirely (§8 non-goal); all tests referencing static `useCourseStore` results updated. |
| Deleted entities in recent list point to 404 | AC 6: graceful toast + results refresh; recent list entry is removed. |
| 2-week measurement for Story 3 removal is informal | Explicit measurement method documented in Story 3 plan (self-report + console-instrumented counter). No automatic removal. |

## 11. Critical Files

- `src/app/components/figma/SearchCommandPalette.tsx` — extend (primary change, all stories)
- `src/lib/noteSearch.ts` — reuse field config; unified index replaces module (Story 1)
- `src/app/components/Layout.tsx` (lines 342-346) — Cmd+K wiring correct; header search icon already exists for mobile
- `src/app/pages/Courses.tsx` (lines ~118-123) — refactor to shared MiniSearch (Story 1); remove input (Story 3)
- `src/app/pages/Authors.tsx` (lines ~59-65) — refactor to shared MiniSearch (Story 1); remove input (Story 3)
- `src/data/types.ts` (lines 157-202) — `ImportedCourse`, `ImportedVideo` type definitions — reference for index build
- `src/db/checkpoint.ts` (lines 54-110) — Dexie schema; add `searchFrecency` table in Story 2 (v53)
- `src/lib/authors.ts` — `getMergedAuthors` reconciliation logic
- `src/app/App.tsx` — add boot-time index build trigger
- **New file:** `src/lib/unifiedSearch.ts` — unified MiniSearch instance + hook; replaces `noteSearch.ts` internals (Story 1)

## 12. Out of Scope (Parked Ideas)

- **Semantic search** via pgvector — server-side only; Workstream B future epic brief.
- **Federated / remote library search** — requires Supabase sync; out of scope.
- **Search UI analytics** ("you searched for X 12 times") — privacy tradeoff, low current value.
- **Natural language Q&A** over library content — AI-heavy, separate epic.
- **Virtualized result lists** — not needed below 50 items/section per §5.3.

## 13. References

- Product research: Linear, Notion, Slack, Superhuman, Raycast, VS Code, Arc, Obsidian command palette patterns (2026-04-18 research agent).
- UX principles: Nielsen Norman Group on chunked vs flat result lists, Hick's Law, Mozilla Places frecency formula.
- Prior art in repo: `src/lib/noteSearch.ts`, `src/app/components/figma/SearchCommandPalette.tsx`, E86-S03 (book highlights integration).
- Review round: 2026-04-18 document-review (coherence, feasibility, product-lens, design-lens, scope-guardian, adversarial) — 54 findings triaged; P0 infrastructure corrections folded into §4 / §5.1 / §6.7; P1 complexity deferred to Stories 2 and 3; mobile + a11y raised to AC 2 / 11 / 12.
