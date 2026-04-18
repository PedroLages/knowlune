---
title: "Promote E92 Patterns to Documentation & Memory"
type: feat
status: active
date: 2026-04-18
origin: /Users/pedro/.claude/plans/clever-dancing-sunbeam.md
---

# Promote E92 Patterns to Documentation & Memory

## Overview

Capture the 4 reusable patterns and 4 institutional facts that emerged during Epic E92 (Supabase Data Sync foundation) so that E93–E97 start warmer. This is documentation + memory only — no code changes.

## Problem Frame

E92 shipped 7 stories on 2026-04-18, introducing reusable patterns and API surface that currently live only in commit history and the orchestrator's ephemeral tracking files. Without promoting them:

- Every E93–E97 story will re-discover patterns via code search (slow).
- The same mistakes get repeated (`Promise.any` in ES2020, wrong Dexie `sortBy` return type, stale `sprint-status.yaml`).
- `docs/engineering-patterns.md` (read by humans + CE planners before every story) stays blind to E92 work.
- `episodic-memory-searcher` (Phase 0.5 of `/ce-orchestrator`) cannot surface sync-engine APIs, Dexie 4 quirks, or ES2020 constraints because no memory file covers them.

## Requirements Trace

- R1. Append 4 new pattern sections to `docs/engineering-patterns.md` matching the existing H2 + ✅/❌ + case-study format.
- R2. Create one solutions entry for the architectural `single-write-path` pattern (the one deep enough to warrant narrative treatment).
- R3. Create 4 memory files (3 reference, 1 feedback) in the user's memory directory, each with the standard `name/description/type` frontmatter.
- R4. Add 4 new bullets to `MEMORY.md` (one per memory file), matching existing one-line-hook format.
- R5. No code changes; no build/lint/test runs required.

## Scope Boundaries

- No ESLint rule for `syncableWrite` enforcement (tracked as future tech debt).
- No retrospective entry in `docs/retrospectives/` (owned by `bmad-retrospective`).
- No updates to `CLAUDE.md` or `.claude/rules/` (patterns live in `engineering-patterns.md` by convention).

### Deferred to Separate Tasks

- Appending the 6 new E92 known-issues (S05-01, S05-02, etc.) to `docs/known-issues.yaml` — separate scope from the original E92 report.

## Context & Research

### Relevant Code and Patterns

- `docs/engineering-patterns.md` — current format: 26 H2 sections, no frontmatter, ✅/❌ code examples, epic case-study references. Follow exactly.
- `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md` — frontmatter schema template for the new solutions entry.
- `/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/` — memory directory. All existing files use `name/description/type` YAML frontmatter. Patterns live alongside `reference_*.md`, `feedback_*.md`, `project_*.md`, `user_*.md`.
- `src/lib/sync/__tests__/syncableWrite.test.ts` lines 20–28 — reference for `vi.hoisted()` pattern.
- `src/lib/sync/__tests__/syncEngine.test.ts` lines 18–55 — comprehensive `vi.hoisted()` example.
- `src/app/components/sync/LinkDataDialog.tsx` lines 59–73 — reference for `ignore` flag cleanup.
- `src/lib/sync/syncEngine.ts` line 137 + 880–882 — module-level registry map pattern + public API.
- `src/lib/sync/syncableWrite.ts` lines 66–166 — single-write-path wrapper.

### Institutional Learnings

- Sprint-status drift was a recurring issue during E92 mega-run — encoding it as a feedback memory prevents recurrence across future multi-story runs.
- ES2020 target caught the team twice in E92-S08 — a reference memory is cheaper than re-learning.

### External References

None required — this is pure internal documentation.

## Key Technical Decisions

- **Engineering patterns AND memory files (both, not either/or)**: `engineering-patterns.md` is the human + BMAD-planner reference; memory files feed `episodic-memory-searcher` in CE orchestrator Phase 0.5. Different consumers, different formats, both needed.
- **One solutions entry for `single-write-path`, not four**: Only the single-write-path pattern is architectural enough to warrant narrative treatment in `docs/solutions/`. The other three are tactical patterns — they belong in `engineering-patterns.md` only.
- **Append-only edits to `engineering-patterns.md`**: Do not reorganize or renumber existing sections. New patterns go at the end as 4 new H2 blocks. Preserves reviewability and avoids touching unrelated content.
- **Memory frontmatter matches existing files exactly**: `name/description/type` — do not invent new fields.
- **MEMORY.md is an append, not a re-sort**: Append 4 bullets at the end of the list; do not reorder existing entries.

