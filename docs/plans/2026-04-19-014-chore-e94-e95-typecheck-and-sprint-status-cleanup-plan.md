---
title: "chore: E94/E95 typecheck cleanup and sprint-status drift fix"
type: refactor
status: active
date: 2026-04-19
---

# chore: E94/E95 typecheck cleanup and sprint-status drift fix

## Overview

Three bundled chore fixes after shipping E94/E95 sync stories (PRs #362–#371):

1. **Fix 7 TypeScript errors** surfaced by `npx tsc --noEmit` that slipped past esbuild (esbuild strips types rather than checking them).
2. **Wire `tsc --noEmit` into the ce:work execution flow** so these regressions get caught before merge, not after.
3. **Reconcile `sprint-status.yaml`** — the 10 shipped E94-S01 through E95-S03 stories are still marked `ready-for-dev` / `backlog` / `in-progress`, and the epic rows still say `in-progress`. This is a recurring drift pattern (happened twice in E92).

Shipped as a single chore PR with three reviewable commits on branch `chore/e94-e95-typecheck-and-sprint-status-cleanup`.

## Problem Frame

**Why tsc errors slipped through:** Vite uses esbuild for the dev build, which performs *type-erasure* rather than *type-checking*. `npm run build` exits 0 even when the codebase has type errors. `/review-story` has a `type-check` gate in `gates.json` that runs `tsc --noEmit`, but ce:work and the ce-orchestrator execution loop do not wait for `/review-story` to finish before moving to the next unit. So unit-by-unit implementation can accumulate type errors that are only caught at the terminal `/review-story` invocation — and in this batch of 10 stories, several were merged via fast-merge before the terminal review pass surfaced them.

**Why sprint-status drifted:** `/finish-story` and `ce:work` create PRs and merge them, but neither skill currently owns writing back to `sprint-status.yaml` for the just-shipped story. The `last_updated` field gets bumped when a *new* story is created (see line 58 comment), not when one ships. This is noted as a known recurring issue in memory ([feedback_sprint_status_drift.md](../../../.claude/../../../Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/feedback_sprint_status_drift.md)).

**Why now:** These 10 stories unblock E96 (Remaining Tables Sync) and E89/E108 (non-sync epics). Stale sprint-status risks duplicate work and confused `/sprint-status` reports.

## Requirements Trace

- **R1.** `npx tsc --noEmit` exits 0 at HEAD after the chore PR merges.
- **R2.** `npm run build` still exits 0 (no production-behavior regression).
- **R3.** `npm run test:unit` still passes (6180+ tests).
- **R4.** The `ThumbnailSource` union accepts `'server'` without expanding in ways that break downstream narrowing.
- **R5.** `tsc --noEmit` is wired into the `ce:work` execution flow such that future type regressions are caught before the terminal review pass.
- **R6.** `sprint-status.yaml` reflects `done` status for E94-S01 through E95-S03 (10 stories) and for epic-94 + epic-95 if all their tracked stories are done.
- **R7.** Existing sprint-status schema is preserved — no drift to a different field format.
- **R8.** Delivered as three reviewable commits on a single chore branch/PR.

## Scope Boundaries

- **Not a refactor.** Minimal-diff fixes only — no code cleanup, no test rewrites, no type-system tightening beyond what the errors demand.
- **Not a full sync-epic retrospective.** Retrospective for E94/E95 is separate (`epic-94-retrospective`, `epic-95-retrospective` — currently `optional`).
- **Not a broader ce:work pre-check redesign.** Only the `tsc --noEmit` integration is in scope; other pre-check ordering/adjacent gates are out of scope.
- **No feature flag changes, no migration changes, no production data touched.**

### Deferred to Separate Tasks

- **ABS read-path Vault refactor (KI-E95-S02-L01):** Tracked in [known-issues.yaml](../../docs/known-issues.yaml). Will be handled in a future epic, not in this chore.
- **Formalizing `/finish-story` to auto-update sprint-status.yaml:** This is the *structural* fix for the recurring drift. Out of scope for this chore (tactical cleanup only); recommend as a follow-up issue.
- **Adding `tsc --noEmit` to a git pre-push hook:** Defensive belt-and-braces; out of scope.

## Context & Research

### Relevant Code and Patterns

- **`src/data/types.ts`** — `ThumbnailSource` type alias at line 278. Currently `'auto' | 'local' | 'url' | 'ai'`. Used across thumbnail resolution pipeline ([src/lib/thumbnails/](../../src/lib/thumbnails/)) and sync ([src/lib/sync/storageDownload.ts](../../src/lib/sync/storageDownload.ts)).
- **`src/vite-env.d.ts`** — existing home for Vite-specific ambient module declarations. Correct location for `declare module '*?null-client'`.
- **`src/lib/sync/__tests__/`** — Vitest test suite following standard factory-based mocking patterns ([makeAuthor, makeBook factories]). `vi.fn()` mocks typed as `Mock<Procedure>`; `.mockResolvedValue` / `.mockReturnValue` are the correct APIs (not raw `.then`).
- **`.claude/skills/review-story/config/gates.json`** — authoritative pre-check gate registry. Lines 23–38 already define the `type-check` gate running `tsc --noEmit`. This confirms the pattern; the gap is *when* it runs, not *whether* it exists.
- **`.claude/skills/review-story/SKILL.md`:197** — invokes the unified pre-check script.
- **`.claude/skills/review-story/docs/pre-checks-pipeline.md`** — documents the six pre-check stages including type-check.
- **`.claude/skills/ce-orchestrator/references/review-loop.md`** — ce-orchestrator's review-loop contract. Candidate spot to reinforce the `/review-story` gate invocation.
- **`/Users/pedro/.claude/plugins/cache/compound-engineering-plugin/compound-engineering/2.65.0/skills/ce-work-beta/SKILL.md`** — cached ce:work-beta skill. Line 344 delegates pre-checks to project AGENTS.md. Not editable in this repo (plugin cache); project-side reinforcement is the right lever.
- **`docs/implementation-artifacts/sprint-status.yaml`** — schema is flat `story-slug: status` with inline comments. See lines 1157 (E93) and 1172–1191 (E94/E95) for the reference pattern. `# PR #XXX` comments are the convention for ship markers.

### Institutional Learnings

- **[feedback_sprint_status_drift.md](../../../.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/feedback_sprint_status_drift.md)** (from memory) — "Re-check sprint-status.yaml after every merged PR; drifted twice in E92 mega-run." This chore is the corrective pattern; the structural fix is deferred.
- **[feedback_pr_merge_strategy.md](../../../.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/feedback_pr_merge_strategy.md)** — "Force-merge PRs immediately after creation, no CI wait." Combined with esbuild's type-erasure, this is the mechanism by which tsc errors reach main.
- **[docs/engineering-patterns.md](../../docs/engineering-patterns.md)** — design-token, error-handling, and Dexie 4 quirks are documented institutional knowledge. `Mock<Procedure>` / vitest typing nuances should be added if not already present (check in Unit 1).

### External References

None required. All fixes are surgical, project-local, and the spec from the user already encodes the external best-practices (two-step `as unknown as` cast, `declare module '*?suffix'` for Vite query suffixes, `mockResolvedValue` over `.then`).

## Key Technical Decisions

- **Add `'server'` to `ThumbnailSource` as a union member, not a separate type.** Rationale: `storageDownload.ts:113` already assigns the string literal `'server'` directly; the minimal fix is expanding the union. Grep for downstream exhaustiveness-checking (`switch` over `ThumbnailSource`, `never` narrowings) before committing — if any exist, they need a case added. (Verification step in Unit 1.)
- **Use `declare module '*?null-client'` ambient declaration in `src/vite-env.d.ts`, not `@ts-expect-error`.** Rationale: the Vite query-suffix import pattern is a known Vite-isms; an ambient declaration is the documented upstream pattern and is forward-compatible with other `?suffix` tests. The suggested alternative (`@ts-expect-error`) is fragile — it breaks silently if the error ever resolves.
- **Schema fidelity for sprint-status.yaml.** Use the existing `# PR #XXX` inline-comment convention (see E92/E93 rows at lines 1142, 1157). Do NOT introduce `completedAt:` or `pr:` keyed fields — that would be schema drift. The user's task spec suggested these fields but the reference rows don't use them; matching the file's actual schema wins.
- **Integrate tsc at the ce:work layer, not by duplicating gates.json.** The authoritative gate definition already lives in `gates.json`. The real gap is ce:work not calling `/review-story` pre-checks between units. Strategy: add a short "Pre-Unit Typecheck" note to `.claude/skills/ce-orchestrator/references/review-loop.md` (or wherever the per-unit shipping contract lives) referencing the existing gate, instead of forking a second pre-check definition. **This keeps a single source of truth.**
- **Reconcile epic-94 / epic-95 rollup status.** If all shipped stories are marked `done`, mark the epic row `done` only when every sub-story (including those currently `backlog` like 95-4/95-5/95-6) is accounted for. **Do NOT auto-mark epic-94 or epic-95 as `done`** — epic-94 has no backlog stories beyond the 7 shipped, so epic-94 can be marked done; epic-95 has backlog items (95-4, 95-5, 95-6) so it must remain `in-progress`. Verify this at implementation time by scanning the epic rows.
- **Three-commit structure for reviewability.** Separating (a) type fixes, (b) workflow integration, and (c) doc-only sprint status update lets a reviewer approve or bounce each independently. Rollback granularity is a feature here.

## Open Questions

### Resolved During Planning

- **Q: Should the `'server'` `ThumbnailSource` value be added or should `storageDownload.ts:113` use a different value?** → **A: Add to union.** The emit site is semantically meaningful (source came from Supabase Storage / server download); coercing to an existing value would lose information. Add `'server'` as the fifth union member.
- **Q: Is there a ce:work-internal pre-check file we can edit to add tsc?** → **A: No in-repo one.** The ce-work-beta skill lives in the plugin cache (not editable from this project). The authoritative `/review-story` `type-check` gate already exists in `.claude/skills/review-story/config/gates.json`. The project-side lever is reinforcing the invocation contract in the ce-orchestrator review loop and the story workflow docs.
- **Q: What `completedAt` timestamp format does sprint-status use?** → **A: None — no such field exists.** The existing schema uses inline `# PR #XXX` comments and relies on git history for temporal data. Use that pattern; do not fabricate an `ISO completedAt` field.
- **Q: Is the epic-94 row done or still in-progress after these 7 stories?** → **A: Done**, because E94 has exactly 7 stories (94-1 through 94-7) and all are shipping in this batch per the task spec.
- **Q: Is the epic-95 row done?** → **A: Still in-progress**, because 95-4, 95-5, 95-6 are still `backlog`.

### Deferred to Implementation

- **Additional tsc errors surfaced at implementation time beyond the 6 enumerated.** The user spec allows for a 7th "any additional error" catch-all. Resolve these with the same minimal-diff posture. If a new error requires a non-trivial decision (e.g., a type system change that affects >3 call sites), pause and escalate rather than inventing the decision.
- **Exact ISO merge timestamps from `git log --format=%aI <sha>`.** Only needed if the final schema decision reverses and `completedAt:` does get introduced. Current plan avoids this.
- **Whether `engineering-patterns.md` needs a new "vitest Mock<Procedure> typing" entry.** Check in Unit 1; add inline if the pattern recurs and isn't documented.

## Implementation Units

- [ ] **Unit 1: Fix 7 TypeScript errors surfaced by `tsc --noEmit`**

**Goal:** Resolve every error from `npx tsc --noEmit` with minimal, behavior-preserving diffs. All 6 enumerated errors plus any 7th surprise.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None.

**Files:**
- Modify: `src/data/types.ts` — add `'server'` to `ThumbnailSource` union (line 278).
- Modify: `src/lib/sync/__tests__/p2-book-organization-sync.test.ts` — remove duplicate `id`/`name` keys at lines 329–330 (keep later-appearing values since those are the effective ones per JS object-literal semantics).
- Modify: `src/lib/sync/__tests__/p2-course-book-sync.test.ts` — delete unused `makeAuthor` import at line 50.
- Modify: `src/vite-env.d.ts` — add `declare module '*?null-client';` ambient declaration (with a 1-line comment explaining the Vite query-suffix test-mocking pattern).
- Modify: `src/lib/sync/__tests__/syncEngine.test.ts:191` — replace `.then(...)` call on mock with `.mockResolvedValue(...)` or `.mockReturnValue(Promise.resolve(...))` depending on which preserves the intended behavior.
- Modify: `src/lib/sync/__tests__/syncEngine.test.ts:1111` — change `as Record<string, unknown>` to `as unknown as Record<string, unknown>` (two-step cast).
- No new files.

**Approach:**
- Run `npx tsc --noEmit` first to print the full current error list. Treat the output as the source of truth — the user spec enumerates 6, but reserve capacity for a 7th.
- For the `ThumbnailSource` union change, grep for all consumers before committing: `rg "ThumbnailSource" src/ --type ts`. Look especially for exhaustiveness-enforcing `switch` statements or `case 'ai':` sequences that end in `default: assertNever(...)`. If one exists, add the `'server'` case.
- For the `vite-env.d.ts` change, verify this file exists first (standard Vite template). If missing, create it with the triple-slash Vite reference directive plus the declaration.
- For the `.then` fix: read the surrounding context to determine if the test wants immediate resolution (`mockResolvedValue`) or if chained call-site semantics matter (`mockReturnValue(Promise.resolve(...))`). Default to `mockResolvedValue` — it's the Vitest-idiomatic choice.
- After all fixes, re-run `npx tsc --noEmit` → expect 0. Then `npm run build` → 0. Then `npm run test:unit` → pass.

**Patterns to follow:**
- Vitest factory patterns in neighboring tests (`src/lib/sync/__tests__/`) for mock typing idioms.
- Existing ambient module declarations in `src/vite-env.d.ts` (check for prior `declare module` patterns — mirror the formatting).
- Two-step `as unknown as X` cast idiom: already used in a handful of places in the codebase for Dexie database cross-casts (grep `as unknown as` under `src/lib/sync/` to find precedent).

**Test scenarios:**
- Happy path: `npx tsc --noEmit` prints nothing to stdout and exits 0.
- Happy path: `npm run build` prints "built in …ms" and exits 0, identical bundle to baseline (no behavior drift).
- Happy path: `npm run test:unit` reports 6180+ passing tests, 0 failing, 0 new — identical count to pre-fix baseline.
- Edge case: the `ThumbnailSource` exhaustiveness check (if any `switch` on the union exists) still compiles and either handles `'server'` explicitly or routes it to the `default` branch with documented intent.
- Edge case: the `p2-book-organization-sync.test.ts` object literal deduplication preserves the *effective* (last-write-wins) values — re-run the specific spec file after the fix and confirm the same assertions pass.
- Edge case: after deleting the `makeAuthor` import, re-run `p2-course-book-sync.test.ts` — it must still pass without that import (the removal was genuinely unused, not masked-by-side-effect).
- Integration: `vi.mock('../storageDownload?null-client', ...)` at storageDownload.test.ts:420 resolves without the TS2307 error; the null-client mock behaves as the test expects (no null pointer surprises in test output).
- Integration: the two-step cast at syncEngine.test.ts:1111 preserves runtime behavior — the test suite passes (vi.fn types are compile-time only; runtime is unaffected).

**Verification:**
- `npx tsc --noEmit` exits 0 with no output.
- `npm run build` exits 0.
- `npm run test:unit` exits 0 with no change in pass count.
- `git diff --stat` shows changes to exactly the 6 enumerated files (plus `src/vite-env.d.ts` if it was created fresh, plus a 7th file only if a 7th error was surfaced).

---

- [ ] **Unit 2: Wire `tsc --noEmit` into the ce:work execution flow**

**Goal:** Ensure type regressions like the ones fixed in Unit 1 cannot be merged to main again without being caught before the terminal review pass. Prevent future drift from esbuild's type-erasure behavior.

**Requirements:** R5

**Dependencies:** Unit 1 lands first (so the baseline is clean when the new gate enforcement starts).

**Files:**
- Modify: `.claude/skills/ce-orchestrator/references/review-loop.md` — add a "Type-check gate" subsection referencing the existing `gates.json` `type-check` entry and stating that ce-orchestrator runs must invoke it (or the `/review-story` pre-check bundle) before marking a unit "done."
- Modify: `.claude/rules/workflows/story-workflow.md` — in the "Quality Gates" section (already lists `Type check (npx tsc --noEmit with auto-fix)` under Pre-checks), add a one-line rationale: "catches type regressions esbuild misses during the dev build."
- Modify: `.claude/rules/automation.md` — if the Review-Time Enforcement table doesn't already call out tsc, add a note pointing to the gate; otherwise skip.
- Verify (read-only): `.claude/skills/review-story/config/gates.json` — confirm the `type-check` entry at lines 29–38 is unchanged; do not duplicate.
- Verify (read-only): `.claude/skills/review-story/docs/pre-checks-pipeline.md` — confirm tsc is already in the pipeline docs; do not duplicate.

**Approach:**
- **Do not duplicate the gate definition.** Single source of truth is `gates.json`. Everywhere else is a reference.
- The real gap is that ce:work execution runs unit-by-unit and only invokes `/review-story` at the end. Adding a between-unit "run pre-checks" step would be a larger design change. Minimum-viable fix: tighten the contract in `review-loop.md` so the orchestrator is *expected* to invoke the type-check gate before declaring a unit done. Future work can automate this (deferred to separate task).
- Rationale comment ("catches type regressions esbuild misses") should be placed where operators of the workflow will see it — `story-workflow.md` rules file is the right spot because it's a universal rule always loaded into Claude Code sessions.
- Keep edits *small*. If the review-loop.md file already references a pre-check invocation, just add a one-liner reinforcing tsc. If it doesn't, add a three-line block (heading + one-line rationale + pointer to gates.json).

**Patterns to follow:**
- `.claude/rules/workflows/story-workflow.md` Quality Gates table format (flat list with parens for the command).
- `gates.json` schema — but only for *reading*; don't edit.
- How the `format-check` and `unit-tests` gates are cross-referenced from multiple docs without duplicating definitions (search for `format-check` in `.claude/` to see the pattern).

**Test scenarios:**
- Test expectation: none — this is a documentation-only change to skill/rules files. The "test" is that a future ce:work run with an intentionally-broken type (inject a temp type error in a throwaway branch) would surface the error before merge. That verification is qualitative, not automated here.
- Verification scenario: after merging, run `grep -rn "tsc --noEmit\|type-check" .claude/rules/workflows/ .claude/skills/ce-orchestrator/` and confirm the new references land in the expected files with the correct rationale text.

**Verification:**
- `.claude/rules/workflows/story-workflow.md` contains the one-line "catches type regressions esbuild misses" rationale.
- `.claude/skills/ce-orchestrator/references/review-loop.md` references the `type-check` gate (either by name or by linking to `gates.json`).
- No new gate definition is introduced in `gates.json`; no duplicate pre-check script is created.
- `git diff` for this unit shows only `.md` files — no `.json` or `.ts` changes.

---

- [ ] **Unit 3: Update `sprint-status.yaml` for E94-S01 through E95-S03**

**Goal:** Reconcile the 10 shipped stories from `in-progress` / `ready-for-dev` / `backlog` to `done`, with inline `# PR #XXX` comments matching the existing schema. Roll up epic-94 to `done` (all 7 stories shipped); keep epic-95 at `in-progress` (95-4/5/6 still backlog). Bump `last_updated` with a note.

**Requirements:** R6, R7

**Dependencies:** None (doc-only). Can technically be done first, but is sequenced last so commit ordering matches the PR structure (code changes before doc cleanup).

**Files:**
- Modify: `docs/implementation-artifacts/sprint-status.yaml` — lines 1170–1191 (E94 + E95 blocks) plus the `last_updated` field around line 58.

**Approach:**
- Edit the 10 story rows:

  | Story row key | Current status | New status + comment |
  |---|---|---|
  | `94-1-p2-supabase-migrations-courses-videos-pdfs-authors-books` | `in-progress` (with startedAt comment) | `done  # PR #362` |
  | `94-2-course-and-book-metadata-sync-with-field-stripping` | `backlog` | `done  # PR #363` |
  | `94-3-book-reviews-shelves-and-reading-queue-sync` | `in-progress` (with startedAt comment) | `done  # PR #364` |
  | `94-4-supabase-storage-bucket-setup-and-file-upload` | `ready-for-dev` | `done  # PR #365` |
  | `94-5-file-download-on-new-device` | `ready-for-dev` | `done  # PR #366` |
  | `94-6-chapter-mappings-sync` | `ready-for-dev` | `done  # PR #367` |
  | `94-7-book-files-storage-integration` | `ready-for-dev` | `done  # PR #368` |
  | `95-1-full-settings-sync-expansion` | `ready-for-dev` | `done  # PR #369` |
  | `95-2-api-keys-and-all-credentials-via-supabase-vault` | `ready-for-dev` | `done  # PR #370` |
  | `95-3-server-authoritative-entitlements` | `ready-for-dev` | `done  # PR #371` |

- Update `epic-94: in-progress` → `epic-94: done  # PRs #362-#368, completed 2026-04-19` (mirrors E92/E93 rollup pattern at lines 1142, 1157).
- Leave `epic-95: in-progress` unchanged (backlog stories 95-4/5/6 remain).
- Update `last_updated:` near line 58 from `2026-04-19  # E95-S03 story created …` to `2026-04-19  # E94-S01 through E95-S03 shipped (PRs #362-#371)`.
- **Do not add `completedAt:` or `pr:` fields** (see Key Technical Decisions) — that would break schema consistency with the 200+ existing done-story rows in the file.
- **Do not fabricate ISO merge timestamps.** Git history is the source of truth for when things shipped.
- **Do not touch rows for stories not in this batch** (95-4, 95-5, 95-6, or any other epic). Scope discipline.

**Patterns to follow:**
- E92 completed block at lines 1142–1152 — same shape: `epic-92: done  # PRs #342-#348, completed 2026-04-18` and sub-stories `done  # PR #XXX`.
- E93 completed block at lines 1157–1170 — same shape.
- `last_updated` comment format: date + short note about what triggered the refresh.

**Test scenarios:**
- Test expectation: none — doc-only change. Schema stability is validated by visual diff + the sprint-status.yaml-consuming scripts (`/sprint-status`) running cleanly post-change.
- Verification scenario: after editing, run a quick `grep -c "^  94-[1-7].*done" docs/implementation-artifacts/sprint-status.yaml` → expect 7. Run `grep -c "^  95-[1-3].*done" docs/implementation-artifacts/sprint-status.yaml` → expect 3. Run `grep "^  epic-94:" docs/implementation-artifacts/sprint-status.yaml` → shows `done`. `grep "^  epic-95:" …` → still `in-progress`.
- Verification scenario: if any project tooling parses sprint-status.yaml (e.g., `/sprint-status` skill), run it and confirm no parse errors and no unexpected status transitions.

**Verification:**
- All 10 story rows show `done` with a `# PR #XXX` inline comment.
- `epic-94: done` with PR range comment; `epic-95: in-progress` unchanged.
- `last_updated:` reflects the ship batch.
- No schema drift (no new fields introduced).
- `git diff docs/implementation-artifacts/sprint-status.yaml` shows ~14 changed lines (10 story rows + 1 epic rollup + 1 last_updated + `in-progress` comment cleanup on 94-1 / 94-3 where the `startedAt` inline comments get replaced).

## System-Wide Impact

- **Interaction graph:** Unit 1's `ThumbnailSource` union change touches the thumbnail resolution pipeline. Any consumer that uses `ThumbnailSource` in an exhaustive `switch` will need a `'server'` case — grep is the mitigation.
- **Error propagation:** No new error paths introduced. All three units preserve existing error-handling behavior.
- **State lifecycle risks:** None. Unit 1 is type-only; Unit 2 is doc-only; Unit 3 is YAML-only. No persistent state changes.
- **API surface parity:** `ThumbnailSource` is an internal type, not a public API. Adding a union member is backward-compatible — existing code that matches on the existing 4 values continues to work; only exhaustiveness checks need attention.
- **Integration coverage:** Unit 1's fix for `storageDownload.test.ts:420` (`'../storageDownload?null-client'` module declaration) unblocks an integration test that mocks the entire storageDownload module with null behavior. Worth running the whole `src/lib/sync/__tests__/storageDownload.test.ts` file after the fix to confirm the null-client test path executes.
- **Unchanged invariants:** `npm run build` output is byte-equivalent (or within bundle noise) to pre-PR — all Unit 1 fixes are type-system-only. `npm run test:unit` pass count is unchanged. Production behavior: unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| A 7th tsc error surfaces that needs a non-trivial decision (e.g., a deep type refactor). | Unit 1's "Deferred to Implementation" note covers this — pause, escalate, don't invent. Most likely outcome: it's another trivial fix. |
| Adding `'server'` to `ThumbnailSource` breaks an existing exhaustiveness-check `switch` that uses `assertNever` or `never`. | Pre-emptive grep in Unit 1 approach. If found, add a case. |
| `src/vite-env.d.ts` doesn't exist (non-standard Vite setup). | Unit 1 approach explicitly handles this — create the file with the standard Vite triple-slash reference if missing. |
| `sprint-status.yaml` gets edited concurrently by another session while this chore is in progress. | Low probability (solo dev). If it happens, rebase and re-apply the Unit 3 diff — it's mechanical. |
| Unit 2's doc-only changes don't actually change future ce:work behavior because the orchestrator still doesn't read the updated docs. | Accepted risk. Structural fix (auto-invoke tsc between units) is deferred. This chore reinforces the contract; full automation is follow-up work. |
| The three commits get squashed accidentally, hurting reviewability. | PR description explicitly requests merge-commit or rebase-merge, not squash. `chore/*` branches in this repo are typically merged with commits preserved (verify via recent chore PRs on GitHub). |

## Documentation / Operational Notes

- **Known issue tracker:** No new entries needed in `docs/known-issues.yaml`. The ABS read-path deferral (KI-E95-S02-L01) is already tracked.
- **Engineering patterns:** If Unit 1 reveals a recurring vitest mock typing gotcha not yet in `docs/engineering-patterns.md`, add a 3–5 line entry. Decide during implementation.
- **Memory:** The [feedback_sprint_status_drift.md](../../../.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/feedback_sprint_status_drift.md) memory is already accurate — no update needed. Consider adding a follow-up memory once structural automation lands.
- **PR description:** One-paragraph summary + three commit bullets + verification output (`tsc --noEmit` clean, build passes, tests pass, sprint-status diff visible). No screenshots needed (no UI change).
- **Merge strategy:** Per [feedback_pr_merge_strategy.md](../../../.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/feedback_pr_merge_strategy.md) — force-merge once CI passes; no waiting.

## Sources & References

- **Task spec:** User's `/ce-plan` invocation (inline in conversation).
- Related code:
  - `src/data/types.ts:278` — `ThumbnailSource` union
  - `src/lib/sync/storageDownload.ts:113` — emit site of `'server'`
  - `src/lib/sync/__tests__/*.test.ts` — test files with type errors
  - `src/vite-env.d.ts` — Vite ambient module declarations
  - `.claude/skills/review-story/config/gates.json:23-38` — existing `type-check` gate
  - `docs/implementation-artifacts/sprint-status.yaml:1142, 1157, 1170-1191` — reference rows
- Related PRs: #362, #363, #364, #365, #366, #367, #368, #369, #370, #371
- External docs: None required.
- Institutional memory:
  - feedback_sprint_status_drift.md
  - feedback_pr_merge_strategy.md
  - feedback_review_loop_max_rounds.md (tangential)
