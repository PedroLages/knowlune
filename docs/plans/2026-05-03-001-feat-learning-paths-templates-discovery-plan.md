---
title: "feat: Add Path Templates & Discovery Surface"
type: feat
status: active
date: 2026-05-03
origin: docs/brainstorms/2026-05-03-learning-paths-03-templates-discovery-requirements.md
---

# feat: Add Path Templates & Discovery Surface

## Overview

Pre-seed 3-5 curated template learning paths delivered through the existing Supabase `hydrateFromRemote` pipeline. Add a discovery surface to the Learning Paths list page — templates as the primary CTA on empty state, collapsible section at bottom when populated. Add a syllabus preview page and a fork action that creates an independent user-owned path.

## Problem Frame

A new user with zero or few imported courses has no mental model of what a learning path looks like or why they should create one. The empty path list page shows a "Create your first path" CTA with no examples, no preview, and no immediate value. Templates solve the cold-start problem by showing complete, well-structured paths that demonstrate the feature's value before the user invests in creating their own. (see origin: docs/brainstorms/2026-05-03-learning-paths-03-templates-discovery-requirements.md)

## Requirements Trace

- R1. Pre-seed 3-5 curated template paths via Supabase, delivered through the existing `hydrateFromRemote` pipeline
- R2. Each template includes: name, description, fully sequenced course list (3-8 entries), AI-generated justifications, estimated total hours, difficulty curve label, and topic tags
- R3. Template paths are marked with `isTemplate: true` and appear with a "Template" badge and distinct visual treatment
- R4. Empty path list page shows template cards in a "Start with a template" section above the "Create your own" CTA
- R5. Populated path list page shows templates in a collapsible "Discover more paths" section at the bottom
- R6. Each template card shows: title, course count, total hours, difficulty curve, and "Preview" button
- R7. Clicking "Preview" opens a syllabus view showing the full course sequence with per-course justifications, topic coverage, estimated hours, and difficulty progression chart
- R8. Syllabus view has "Use this template" primary action that forks the template into a user-owned path — matched courses auto-linked, unmatched courses show as gap entries with "Import" actions
- R9. Syllabus view has "See a different template" navigation without closing/reopening
- R10. After forking, the result is a normal user-owned path — editable, reorderable, with progress tracking. `isTemplate` cleared, `forkedFrom` records the template ID
- R11. If the user already forked a template, "Use this template" shows "Already in your paths" with a link

## Scope Boundaries

- 3-5 initial templates only — no template marketplace, community submissions, or template editor
- Template content is curated manually (JSON seed file), not AI-generated
- No template versioning — if a template is updated, existing forks are not affected
- No template ratings, reviews, or popularity metrics
- Gap entries are a UI concept, not a data model entity — unmatched courses render as special rows, become normal `LearningPathEntry` rows on import
- Syllabus view reuses existing `chart.tsx` (Recharts wrapper) — no new chart library

### Deferred to Separate Tasks

- Template marketplace, community submissions, or rating system
- Template versioning and fork-update propagation
- AI-generated template content

## Context & Research

### Relevant Code and Patterns

- **Learning Paths page**: [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx) — main list page with PathCard, CreatePathDialog, DeletePathDialog, search, empty state
- **Learning Path Detail**: [src/app/pages/LearningPathDetail.tsx](src/app/pages/LearningPathDetail.tsx) — detail/syllabus view for a single user-owned path
- **Zustand store**: [src/stores/useLearningPathStore.ts](src/stores/useLearningPathStore.ts) — CRUD operations via `syncableWrite`, `hydrateFromRemote` via `bulkPut`
- **Types**: [src/data/types.ts](src/data/types.ts) — `LearningPath` (id, name, description, createdAt, updatedAt, isAIGenerated) and `LearningPathEntry` (id, pathId, courseId, courseType, position, justification, isManuallyOrdered)
- **Sync registry**: [src/lib/sync/tableRegistry.ts](src/lib/sync/tableRegistry.ts) — both tables registered at P3 LWW
- **Hydration**: [src/lib/sync/hydrateP3P4.ts](src/lib/sync/hydrateP3P4.ts) — `hydrateP3P4FromSupabase` fetches per-user and calls `hydrateFromRemote`
- **Dexie schema**: [src/db/schema.ts](src/db/schema.ts) — current version 61
- **Dialog pattern**: CreatePathDialog in LearningPaths.tsx — standalone function component, controlled via `useState<X | null>(null)`, form submission with toast feedback
- **Card pattern**: PathCard in LearningPaths.tsx — motion.div + Card + PathCardHeader + progress ring + dropdown menu
- **Empty state**: [src/app/components/EmptyState.tsx](src/app/components/EmptyState.tsx) — dashed-border card, icon in bg-brand-soft circle, CTA button
- **Chart component**: [src/app/components/ui/chart.tsx](src/app/components/ui/chart.tsx) — Recharts wrapper (Line, Bar, Area charts)
- **Collapsible**: [src/app/components/ui/collapsible.tsx](src/app/components/ui/collapsible.tsx) — Radix collapsible for "Discover more paths" section
- **Badge**: [src/app/components/ui/badge.tsx](src/app/components/ui/badge.tsx) — for "Template" badge
- **Routes**: [src/app/routes.tsx](src/app/routes.tsx) — React Router v7 lazy-loaded routes

