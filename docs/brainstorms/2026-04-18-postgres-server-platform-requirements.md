# Requirements: Postgres Server-Platform Feature Catalog (Future Epics)

**Date:** 2026-04-18
**Status:** Capture-only — no implementation. Source document for future epic planning (E22+).
**Scope:** Identify which Postgres extensions/features (surfaced in the "I Replaced My Entire Stack With Postgres" transcript) are worth adopting as Knowlune graduates from local-first to hybrid (local + synced). Frame each as a future epic candidate with triggers, prerequisites, and NFR tension.
**Upstream context:** Workstream B of `.claude/plans/https-www-youtube-com-watch-v-tdondbmynx-gleaming-frog.md`.

---

## 1. Purpose

The Postgres transcript argues that one extensible database can replace Redis/Kafka/Elasticsearch/Pinecone/etc. Knowlune is already committed to Supabase Postgres via Epic 19 (auth/entitlement) and Epic 92/93 (data sync + embeddings). This brief catalogs **which additional Postgres capabilities are worth adopting as future epics**, and which are not.

The intent is not to decide when or whether to adopt them — that's the job of future epic planning. The intent is to ensure the ideas aren't lost and that each has a documented trigger condition and prerequisite.

## 2. Current Server-Side Commitments (Context)

| Commitment | Epic | Status |
|---|---|---|
| Supabase Auth (self-hosted on Unraid) | E19 | Planned (prerequisites captured 2026-03-14) |
| Stripe billing + entitlement cache | E19 | Planned |
| Data sync engine (upload/download/conflict resolution) | E92 | In progress (E92-S08 is the current branch) |
| pgvector for embeddings sync | E93 | Planned (E93-S05) |
| Row-level security on all synced tables | E92 | In design (per `auth.uid() = user_id` pattern) |

Source: `docs/plans/2026-03-14-epic-19-prerequisites.md`, `docs/planning-artifacts/epics-supabase-data-sync.md`, `docs/research/sync-architecture.md`.

## 3. NFR Tension (Applies to All Candidates Below)

Epic 19's own local-first commitment (plan lines 30-31, verbatim):

> "All learning data remains local — no network requests are made except to configured AI API endpoints and, when the user has opted into premium features, authentication and entitlement validation endpoints."

Epic 92 partially amends this commitment for synced users, but the amended wording is still conservative: **sync is opt-in, and core workflows remain functional offline.** Any feature in this brief that moves computation server-side must:

