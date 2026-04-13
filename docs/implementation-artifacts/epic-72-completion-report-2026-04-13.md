# Epic 72 Completion Report: Tutor Memory & Learner Model

**Date:** 2026-04-13
**Epic:** E72 — Tutor Memory & Learner Model
**Status:** Done
**Author:** Pedro Lages

---

## 1. Executive Summary

Epic 72 delivered a full tutor memory stack: a persistent per-course `LearnerModel` in Dexie (v51 migration), mode-tagged messages with a memory transparency UI, and a session boundary pipeline that uses an LLM to enrich the learner model after each session. All three stories shipped with no production incidents and one deliberate deferral (idle timeout, tracked in known-issues).

The first-pass review rate was 0% — every story required R2 to resolve TypeScript type errors or missing test coverage. No story required a third round. Post-epic validation added 19 unit tests to address P1 trace gaps. The NFR gate passed (83% criteria met). The build is clean.

---

## 2. Stories Delivered

| Story | Name | PR | Review Rounds | Issues Fixed |
|-------|----|-----|---------------|--------------|
| E72-S01 | Learner Model Schema & CRUD Service | #321 | 2 | 3 |
| E72-S02 | Mode-Tagged Messages & Memory Transparency UI | #322 | 2 | 6 |
| E72-S03 | Session Boundary Learner Model Update Pipeline | #323 | 2 | 6 |

**Totals:** 3 stories · 6 review rounds · 15 issues fixed

---

## 3. Review Metrics

### Issues by Severity (All Stories Combined)

| Severity | Count | Notes |
|----------|-------|-------|
| BLOCKER | 0 | None found |
| HIGH | 5 | 1 type mismatch (S01), 2 type errors (S03), 1 unsafe cast (S03), 1 missing test task (S02) |
| MEDIUM | 6 | UI edge cases, Zod schema mismatches, test assertions |
| LOW | 4 | Naming, minor UI polish, console.warn gaps |

All HIGH issues were resolved in R2. No story exceeded two review rounds.

### Review Round Summary

| Story | R1 Outcome | R1 HIGHs | R2 Outcome |
|-------|-----------|----------|-----------|
| E72-S01 | FAIL | 1 (TutorMode type propagation) | PASS |
| E72-S02 | FAIL | 1 (Task 7 — 9 tests missing) | PASS |
| E72-S03 | FAIL | 2 (unsafe Zod cast, LLM schema mismatch) | PASS |

---

## 4. Deferred Issues

### Known Issues (Deferred from This Epic)

| Issue | Severity | Deferred To | Notes |
|-------|----------|-------------|-------|
| Idle timeout (30 min) session boundary trigger | LOW | Future chore | Session boundary fires on visibility change and unmount; idle case not implemented |

### New Pre-Existing Issues

None. No pre-existing issues were discovered during E72 work.

---

## 5. Post-Epic Validation

### 5a. Traceability — Gate: CONCERNS → Fixed

The trace gate returned CONCERNS. P1 FULL coverage was 59% (below the 80% minimum), driven by missing tests for the TutorMemoryEditDialog clear-memory flow, MessageBubble mode labels, and the LLM prompt construction path.

A fix pass was executed immediately after the trace report.

**19 tests added** (commit `8e87832d`):

| Area | Tests Added | AC Items Addressed |
|------|-------------|-------------------|
| Session boundary (updateFromSession ≥3 exchanges) | 4 | S03-AC1 |
| TutorMemoryEditDialog (clear-memory flow) | 6 | S02-AC7 |
| MessageBubble mode labels | 5 | S02-AC9 |
| Zod validation failure path (invalid JSON from LLM) | 3 | S03-AC10 |
| LLM prompt builder (slot 6 injection) | 1 | S03-AC5 |

After the fix pass, P1 coverage reached 88% FULL (above the 80% minimum). Gate resolved.

**One item deferred to known-issues:** idle timeout session boundary trigger (session idle > 30 min). Confirmed low-priority — not a gap in the shipped feature's core path.

### 5b. NFR Assessment — Gate: PASS

Overall NFR status: **PASS** (24/29 criteria met, 83%).