## Open Questions

### Resolved During Planning

- Why both engineering-patterns and memory files? → Different consumers; see Key Technical Decisions.
- Which patterns get a solutions entry? → Only `single-write-path` (architectural). The other three are tactical.
- Where do the new sections go in `engineering-patterns.md`? → Append at end; preserve existing order.

### Deferred to Implementation

- Exact prose wording inside each pattern block — will be drafted while writing, guided by the bullet-summary in the origin plan.
- Whether to inline the code `✅/❌` examples from source files verbatim or abridge — decide during drafting based on length budget (~40–80 lines per pattern).

## Implementation Units

- [ ] **Unit 1: Append 4 patterns to `docs/engineering-patterns.md`**

**Goal:** Add 4 new H2 sections (vi.hoisted, ignore-flag cleanup, module-level registry map, single-write-path) at end of file, matching existing style.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `docs/engineering-patterns.md`

**Approach:**
- Append 4 new `## ...` sections in order: (1) `vi.hoisted()` for shared mocks, (2) `ignore` flag cleanup for async useEffect, (3) Module-level Map registry, (4) Single-write-path architecture.
- Each section: Problem → Solution → ✅/❌ code example (where applicable) → When-to-use → Case study (epic + PR).
- Keep each pattern ~40–80 lines. Match existing sections' density.
- Use repo-relative paths in all code references (e.g., `src/lib/sync/syncableWrite.ts:66-166`).

**Patterns to follow:**
- Existing H2 sections in `docs/engineering-patterns.md` — especially ones with epic case-study footers (e.g., the closing `backfillUserId` case study from E92-S02).

**Test expectation:** none — documentation-only change with no behavioral logic.

**Verification:**
- Intro of `docs/engineering-patterns.md` unchanged (top 3 lines identical to before).
- H2 count increased by 4 (was 26 → 30).
- All 4 new section titles greppable: `vi.hoisted`, `ignore flag cleanup`, `Module-level Map`, `Single Write Path`.
- All referenced line numbers resolve to real code at time of writing.

- [ ] **Unit 2: Create solutions entry for single-write-path**

**Goal:** Create a narrative solutions entry at `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md` that captures the architectural reasoning behind the single-write-path decision.

**Requirements:** R2

**Dependencies:** None (independent of Unit 1; can run in parallel)

**Files:**
- Create: `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md`