### Institutional Learnings

- **Single write path**: All synced mutations must go through `syncableWrite()` — never `db.learningPaths.put()` directly. The fork operation must follow this pattern. (docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md)
- **Supabase migration invariants**: Adding columns requires verifying upsert function signatures include all NOT NULL columns, fieldMap entries cover non-default mappings, and epoch-ms fields use BIGINT. (docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md)
- **Hydration ordering**: All hydrators must be awaited before `syncEngine.start()`. The existing bootstrap already does this. (docs/solutions/sync/e96-closeout-sync-patterns-2026-04-19.md)
- **Echo-loop invariant**: `hydrateFromRemote` uses `bulkPut` (not `syncableWrite`) — templates hydrating through this path will not enqueue echo-loop entries. Tests should assert `syncQueue.count() === 0` after hydration. (docs/solutions/sync/e96-closeout-sync-patterns-2026-04-19.md)
- **Stale async results**: Fork is async with multiple `syncableWrite` calls. Use generation counter pattern in the store to prevent stale results overwriting state. (docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md)
- **Functional set after await**: Always use `set(state => ...)` after any `await` in async store operations. (docs/engineering-patterns.md, sync section lines 15-28)
- **Extract on second consumer**: Template cards and user path cards share visual structure — extract a shared primitive rather than copy-pasting. (docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md)
- **Self-contained section components**: Load their own data via useEffect + Dexie queries, avoiding prop-drilling from the parent page. (docs/solutions/best-practices/reports-page-redesign-patterns-2026-05-02.md)

### External References

- N/A — codebase has strong local patterns for all technologies involved (React Router v7 routes, shadcn/ui dialogs, Zustand stores, Supabase migrations, Dexie schema versions)

## Key Technical Decisions

- **Separate Supabase table for templates**: Create `learning_path_templates` and `learning_path_template_entries` tables with public-read RLS (no `user_id` column). Templates flow through a second query in the existing `hydrateP3P4FromSupabase` function, then merge into the same Dexie `learningPaths` table with `isTemplate: true`. Rationale: avoids RLS complexity (existing table uses `auth.uid() = user_id`), isolates template infrastructure from user data, and respects the brainstorm's "no new API endpoints or delivery mechanisms" constraint — just a new table + query in the existing hydrator.
- **Syllabus view as full page route**: `/learning-paths/templates/:templateId` — not a dialog. Rationale: R9 requires "See a different template" navigation without closing/reopening (awkward in a dialog), the difficulty progression chart needs room, and a route enables direct linking. Uses React Router v7 lazy-loaded route.
- **Fork, don't reference**: Forking creates an independent copy via `syncableWrite`. The user can modify it freely without affecting the template. Simpler than reference-based model; avoids template-update propagation complexity. (see origin: Key Decisions)
- **Gap entries as UI concept**: Unmatched template courses render as special rows with "Import" actions in the path detail view. They are never persisted as a separate entity type. When the user imports the course, it becomes a normal `LearningPathEntry`. This avoids schema changes. (see origin: Key Decisions)
- **Seed via Supabase migration**: Template data is a SQL migration with INSERTs into the templates tables. Deterministic, version-controlled, runs automatically. A JSON seed file in the repo serves as the canonical source; the migration is generated from it.
- **Template fields stored as JSON columns**: `estimated_hours` (integer), `difficulty_label` (text), and `topic_tags` (text array) are stored as columns on the template tables. These are display-only fields — they don't need to be on the user-owned `learning_paths` table, keeping the user schema unchanged.
- **"Already forked" check via Dexie query**: `db.learningPaths.where('forkedFrom').equals(templateId).filter(p => !p.isTemplate)` — no dedicated index needed. Simple, correct, and avoids server round-trip.
- **Course matching at fork time**: Template entries carry an optional `matchTitle` field — a canonical course title used for matching at fork time. The fork action compares `matchTitle` against imported course names using normalized comparison (lowercase, strip punctuation and whitespace). If exactly one match is found, auto-link. If zero or multiple matches, the entry becomes a gap entry with `matchTitle` preserved for the Import search hint. Template entries can also carry a `courseId` reference for exact matches (e.g., catalog courses the user might import). This is an optimization, not the primary mechanism.
- **Template metadata preserved on fork**: `estimatedHours` and `difficultyLabel` are added as optional nullable fields on `LearningPath` (default null — no impact on existing paths). These are copied from the template on fork so the user's path detail view retains the information shown on the template preview. `topicTags` are aggregated from entries at display time rather than stored on the path.