| Category | Status | Notes |
|----------|--------|-------|
| Testability & Automation | PASS | 63 unit tests, Dexie mocked, pure service modules |
| Test Data Strategy | PASS | FIXED_DATE, factory helpers, vi.clearAllMocks |
| Scalability & Availability | PASS | topicsExplored capped at 10, LLM message window capped at 20 |
| Disaster Recovery | PASS | Double-fallback: LLM fail → local insights → warn and exit |
| Security | PASS | Zod validates all LLM output, content truncated at 200 chars, no PII logged |
| Monitorability | CONCERNS | console.warn only — no structured logging or Sentry integration |
| QoS & QoE | PASS | Fire-and-forget LLM call, isRemoving guard, session cap |
| Deployability | PASS | Additive v51 migration, backward compatible, schema.test.ts validates version |

The single CONCERNS item (Monitorability) is LOW severity — client-side PWA apps have no distributed tracing requirement. Recommended future action: add `Sentry.captureException` in the `updateFromSession` catch block.

---

## 6. Lessons Learned

### L1: TypeScript type propagation must follow union type expansions

When a shared union type (like `TutorMode`) is expanded, immediately search all consumer types using the old literal union and update them. Running `tsc --noEmit` locally before pushing would have caught both S01 and S03's type errors before code review. Neither error required human judgment to detect — the compiler would have blocked them.

**Action A1:** Add `tsc --noEmit` to the pre-push git hook.
**Action A5:** Add `tsc --noEmit` to the story pre-review checklist as a mandatory step.

### L2: Acceptance criteria task boxes are hard gates, not checklists

S02's Task 7 (9 acceptance tests) was in the story file and was not implemented before the first review submission. The review caught it and R2 added the tests, but the process is wrong. All task checkboxes represent committed scope. If a task is not done, either complete it or explicitly defer it with a `known-issues.yaml` entry and reviewer sign-off.

**Action A2:** Treat all unchecked AC task boxes as blockers — explicit deferral required.

### L3: Zod-validated structured LLM output is the standard pattern

The pattern from `courseTagger.ts` — `callOllamaChat` with `format: 'json'` + Zod schema validation before consuming the result — was adopted successfully in S03's `sessionAnalyzer.ts`. Intermediate type shapes must be explicitly typed (not inferred from `z.infer`) to avoid unsafe structural casts. This pattern should be the default for all LLM JSON calls.

**Action A4:** Document Zod LLM structured output pattern in `docs/engineering-patterns.md`.

---

## 7. Suggestions for Epic 73 (Tutoring Modes: ELI5, Quiz Me, Debug)

Epic 73 builds directly on the `LearnerModel` and `TutorMode` union established in E72.

### Pre-Epic Prerequisites (from retro action items)

1. **Wire `tsc --noEmit` into the pre-push hook** (A1) — prevents recurrence of S01/S03's type propagation failures. `TutorMode` will be extended again in E73; type errors must not reach code review.
2. **Document Zod LLM pattern in engineering-patterns.md** (A4) — ELI5 and Quiz Me modes both call the LLM for structured output. The pattern is ready to clone.
3. **Log idle timeout to `docs/known-issues.yaml`** (A3) — keeps the tracker clean before E73 starts.

### Architecture Observations

- The `TutorMode` union (`'socratic' | 'eli5' | 'quiz' | 'debug'`) is anchored in `src/ai/tutor/types.ts`. E73-S01's mode registry/budget allocator should build on this foundation rather than alongside it.
- The `LearnerModel.preferredMode` field will be readable by the E73 session continuity story (E73-S05) — no new data model work needed.
- The slot 6 integration in `tutorPromptBuilder.ts` already injects the learner model. E73 mode-specific prompt variants should extend slot 6 rather than adding a new slot.
- `sessionAnalyzer.ts` already extracts quiz stats and debug assessments. E73's quiz and debug modes inherit this extraction logic at no additional cost.

### Test Coverage Readiness

After the E72 fix pass, 85 unit tests cover the learner model layer. E73 should prioritize E2E tests for mode-switching flows — the unit layer is solid, but no E2E tests exist for E72 or its dependencies. The trace report flagged this as a P2 gap.

---

## 8. Build Verification

```
npm run build
✓ built in 27.94s
PWA v1.2.0 — 311 entries precached (19850.81 KiB)
```

Build passed. No TypeScript errors. No lint errors. Bundle size warnings are pre-existing (sql-js, chart, pdf chunks) — not introduced by E72.

---

*Epic 72 · Completed 2026-04-13 · 3 stories · 6 review rounds · 15 issues fixed · 19 trace-fix tests added*
