---
date: 2026-05-03
topic: learning-paths-templates-discovery
parent: docs/ideation/2026-05-03-learning-paths-creation-ideation.md
---

# Path Templates & Discovery — Zero to Value Instantly

## Problem Frame

A new user with zero or few imported courses has no mental model of what a learning path looks like or why they should create one. The empty path list page (`LearningPaths.tsx`) shows a "Create your first path" CTA with no examples, no preview, and no immediate value. The `hydrateFromRemote` pipeline already exists in the sync engine and can deliver curated content with zero frontend code changes — but nothing is seeded. Templates solve the cold-start problem by showing complete, well-structured paths that demonstrate the feature's value before the user invests in creating their own.

## Requirements

### Template Paths

- **R1.** Pre-seed 3-5 curated template paths via Supabase, delivered through the existing `hydrateFromRemote` pipeline. Initial templates: "Full-Stack Developer", "Data Science Foundations", "iOS Development", "Machine Learning Engineering", "Product Design".
- **R2.** Each template includes: name, description, a fully sequenced course list (3-8 entries), AI-generated justifications for course order, estimated total hours, difficulty curve label ("Beginner → Intermediate", "Intermediate → Advanced"), and topic tags.
- **R3.** Template paths are marked with a `isTemplate: true` flag in the data model. They appear in the path list with a "Template" badge and a distinct visual treatment (subtle border accent, template icon).

### Discovery Surface

- **R4.** The empty path list page shows template cards in a "Start with a template" section above the "Create your own" CTA. Templates are the primary call to action for first-time users.
- **R5.** On the populated path list page, templates appear in a collapsible "Discover more paths" section at the bottom (below user-created paths).
- **R6.** Each template card shows: title, course count, total hours, difficulty curve, and a "Preview" button that opens the syllabus view.

### Syllabus View

- **R7.** Clicking "Preview" on a template opens a syllabus view (could be a dialog or a detail page variant) showing: the full course sequence with per-course justifications, topic coverage summary (aggregated from course tags), estimated hours per course, and difficulty progression chart.
- **R8.** The syllabus view has a "Use this template" primary action that forks the template into a user-owned path: all template courses that match the user's imported courses are auto-linked; unmatched courses show as gap entries with "Import" actions.
- **R9.** The syllabus view also has a "See a different template" action that navigates to the next template without closing/reopening.

### Template as Path

- **R10.** After forking a template, the resulting path is a normal user-owned path — editable, reorderable, with progress tracking. The `isTemplate` flag is cleared. A `forkedFrom` field records the template ID for analytics.
- **R11.** If the user already has a forked version of a template, the "Use this template" button shows "Already in your paths" with a link to that path.

## Success Criteria

- A new user with zero imported courses can browse 5 templates and understand what learning paths offer within 30 seconds
- Forking a template with 3/5 courses matched and 2 gaps produces a usable path immediately (matched courses are linked, gaps show import actions)
- The syllabus view renders the difficulty progression chart using existing chart components from Reports
- Templates are delivered via Supabase `hydrateFromRemote` — no new API endpoints or delivery mechanisms
- Template cards are visually distinct from user-created path cards without overwhelming the list page

## Scope Boundaries

- 3-5 initial templates only — no template marketplace, no community submissions, no template editor
- Template content is curated manually (a JSON file in the repo that gets seeded to Supabase), not AI-generated
- No template versioning — if a template is updated, existing forks are not affected
- No template ratings, reviews, or popularity metrics
- The syllabus view reuses existing chart components (`src/app/components/ui/chart.tsx`) — no new chart library

## Key Decisions

- **Delivery via hydrateFromRemote (not hardcoded):** Templates live in Supabase and are synced down like any other remote data. This means they appear in offline mode after first sync and respect the existing sync architecture. The seed data is a JSON file checked into the repo that gets applied via a migration or admin script.
- **Fork, don't reference:** Forking creates an independent copy. The user can modify it freely without affecting the template. This is simpler than a reference-based model and avoids template-update propagation complexity.
- **Gap entries as UI concept, not data model:** Unmatched template courses are rendered as special rows in the path view with import actions, but they're not persisted as a new entity type. When the user imports the course, it becomes a normal `LearningPathEntry`. This avoids schema changes.
- **Template placement on list page:** Templates are secondary on the populated list (bottom section) but primary on the empty list (above the fold). This respects existing users who already have paths while helping new users.

## Dependencies / Assumptions

- `hydrateFromRemote` pipeline is functional and handles template-flagged rows correctly
- Supabase has a `learning_paths` table (or will have one) that supports the `isTemplate` and `forkedFrom` fields
- The sync engine's `syncableWrite` rule allows writing forked paths as user-owned entities
- At least one chart component exists in the UI library for the difficulty progression visualization

## Outstanding Questions

### Resolve Before Planning

- None yet — ideation provides sufficient clarity.

### Deferred to Planning

- [Affects R1] Should templates be seeded via a Supabase migration or a one-time admin script? Does the `hydrateFromRemote` pipeline pull from a specific table or a general sync queue?
- [Affects R2] What is the exact schema for template course entries? Do they reference real course IDs (for matching) or are they descriptive (topic + rationale only)?
- [Affects R7] Syllabus view: dialog (quick dismiss, less immersive) or full page (more room for chart + course list, but adds a route)?
- [Affects R11] How is the "already forked" check performed — by `forkedFrom` field lookup across all user paths, or by a dedicated index?
- [Affects R4] Should the empty-state template section also show a "Create from scratch" action, or is that deferred to a secondary position?

## Next Steps

-> Ready for `/ce:plan`. This is the lowest-complexity idea in the set — good candidate for early implementation to establish the template infrastructure before Curriculum Composer changes the creation flow.