## Open Questions

### Resolved During Planning

- **Seeding mechanism**: Supabase migration (not admin script). Deterministic, version-controlled, matches existing migration pattern.
- **Template entry schema**: Template entries store `courseId` (nullable — null means descriptive-only gap entry), `position`, `justification`, `estimatedHours`. On fork: if `courseId` matches an imported course, auto-link; otherwise render as gap entry.
- **Syllabus view UI**: Full page route at `/learning-paths/templates/:templateId`. Dialog is too constrained for the chart + course list; route enables R9 navigation and direct linking.
- **"Already forked" check**: Dexie query on `forkedFrom` field. No dedicated index. No server round-trip.
- **Empty-state "Create from scratch" action**: Included as a secondary action below template cards. Templates are primary CTA; manual creation is still accessible but de-emphasized.

### Deferred to Implementation

- Exact chart configuration for difficulty progression — depends on the shape of template data and existing chart component API
- Specific animation/motion values for template card entrance — implementer chooses values consistent with existing `fadeUp`/`staggerContainer` patterns
- Exact Tailwind classes for template card visual treatment — implementer follows design token rules and existing card patterns

## Output Structure

```
supabase/migrations/
  └── 20260503XXXXXX_add_learning_path_templates.sql   # new templates tables + seed data

src/
  ├── data/types.ts                                     # +TemplatePath, +TemplatePathEntry types
  ├── db/schema.ts                                      # Dexie v62: +isTemplate, +forkedFrom on learningPaths
  ├── lib/sync/
  │   ├── tableRegistry.ts                              # +learningPathTemplates, +learningPathTemplateEntries registry entries
  │   └── hydrateP3P4.ts                                # +fetch templates query, merge into hydrateFromRemote call
  ├── stores/useLearningPathStore.ts                    # +forkTemplate action
  ├── app/
  │   ├── routes.tsx                                    # +/learning-paths/templates/:templateId route
  │   ├── pages/
  │   │   ├── LearningPaths.tsx                         # restructured: template section + user paths section
  │   │   └── TemplateSyllabus.tsx                      # new: syllabus view page
  │   └── components/
  │       └── course/
  │           └── TemplateCard.tsx                       # new: template card component
  └── ... (no other new directories)
```

## Implementation Units

- [ ] **Unit 1: Data model — Supabase templates tables + seed data**