**Approach:**
- Use frontmatter schema from `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md` (title, date, category, module, problem_type, component, severity, tags).
- Sections: Context → Problem → Solution (with code example pointing to `src/lib/sync/syncableWrite.ts`) → Why This Works → When to Apply → Enforcement (convention + review for now; ESLint future) → Related (E92-S04 PR #343, E92-S09 PR #348).
- Deeper and more narrative than the engineering-patterns entry — explain the architectural invariant (one write path = one place to stamp metadata, enqueue, and nudge engine).

**Patterns to follow:**
- Existing solutions entry at `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`.

**Test expectation:** none — documentation-only.

**Verification:**
- File exists at expected path.
- Frontmatter parses (YAML fences closed, required keys present: title, date, category, module, problem_type, component, severity, tags).
- Content includes links to both PRs (#343, #348) and at least one repo-relative code reference.

- [ ] **Unit 3: Create 4 memory files**

**Goal:** Create 3 reference memory files (sync engine API, Dexie 4 quirks, ES2020 constraints) and 1 feedback memory file (sprint-status drift) in the user's memory directory.

**Requirements:** R3

**Dependencies:** None (independent of Units 1 and 2)

**Files:**
- Create: `/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/reference_sync_engine_api.md`
- Create: `/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/reference_dexie_4_quirks.md`
- Create: `/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/reference_es2020_constraints.md`
- Create: `/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/feedback_sprint_status_drift.md`

**Approach:**
- Each file uses the `name/description/type` frontmatter observed in existing memory files.
- `reference_sync_engine_api.md`: public API surface of `src/lib/sync/syncEngine.ts` (`start`, `stop`, `fullSync`, `nudge`, `registerStoreRefresh`, `currentUserId`, `isRunning`); note `syncableWrite` rule; list wired P0 stores (contentProgress, studySessions, progress).
- `reference_dexie_4_quirks.md`: `sortBy()` returns `Promise<T[]>` (not chainable), async upgrade callbacks, `syncQueue` terminal status = `'dead-letter'` (not `'dead'`).
- `reference_es2020_constraints.md`: `Promise.any` NOT available, `Promise.allSettled` IS, optional chaining + nullish coalescing IS; note E92-S08 refactor context.
- `feedback_sprint_status_drift.md`: rule + **Why** (E92-S03 and E92-S06 drifted during mega-run) + **How to apply** (grep sprint-status.yaml after each merged PR).

**Patterns to follow:**
- Existing memory files in the same directory — particularly `reference_supabase_unraid.md` (reference type) and `feedback_review_agent_model.md` (feedback type with Why/How-to-apply structure).

**Test expectation:** none — documentation-only.

**Verification:**
- All 4 files exist.
- Each file has valid YAML frontmatter with `name`, `description`, `type` fields.
- Types are exactly `reference` (x3) or `feedback` (x1).

- [ ] **Unit 4: Update MEMORY.md index**

**Goal:** Append 4 new bullets to `MEMORY.md` (one per new memory file) so `episodic-memory-searcher` can discover them.

**Requirements:** R4

**Dependencies:** Unit 3 (memory files must exist before being indexed)

**Files:**
- Modify: `/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/MEMORY.md`

**Approach:**
- Append 4 bullets at the end of the existing list.
- Format: `- [filename.md](filename.md) — one-line hook under ~150 chars`.
- Preserve existing entries verbatim; no reordering.

**Patterns to follow:**
- Existing `MEMORY.md` bullet format (one-line hook per bullet, relative link).

**Test expectation:** none — index file update.

**Verification:**
- `MEMORY.md` line count grew by exactly 4 bullet lines.
- All 4 new files referenced by correct relative filename.
- Each hook is under ~150 chars and communicates the memory's purpose.

## System-Wide Impact

- **Interaction graph:** `docs/engineering-patterns.md` is loaded by BMAD story-creation and CE planner workflows via the `.claude/rules/` references. `MEMORY.md` is loaded into every Claude Code session automatically (first 200 lines).
- **State lifecycle risks:** None — pure additive documentation.
- **API surface parity:** None — no code APIs change.
- **Unchanged invariants:** All existing patterns, solutions, and memory entries remain byte-identical. Only appends.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Memory files created but `MEMORY.md` not updated — invisible to searcher | Unit 4 depends on Unit 3; verification step confirms 4 new bullets. |
| Line references in pattern doc rot over time | Use `path:line-range` format matching existing convention; treat as point-in-time references (same as other sections in engineering-patterns.md). |
| `MEMORY.md` exceeds 200-line truncation limit | Current MEMORY.md is ~25 entries (<50 lines); +4 bullets keeps it well under 200. |
| Duplicate memory content vs. existing files | Unit 3 creates strictly new topics (sync engine API, Dexie 4, ES2020, sprint drift) — none overlap with existing memory titles. |

## Documentation / Operational Notes

- After merge, the next E93 story run should be a soft smoke test: run `/ce-orchestrator E93-S01` (when ready) and verify Phase 0.5 `episodic-memory-searcher` surfaces at least one of the 4 new memory files.
- No rollout, feature-flag, or monitoring concerns — documentation only.

## Sources & References

- **Origin document:** `/Users/pedro/.claude/plans/clever-dancing-sunbeam.md` (pre-written input plan)
- Related code: `src/lib/sync/syncableWrite.ts`, `src/lib/sync/syncEngine.ts`, `src/app/components/sync/LinkDataDialog.tsx`, `src/lib/sync/__tests__/syncEngine.test.ts`
- Related PRs: #343 (E92-S04), #345 (E92-S06), #347 (E92-S08), #348 (E92-S09)
- Related docs: `docs/engineering-patterns.md`, `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`