1. Explicitly justify why the value can't be delivered locally
2. Remain optional (graceful degradation when user is offline or hasn't opted in)
3. Get explicit product sign-off, not inherit E92's sync approval

## 4. Feature Catalog

Each candidate below follows the same frame: **what it is**, **why Knowlune might want it**, **trigger condition** (when does the pain become real?), **prerequisites**, **NFR tension**, and **reject/accept rationale**.

### 4.1 ✅ CANDIDATE — ts_vector + pg_trgm (Server-side full-text search with typo tolerance)

**What:** Postgres's native full-text search via `ts_vector` (tokenized search column + GIN index) and `pg_trgm` (trigram-based fuzzy matching for typos).

**Why Knowlune might want it:** Workstream A (the local search upgrade, currently in planning) uses MiniSearch entirely in-memory. It works well up to "thousands of lessons/notes" per user but has structural limits:

- Index rebuild cost scales with library size on every cold boot (Workstream A §10 risk)
- Cross-user search (if Knowlune ever gains social features: "find courses others are learning") is impossible without server-side
- Search on secondary devices (PWA, potential mobile-native wrapper) must re-download all content before searching

Server-side FTS becomes the natural progression when the local index becomes the bottleneck.

**Trigger condition:** EITHER (a) local MiniSearch index exceeds ~100MB memory for real users, OR (b) Knowlune adds any cross-user discovery feature (shared courses, public authors), OR (c) a second device needs to search without full library sync.

**Prerequisites:** E92 sync must be live (otherwise there's no server-side content to search). Workstream A should ship first so we know the local baseline to improve on.

**NFR tension:** Medium. Search results can still be served offline from local MiniSearch; server-side FTS becomes the upgrade path for online/cross-device queries. Treat as augmentation, not replacement.

**Accept as future epic candidate?** **Yes.** Mark as `E22 candidate: Server-side search & cross-device discovery`. Depends on E92 + Workstream A.

### 4.2 ✅ CANDIDATE — Materialized views (Reports aggregations)

**What:** Pre-computed query results stored as a physical table, refreshed via `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Useful for expensive aggregations that are read-heavy and write-light.

**Why Knowlune might want it:** The Reports page today computes study streaks, total watch time, per-topic progress, and per-author time allocations on the client by scanning Dexie rows. At current scale this is fast. It stops being fast when:

- A user has 10k+ progress rows (thousands of lessons × months of history)
- Reports pages need cross-device aggregation (same user on laptop + phone, combined activity)
- Social/comparative reports are added ("learners like you watched X more this week")

Server-side materialized views would let the Reports page query a small pre-aggregated table instead of scanning raw progress rows.

**Trigger condition:** Reports page exceeds 500ms render time on cold load OR cross-device aggregation becomes a feature ask.

**Prerequisites:** E92 sync live (progress rows must exist server-side). RLS policies must cover the materialized views explicitly (Postgres requires `security_invoker = true` or manual RLS wrappers — noted for planning, not this brief).

**NFR tension:** Medium. Reports can still render offline from local data; server-side views are the "when I'm online, use the cached aggregate" path. Client has to handle the freshness trade-off (stale aggregate vs live local scan).

**Accept as future epic candidate?** **Yes.** Mark as `E23 candidate: Server-side Reports aggregations`. Depends on E92 and user research showing Reports performance pain.

### 4.3 ✅ CANDIDATE — JSONB + GIN indexes as a design pattern

**What:** Store flexible, schema-less data in `JSONB` columns with `GIN` indexes for deeply nested queries. Different from just "storing JSON somewhere": the point is making the JSON *queryable*.

**Why Knowlune might want it:** E92 already uses JSONB for some serialization (`messages`, `preferences`) but doesn't use GIN indexes or query into the JSON. Cases where GIN+JSONB could help future epics:

- Course metadata extensions — imported courses from different sources (Coursera, YouTube, Udemy, PDF, audiobooks) have overlapping but divergent metadata. A `metadata JSONB` column with GIN index lets each source store what's relevant without schema churn.
- AI-generated annotations — lesson summaries, key concepts, transcripts, tags could accumulate over time from different AI passes. JSONB with GIN supports "find all lessons where key_concept contains 'Postgres'" without separate tables.
- Experiment/feature flags per user — `user.features JSONB` with GIN supports quick lookups without a separate table per feature.

**Trigger condition:** When the team is about to add a new nullable/polymorphic column for the third or fourth source/integration type.

**Prerequisites:** None beyond E92 sync being live.

**NFR tension:** Low. Design pattern, not a new runtime dependency. Already partially in use.

**Accept as future epic candidate?** **Yes, but not as its own epic.** Mark as: *design pattern to reach for when future epics need schema flexibility*. Should appear in `docs/engineering-patterns.md` as a documented option, not in a dedicated epic.

### 4.4 🟡 DEFER — pgvector for *cross-entity* semantic search

**What:** E93 already plans pgvector for syncing embeddings. This candidate is the *extension*: server-side semantic search queries that combine vector similarity with relational filters ("find lessons similar to this one, but only from authors I follow").

**Why Knowlune might want it:** Raw vector similarity is already captured by E93. The value of server-side combined search (vector + relational) is: doing it on the client requires downloading all embeddings + doing the similarity math in the browser, which scales poorly past ~10k embeddings.

**Trigger condition:** Any feature that needs "semantic search + filter" (e.g., "courses like X that I haven't started", "notes similar to this note from the last 30 days").

**Prerequisites:** E93 live. Workstream A local search live (so we know what "better than fuzzy full-text" means for Knowlune users).

**NFR tension:** High. Semantic search is hard to do locally at scale — server-side path naturally becomes the primary path for this feature class. Requires explicit product commitment to "some searches are online-only."

**Accept as future epic candidate?** **Defer.** Not rejected, but noted as a probable E93 extension rather than a standalone epic. Let E93 ship first, then decide.

### 4.5 🟡 DEFER — SKIP LOCKED for background jobs

**What:** Postgres-native concurrent queue via `FOR UPDATE SKIP LOCKED`. Replaces Redis/RabbitMQ for queued work.

**Why Knowlune might want it:** If/when Knowlune needs background jobs — e.g., transcoding uploaded videos, running AI passes on imported content, sending email digests, scheduled reminders — this is the lowest-ceremony queue that avoids adding Redis.

**Trigger condition:** First real background-job use case appears. Candidates from current roadmap:
- Imported-course processing (video transcription/embedding generation)
- Weekly email digests (if/when Knowlune grows beyond solo use)
- Scheduled content regeneration (flashcard review reminders, streak notifications)

**Prerequisites:** Supabase Edge Functions need a way to run scheduled work (pg_cron or equivalent). E19 adds Edge Functions but not pg_cron.

**NFR tension:** Low. Queue work doesn't affect local-first commitments — it's purely server-side infrastructure.

**Accept as future epic candidate?** **Defer.** Not rejected, but capture only. Add to candidates list if and when a background-job feature is proposed.

### 4.6 🟡 DEFER — RLS per-content-type refinement

**What:** E92 commits to basic RLS (`auth.uid() = user_id`). This candidate is finer-grained policies: shared courses (public courses others can read), premium content gating, team workspaces.

**Trigger condition:** First feature that breaks the "each row belongs to exactly one user" assumption.

**Accept?** **Defer.** Natural extension of E92, not a separate epic. Revisit if/when sharing becomes a feature.

### 4.7 ❌ REJECT — PostGIS (Geospatial)

**What:** Postgres geographic-data extension.

**Why reject:** Knowlune has no geography use case. No maps, no location-based content, no geographic filtering. Would remain unused forever.

### 4.8 ❌ REJECT — BRIN indexes (Time-series block range)

**What:** Compact indexes for massive sequential time-series data (millions of rows).

**Why reject:** Knowlune's data volumes don't warrant it. BRIN only pays off at billions of rows per table. Standard B-tree indexes on `updatedAt` / `lastOpenedAt` are sufficient at our scale for decades.

### 4.9 ❌ REJECT — PostgREST / pg_graphql (Auto-generated APIs)

**What:** Tools that read your schema and generate a REST or GraphQL API automatically.

**Why reject:** Knowlune is a React + Dexie client, not an API-serving app. All writes go through Supabase Edge Functions or direct Supabase SDK calls. Adding PostgREST would duplicate the existing Supabase JS client. Zero benefit.

## 5. Summary — What to Capture as Future Work

| Candidate | Status | Epic Slot |
|---|---|---|
| ts_vector + pg_trgm server-side search | Accept as future epic | E22 candidate |
| Materialized views for Reports | Accept as future epic | E23 candidate |
| JSONB + GIN as design pattern | Accept — document in engineering-patterns.md | Not epic-sized |
| pgvector cross-entity semantic search | Defer — probable E93 extension | Revisit post-E93 |
| SKIP LOCKED background jobs | Defer — capture-only | Revisit when queue use case appears |
| RLS per-content-type refinement | Defer — E92 extension | Revisit when sharing proposed |
| PostGIS | Reject | — |
| BRIN indexes | Reject | — |
| PostgREST / pg_graphql | Reject | — |

## 6. Action Items (Non-Implementation)

These are documentation-only actions that come out of this brief. None require engineering work.

1. **Add epic-candidate entries** to `docs/planning-artifacts/epics.md` for E22 (Server-side search) and E23 (Server-side Reports aggregations), each referencing this doc as rationale.
2. **Add JSONB+GIN section** to `docs/engineering-patterns.md` documenting when to reach for it (next time someone adds a new polymorphic column).
3. **Cross-reference from Workstream A requirements** (`docs/brainstorms/2026-04-18-global-search-upgrade-requirements.md` §8 Non-Goals): the "no server-side search" non-goal explicitly points to this brief's §4.1.
4. **Cross-reference from the Postgres transcript plan** (`.claude/plans/https-www-youtube-com-watch-v-tdondbmynx-gleaming-frog.md`): mark Workstream B as "complete — see docs/brainstorms/2026-04-18-postgres-server-platform-requirements.md".

## 7. Out of Scope (Hard)

- Any implementation work for anything in §4. This brief is capture-only.
- Changes to E19, E92, or E93 scope. Those epics are committed; this brief catalogs *additions*, not revisions.
- Changes to the NFR local-first commitment. Any server-side adoption must go through its own product-approval gate per §3.
- Timeline commitments. No feature in §4 is on a roadmap as a result of this brief.

## 8. References

- Source video: "I Replaced My Entire Stack With Postgres" (transcript: `/tmp/masterclass/i-replaced-my-entire-stack-with-postgres.txt`)
- Parent plan: `.claude/plans/https-www-youtube-com-watch-v-tdondbmynx-gleaming-frog.md`
- Epic 19 plan: `docs/plans/2026-03-14-epic-19-prerequisites.md`
- Epic 92 sync architecture: `docs/research/sync-architecture.md`, `docs/planning-artifacts/epics-supabase-data-sync.md`
- Workstream A requirements: `docs/brainstorms/2026-04-18-global-search-upgrade-requirements.md`