**Goal:** Create the `learning_path_templates` and `learning_path_template_entries` tables in Supabase, seed 5 initial templates, and add the corresponding Dexie schema columns (`isTemplate`, `forkedFrom`) to the existing `learningPaths` table.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260503XXXXXX_add_learning_path_templates.sql`
- Modify: `src/data/types.ts` — add `TemplatePath`, `TemplatePathEntry` types; add `isTemplate`, `forkedFrom` to `LearningPath`
- Modify: `src/db/schema.ts` — Dexie v62 migration adding `isTemplate`, `forkedFrom` columns to `learningPaths` table

**Approach:**
- New Supabase tables: `learning_path_templates` (id, name, description, course_count, estimated_hours, difficulty_label, topic_tags, created_at) and `learning_path_template_entries` (id, template_id, course_id nullable, match_title nullable, position, title, justification, estimated_hours, topic_tags). Public-read RLS — no `user_id` column.
- Template fields (`estimatedHours`, `difficultyLabel`) are added as optional nullable fields on `LearningPath` type (`estimatedHours?: number`, `difficultyLabel?: string`). These are display-only — null by default, set on fork from template values. `topicTags` are aggregated from entries at display time.
- `matchTitle` on template entries is a canonical course title string used for matching against imported courses at fork time (see Key Technical Decisions). Nullable — null entries are always gap entries.
- Dexie v62: add `isTemplate` (boolean, default false) and `forkedFrom` (string, nullable) to the `learningPaths` table schema. These columns exist on the user table so templates can merge into the same Dexie table. Both new columns must be added to the Dexie stores declaration string (e.g., `learningPaths: 'id, createdAt, userId, isTemplate, forkedFrom, [userId+updatedAt]'`) so `where('isTemplate')` and `where('forkedFrom')` queries function. Without index entries, Dexie `where()` throws at runtime.
- Seed data: 5 templates (Full-Stack Developer, Data Science Foundations, iOS Development, Machine Learning Engineering, Product Design) with 4-7 entries each. Template entries use `course_id = NULL` for descriptive-only entries (no real course matching yet — matching happens at fork time when the user's imported courses are known).
- Follow the Supabase migration invariants checklist from docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md.

**Patterns to follow:**
- Existing Supabase migrations under `supabase/migrations/` — naming convention `YYYYMMDDHHMMSS_description.sql`
- Dexie migration pattern in `src/db/schema.ts` — `.version(N).stores({...}).upgrade(tx => ...)`

**Test scenarios:**
- Happy path: Migration runs, tables exist with correct columns, seed data is queryable
- Happy path: Dexie v62 upgrade adds `isTemplate` (default false) and `forkedFrom` (null) to existing `learningPaths` rows
- Edge case: Migration is idempotent — rerunning does not duplicate seed data (use ON CONFLICT DO NOTHING)
- Integration: Template tables are accessible via Supabase client with public-read RLS (anon key can SELECT)

**Verification:**
- `supabase migration list` shows the new migration
- `SELECT count(*) FROM learning_path_templates` returns 5
- Dexie `learningPaths` table schema includes `isTemplate` and `forkedFrom` after upgrade
- TypeScript compilation passes with updated types

---

- [ ] **Unit 2: Sync plumbing — hydrate templates into Dexie**

**Goal:** Extend the `hydrateP3P4FromSupabase` function to fetch template data from the new Supabase tables and merge it into the Dexie `learningPaths` and `learningPathEntries` tables via the existing `hydrateFromRemote` store method.

**Requirements:** R1, R3

**Dependencies:** Unit 1 (tables must exist)

**Files:**
- Modify: `src/lib/sync/hydrateP3P4.ts` — add `fetchTemplatePaths()` and `fetchTemplateEntries()` queries (direct Supabase client calls, not through `fetchTableRows` — templates have no `user_id`), merge into `hydrateFromRemote` call
- Modify: `src/stores/useLearningPathStore.ts` — extend `hydrateFromRemote` to accept and merge template rows
- NOTE: Template tables are NOT added to `tableRegistry.ts` — they lack `user_id` and a Dexie counterpart, so the sync engine cannot process them

**Approach:**
- Two new Supabase queries in `hydrateP3P4FromSupabase`: `fetchTemplatePaths()` (selects all from `learning_path_templates`) and `fetchTemplateEntries()` (selects all from `learning_path_template_entries`). No `user_id` filter — these are public-read tables.
- Map template rows to `LearningPath` shape: set `isTemplate: true`, `userId: ''` (templates don't belong to a user; empty string avoids RLS issues since they bypass RLS via a separate table), `id: template_{uuid}` (prefixed to avoid collision with user path IDs).
- Map template entry rows to `LearningPathEntry` shape: set `pathId: template_{template_id}`, `courseId: course_id ?? ''` (empty for gap entries), `courseType: 'catalog'`, `position`, `justification`.
- Merge templates into the existing `hydrateFromRemote` call — same `bulkPut` path, same echo-loop protection.
- Template tables are NOT added to the sync registry — they have no Dexie counterpart table and no `user_id` column, so the sync engine's download/upload loops cannot process them. Instead, template data is fetched directly via Supabase client queries alongside the existing user-data queries, and merged into the Dexie `learningPaths` table via `bulkPut`. This avoids registry complexity while delivering templates through the same hydrate path.

**Patterns to follow:**
- Existing `hydrateP3P4FromSupabase` in `src/lib/sync/hydrateP3P4.ts` — `fetchTableRows` pattern, `Promise.all` fan-out, merge into `hydrateFromRemote`
- Registry entry pattern in `src/lib/sync/tableRegistry.ts` — declarative entries with `dexieTable`, `supabaseTable`, `conflictStrategy`, `priority`

**Test scenarios:**
- Happy path: After hydration, `db.learningPaths.filter(p => p.isTemplate).count()` equals the number of seeded templates
- Happy path: Template entries are hydrated with correct `pathId` and `position` ordering
- Edge case: Re-running hydration does not duplicate template rows (`bulkPut` is idempotent by PK)
- Integration: Template hydration runs before `syncEngine.start()` (verify ordering in bootstrap)
- Echo-loop: After hydration, `syncQueue.count()` is zero — templates did not enqueue uploads
- Edge case: User with existing paths — templates merge alongside user paths without overwriting

**Verification:**
- After sign-in, templates appear in the Dexie `learningPaths` table with `isTemplate: true`
- Template entries appear in `learningPathEntries` with correct `pathId` references
- `syncQueue` table is empty after hydration
- No TypeScript or build errors

---

- [ ] **Unit 3: Discovery surface — restructure LearningPaths page**

**Goal:** Restructure `LearningPaths.tsx` to show template cards prominently on the empty state, and in a collapsible "Discover more paths" section at the bottom when the user has paths. Extract a shared `TemplateCard` component and modify the empty state.

**Requirements:** R4, R5, R6

**Dependencies:** Unit 2 (templates must be in Dexie), Unit 4 (route for Preview button navigation)

**Files:**
- Create: `src/app/components/course/TemplateCard.tsx` — template card component
- Modify: `src/app/pages/LearningPaths.tsx` — restructure empty/populated states, add template section

**Approach:**
- **Empty state** (`userPaths.length === 0` where `userPaths = paths.filter(p => !p.isTemplate)`): Show a "Start with a template" section above the fold with all 5 template cards in a grid. Below that, a secondary "Or create your own path" button that opens the existing `CreatePathDialog`. Removes the current `EmptyState` component's primary position.
- **Populated state** (userPaths.length > 0): User paths render as before (existing PathCard grid). Below them, a `Collapsible` section "Discover more paths" containing template cards in a horizontal scroll or smaller grid.
- **TemplateCard component**: Reuses the existing `Card` + rounded-2xl pattern. Shows: title, course count, estimated hours, difficulty curve label, topic tags as Badge components, a **match count** indicator ("X of Y courses in your library" — computed by comparing template entry `matchTitle` values against imported course names), and a "Preview" button linking to `/learning-paths/templates/:templateId`. Distinct visual treatment: subtle border accent (e.g., `border-brand-soft`), a "Template" Badge, and a template icon. Does NOT show progress ring (templates have no progress). The match count indicator sets expectations before the user commits to previewing/forking — a 0/5 match for a new user is honest about what they'll get.
- **Data loading**: Template cards load their own data via `useLearningPathStore` — filter `paths` where `isTemplate === true`. Self-contained — no prop-drilling from the parent.
- Follow the "extract on second consumer" principle — `TemplateCard` is a standalone component from the start since it has meaningfully different structure from `PathCard` (no progress, no dropdown menu, Preview instead of Link wrapper).

**Patterns to follow:**
- Card pattern: `motion.div variants={fadeUp}` + `Card rounded-2xl overflow-hidden`
- Empty state pattern: `EmptyState` component usage for secondary "create from scratch" prompt
- Collapsible pattern: `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` from shadcn/ui
- Self-contained section pattern from docs/solutions/best-practices/reports-page-redesign-patterns-2026-05-02.md

**Test scenarios:**
- Happy path: Empty state — template cards render above "Create your own" CTA
- Happy path: Populated state — user paths render first, collapsible template section at bottom
- Happy path: Clicking "Preview" on a template card navigates to the syllabus page
- Happy path: Template card displays course count, hours, difficulty label, topic tags
- Edge case: 0 templates (hydration failed or no seed data) — empty state falls back to the original "Create your first path" only
- Edge case: Collapsible section is initially collapsed on page load (populated state)
- Accessibility: Template cards are keyboard-navigable, Preview button has accessible name

**Verification:**
- Test with empty Dexie `learningPaths` (filtered to non-template) — template section is primary
- Test with 3+ user paths — template section is collapsed at bottom
- Template cards render with correct data from seed
- "Preview" button navigates correctly

---

- [ ] **Unit 4: Syllabus view — template preview page**

**Goal:** Create a new page at `/learning-paths/templates/:templateId` that shows the full template syllabus: course sequence with justifications, topic coverage summary, estimated hours per course, and difficulty progression chart. Includes "Use this template" primary action and "See a different template" navigation.

**Requirements:** R7, R8, R9, R11

**Dependencies:** Unit 2 (templates must be in Dexie), Unit 3 (route must exist), Unit 5 (forkTemplate action)

**Files:**
- Create: `src/app/pages/TemplateSyllabus.tsx` — syllabus view page
- Modify: `src/app/routes.tsx` — add `/learning-paths/templates/:templateId` route

**Approach:**
- **Route**: Lazy-loaded route at `learning-paths/templates/:templateId`. Registered in `routes.tsx` alongside the existing `/learning-paths` and `/learning-paths/:pathId` routes. CRITICAL: must be declared BEFORE the `/learning-paths/:pathId` route — React Router matches routes in order, and `:pathId` would capture the literal string "templates" if the template route is declared after it.
- **Data loading**: Read template from Dexie `learningPaths` by ID, entries from `learningPathEntries` by `pathId`. Both filtered client-side — no server request needed (already hydrated).
- **Page layout**:
  - Header: template name, difficulty curve label, estimated total hours, topic tags
  - Difficulty progression chart: Bar or Line chart using existing `chart.tsx` Recharts wrapper. X-axis: course position (1..N). Y-axis: difficulty level (1-5 or "Beginner" to "Advanced"). Rendered only if entries have difficulty data.
  - Course sequence: ordered list of entries, each showing title, justification, estimated hours, and topic tags. For entries with `courseId`, show a link to the course. For entries without `courseId`, show a "Course not in your library" gap indicator.
  - Topic coverage summary: aggregated from entry topic tags — count occurrences, show as Badge list.
- **"Use this template" button**: Primary CTA, `variant="brand"`. On click, calls `useLearningPathStore.getState().forkTemplate(templateId)`. Shows loading state during fork. On success, navigates to the new path's detail page. If already forked (R11), shows "Already in your paths" with a link.
- **"Already forked" check** (R11): `db.learningPaths.where('forkedFrom').equals(templateId).filter(p => !p.isTemplate).first()`. If non-null, show "Already in your paths" button linking to that path.
- **"See a different template"**: Secondary action that navigates to the next template. Order: by `createdAt` ascending (the seed order). Uses a simple "Next Template" button or a dropdown. Implementation: query all template IDs, find current index, navigate to next (wrap around to first).

**Patterns to follow:**
- Page layout pattern from `LearningPathDetail.tsx` — header section + content body
- Chart pattern from Reports page — Recharts wrapper with design tokens for colors
- Route registration pattern from `src/app/routes.tsx` — lazy-loaded with `React.lazy`

**Test scenarios:**
- Happy path: Navigate to `/learning-paths/templates/:templateId` — renders template name, course list, chart, topic tags
- Happy path: Click "Use this template" — fork succeeds, navigates to new path detail page
- Happy path: Template already forked — "Already in your paths" button links to existing path
- Happy path: Click "See a different template" / "Next Template" — navigates to next template
- Happy path: Last template "Next" wraps to first template
- Edge case: Invalid templateId in URL — shows "Template not found" with link back to paths list
- Edge case: Template has 0 entries — chart is hidden, empty course list shows appropriate message
- Edge case: Entries without courseId render as gap entries with "Import" action
- Error path: Fork fails — shows toast error, user remains on syllabus page, can retry
- Integration: After fork, new path appears in user's paths list with `forkedFrom` set

**Verification:**
- Syllabus page renders for each of the 5 templates
- Chart renders correctly with template entry difficulty data
- Fork creates a user-owned path with correct entries
- "Already forked" detection works after forking
- Next template navigation cycles correctly

---

- [ ] **Unit 5: Fork action — store logic**

**Goal:** Add a `forkTemplate` action to `useLearningPathStore` that creates a user-owned path from a template, copies entries (auto-linking matched courses, marking unmatched as gaps), and persists via `syncableWrite`.

**Requirements:** R8, R10

**Dependencies:** Unit 1 (data model must exist), Unit 2 (templates must be in Dexie)

**Files:**
- Modify: `src/stores/useLearningPathStore.ts` — add `forkTemplate` action
- Test: `src/stores/__tests__/useLearningPathStore.test.ts` (if it exists; otherwise create)

**Approach:**
- **`forkTemplate(templateId: string)`** async action:
  1. Read template and template entries from Dexie
  2. Read user's imported courses from `useCourseImportStore` to determine matches
  3. **Course matching algorithm** (see Key Technical Decisions): For each template entry with a non-null `matchTitle`, normalize both `matchTitle` and imported course names (lowercase, strip punctuation/whitespace, collapse spaces). If exactly one match → auto-link. If zero or multiple matches → gap entry. Entries with an explicit `courseId` that matches an imported course ID are auto-linked directly (exact match, bypasses title comparison).
  4. For each matched entry: set `courseId` = imported course ID, `courseType: 'imported'`
  5. For each unmatched entry: set `courseId: ''`, `courseType: 'catalog'`, preserve `matchTitle` as `justification` suffix (e.g., "Search for: JavaScript Fundamentals") so the gap entry UI can pre-fill an import search
  6. Generate new IDs: `crypto.randomUUID()` for the new path and each entry
  7. Create new `LearningPath`: copy name/description/estimatedHours/difficultyLabel from template, set `isTemplate: false`, `forkedFrom: templateId`, `createdAt: new Date().toISOString()`, `updatedAt: new Date().toISOString()`
  8. Write path first via `syncableWrite`, then entries sequentially (N+1 calls — consistent with existing store pattern). Path exists empty if entry writes fail (recoverable).
  9. Refresh in-memory state from Dexie
  10. Return the new path ID for navigation
- **Stale async guard**: Use generation counter pattern (from docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md). Increment a `forkGeneration` counter before the async work, check it after each `await`, abort if generation changed.
- **Functional set after await**: Use `set(state => ...)` for all state updates after async boundaries (from docs/engineering-patterns.md).
- **Rollback on failure**: Capture previous state before mutation, restore on error, show toast.

**Patterns to follow:**
- Existing store actions in `useLearningPathStore.ts` — optimistic update → `persistWithRetry(syncableWrite(...))` → refresh from Dexie → rollback on error
- Generation counter pattern from docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md
- `syncableWrite` wrapper from `src/lib/sync/syncableWrite.ts` — stamps userId + updatedAt, writes Dexie, enqueues to syncQueue

**Test scenarios:**
- Happy path: Fork template with 3/5 courses matching — creates path with 3 linked entries + 2 gap entries
- Happy path: Fork template with 0/5 courses matching — creates path with 5 gap entries
- Happy path: Fork template with 5/5 courses matching — creates path with 5 linked entries, 0 gaps
- Happy path: Forked path has `isTemplate: false` and `forkedFrom: templateId`
- Edge case: Fork while another fork is in progress — generation counter aborts stale operation
- Edge case: Fork template that was already forked — second fork creates independent copy (no duplicate detection needed; R11 is UI-level only)
- Error path: `syncableWrite` fails — state is rolled back, toast.error shown
- Integration: After fork, `syncQueue` contains entries for the new path and entries (verified upload)
- Integration: After fork, refreshing the paths list shows the new path

**Verification:**
- Fork creates a user-owned path visible in the paths list
- Course matching correctly identifies imported courses
- Gap entries render correctly in the path detail view
- Stale fork attempts are correctly aborted
- Failed forks leave state unchanged

---

- [ ] **Unit 6: Gap entries — UI rendering in path detail**

**Goal:** Render unmatched template courses as gap entries in `LearningPathDetail.tsx` with an "Import" action. When the user imports the missing course, the gap entry becomes a normal `LearningPathEntry`.

**Requirements:** R8 (gap entries with Import actions)

**Dependencies:** Unit 5 (fork action creates gap entries)

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx` — render gap entries (entries with empty `courseId`) with distinct styling and Import button

**Approach:**
- Gap entries are `LearningPathEntry` rows with `courseId: ''` and `courseType: 'catalog'`. No new entity type — purely a UI-level concept (see origin: Key Decisions).
- In `LearningPathDetail.tsx`, detect gap entries: `entry.courseId === ''`. Render with distinct visual treatment: muted/dashed border, the course title and description, and a "Find this course" button.
- **"Find this course" button**: Opens the existing course import dialog pre-filtered to the `matchTitle` value (extracted from the entry's `justification` field). This makes the import flow immediately useful — the user doesn't need to know what to search for; the template already told them. Uses `useCourseImportStore` to trigger the import flow with the search term.
- When the course is imported, update the entry's `courseId` and `courseType` via `syncableWrite` — it becomes a normal entry with a 300ms morph transition from dashed to solid card.
- If the path was forked from a template (`forkedFrom` is set), show a "This path was created from [template name]" banner with a link back to the template syllabus.
- **Expectation setting**: For paths with gap entries, show a summary at the top: "X of Y courses matched from your library. Import the remaining Z courses to complete this path." This frames the gaps as actionable next steps, not missing features.

**Patterns to follow:**
- Existing `LearningPathDetail.tsx` entry rendering — course cards with position, justification, reorder handles
- Gap entry visual pattern: use `border-dashed`, `text-muted-foreground` to distinguish from linked entries
- Toast feedback for import success/failure

**Test scenarios:**
- Happy path: Forked path with gap entries — gap entries render with distinct styling and Import button
- Happy path: Click Import on gap entry — navigates to course import flow
- Happy path: After importing course, gap entry updates to linked entry (courseId set, courseType becomes 'imported')
- Edge case: Path with 0 gap entries — no gap styling appears
- Edge case: Non-forked path (manual creation) — no template banner, no gap entries
- Integration: Template banner links back to correct template syllabus page

**Verification:**
- Gap entries are visually distinct from linked entries
- Import action triggers course import flow
- After import, entry becomes a normal linked entry
- Template banner shows on forked paths with correct link

## System-Wide Impact

- **Interaction graph:** `hydrateP3P4FromSupabase` gains two new queries (templates, template entries). `hydrateFromRemote` in `useLearningPathStore` gains template merge logic. `LearningPaths.tsx` restructured with new template section. New route at `/learning-paths/templates/:templateId`. `LearningPathDetail.tsx` gains gap entry rendering. `useLearningPathStore` gains `forkTemplate` action.
- **Error propagation:** Template hydration failure should not block user path hydration — fetch templates in a separate try/catch, log warning, continue with user paths only. Fork failure shows toast and stays on syllabus page (user can retry). Gap entry import failure shows toast and leaves entry as-is. Guest/anonymous users: `hydrateP3P4FromSupabase` exits early when `userId` is falsy — guests will not see templates (they see the original empty state fallback). This is acceptable since guests cannot create paths.
- **State lifecycle risks:** Templates merge into the Dexie `learningPaths` table via `bulkPut`. If a user creates a path with an ID that collides with a template ID, `bulkPut` would overwrite it. Mitigation: prefix template IDs with `template_` to avoid collision with user-generated UUIDs. Additionally, `importService.ts` calls `db.learningPaths.clear()` which would wipe templates from Dexie — after import, re-run template hydration to restore them, or filter out `isTemplate` rows before clearing.
- **API surface parity:** The new `learning_path_templates` table needs RLS policy enabling public read (anon key). The existing `learning_paths` RLS is unchanged. Template entries table needs matching public-read RLS.
- **Integration coverage:** Template hydration → Dexie → UI rendering (template cards render correct data). Fork → `syncableWrite` → Dexie → Supabase upload → download on another device (end-to-end sync of forked paths).
- **Unchanged invariants:** User path CRUD operations (`createPath`, `updatePath`, `deletePath`) are unchanged. `LearningPathDetail.tsx` for user-owned paths continues to work as before. The existing "Create your own path" dialog is preserved (moved to secondary position on empty state). Sync engine bootstrap ordering is preserved (templates hydrate before `syncEngine.start()`).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Template ID collision with user path IDs | Prefix template IDs with `template_` (e.g., `template_full-stack-dev`) |
| Template hydration fails, blocking user paths | Fetch templates in separate try/catch — failure logs warning, user paths still load |
| `syncableWrite` failure during fork leaves partial state | Write path first, then entries sequentially — each is atomic. On entry write failure, the path exists but is empty (recoverable). Rollback on path write failure. Note: `syncableWrite` handles one record per call, not batch — the fork action makes N+1 sequential calls, consistent with existing store actions like `deletePath`. |
| Template data changes after fork (no versioning) | Explicitly out of scope — accepted risk per requirements |
| RLS policy mismatch prevents template reads | Public-read RLS on templates tables, verified in test scenarios |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-03-learning-paths-03-templates-discovery-requirements.md](docs/brainstorms/2026-05-03-learning-paths-03-templates-discovery-requirements.md)
- Related code: [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx), [src/stores/useLearningPathStore.ts](src/stores/useLearningPathStore.ts), [src/lib/sync/hydrateP3P4.ts](src/lib/sync/hydrateP3P4.ts)
- Solutions: docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md, docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md, docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md
