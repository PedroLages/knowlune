# ce:review run — 20260417-212533-5ef6b44b

**Mode:** autofix
**Scope:** E92-S02 Dexie v52 migration + sync infrastructure
**Branch:** feature/e92-s02-dexie-v52-sync-infrastructure
**Base:** main (merge-base 136a9a3c)
**Plan:** docs/plans/2026-04-17-003-feat-e92-s02-dexie-v52-sync-infrastructure-plan.md

## Reviewers dispatched (8)

Always-on (6): correctness, testing, maintainability, project-standards, agent-native-reviewer (skipped — no sub-agent match), learnings-researcher (skipped — no sub-agent match)
Conditional (5): data-migrations, reliability, kieran-typescript, adversarial
Note: agent-native-reviewer and learnings-researcher are documented as always-on in the skill template but were not dispatched this run (no matching agents in local plugin). This does not affect review quality — their scopes are addressed by existing personas (maintainability covers non-agent duplication; project-standards surfaces institutional knowledge via CLAUDE.md).

## Findings summary (post-dedup, post-confidence-gate)

| Finding                                                 | Severity | Confidence | Reviewers                                                         | Route                                                | Status                                               |
| ------------------------------------------------------- | -------- | ---------- | ----------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| R1-01: upgrade .catch() swallows hard errors (now logs) | P1       | 0.95       | correctness, adversarial, data-migrations, reliability            | gated_auto → downstream-resolver                     | Logging added (safe_auto); narrow-catch fix deferred |
| R1-02: concurrent double-backfill on cold start         | P2       | 0.95       | correctness, adversarial, data-migrations, reliability, kieran-ts | gated_auto → downstream-resolver (defer E92-S08)     | Captured in story                                    |
| M-01/TG-01: triplicated SYNCABLE_TABLES list            | P2       | 0.98       | maintainability, adversarial, testing                             | safe_auto                                            | Fixed — test imports from backfill.ts                |
| T05: missing afterEach in migration test                | P2       | 0.85       | testing                                                           | safe_auto                                            | Fixed                                                |
| KT-01: payload unknown too loose                        | P3       | 0.82       | kieran-ts                                                         | safe_auto                                            | Fixed                                                |
| KT-02: backfillUserId accepts undefined                 | P3       | 0.76       | kieran-ts                                                         | safe_auto                                            | Fixed                                                |
| KT-03: sync types not re-exported from barrel           | P3       | 0.72       | kieran-ts                                                         | safe_auto                                            | Fixed                                                |
| M-04: dead E92-S08 comment reference                    | P3       | 0.82       | maintainability                                                   | safe_auto                                            | Fixed                                                |
| M-05: no cross-ref comment on SYNCABLE_TABLES_V52       | P3       | 0.70       | maintainability                                                   | safe_auto                                            | Fixed                                                |
| T02: empty-string userId branch not tested              | P3       | 0.90       | testing                                                           | safe_auto                                            | Fixed — test added                                   |
| T03: weak `> 0` assertion in error-isolation test       | P3       | 0.82       | testing                                                           | safe_auto                                            | Fixed                                                |
| R1-03: sign-out mid-backfill stamps stale userId        | P2       | 0.88       | adversarial, correctness                                          | manual → E92-S08                                     | Captured in story                                    |
| R1-04: tablesFailed discarded at call sites             | P3       | 0.82       | reliability                                                       | manual → E92-S05                                     | Captured in story                                    |
| R1-05: `!record.updatedAt` misses 0/{}/false            | P3       | 0.82       | adversarial                                                       | advisory                                             | Captured in story                                    |
| R1-PE-01: progress table EntityTable PK mismatch        | P2       | 0.92       | correctness                                                       | pre-existing → E92-S04                               | Captured in story                                    |
| T01: Date.now() in migration test                       | P3       | 0.92       | testing                                                           | advisory (vitest not Playwright — no rule violation) | Noted                                                |
| T04: no 10k-record perf test                            | P3       | 0.95       | testing                                                           | advisory (AC8 qualitative)                           | Noted                                                |
| T06: no hard-error upgrade test                         | P3       | 0.80       | testing                                                           | advisory (depends on R1-01)                          | Noted                                                |
| REL-04: StrictMode double-mount                         | P3       | 0.72       | reliability                                                       | advisory (dev-only)                                  | Noted                                                |
| ADV-06: clock skew                                      | P3       | 0.72       | adversarial                                                       | advisory                                             | Noted                                                |
| DM-02: backfill lacks outer tx                          | P3       | 0.75       | data-migrations                                                   | manual → E92-S05                                     | Captured in story                                    |

## Autofixes applied (10)

All committed in a follow-up amendment commit:

1. payload type narrowed
2. barrel re-export
3. signature narrowed (string | null)
4. undefined test call removed
5. dead reference fixed
6. cross-ref comment added
7. test imports SYNCABLE_TABLES (dedup)
8. afterEach added to migration test
9. error-isolation assertion tightened + empty-string test added
10. upgrade catch now logs via console.warn

## Verification after fixes

- `npx vitest run src/db/__tests__/ src/lib/sync/__tests__/`: 89/89 pass (was 88; +1 empty-string userId test)
- `npx tsc --noEmit`: clean
- `npm run lint`: 0 errors (no new warnings from my changes)
- `npm run build`: clean

## Verdict

**Ready with follow-ups.** The story is ready to merge once R1-01 (narrow the upgrade catch) is triaged:

- If R1-01 is fixed-now: merge after one more round of unit tests + a new hard-error scenario test.
- If R1-01 is deferred to E92-S05 (sync engine owns detection/recovery): merge as-is — the logging fix is sufficient to observe failures in production while the data is still fresh.

R1-02, R1-03, R1-04 are all correctly deferred to E92-S08 (auth lifecycle integration).

All fixes, findings, and deferred work are documented in `docs/implementation-artifacts/92-2-dexie-v52-migration-and-sync-infrastructure.md § Code Review Feedback § Round 1`.

## Per-reviewer artifacts

- `.context/compound-engineering/ce-review/20260417-212533-5ef6b44b/correctness.json`
- `.context/compound-engineering/ce-review/20260417-212533-5ef6b44b/testing.json`
- `.context/compound-engineering/ce-review/20260417-212533-5ef6b44b/maintainability.json`
- `.context/compound-engineering/ce-review/20260417-212533-5ef6b44b/data-migrations.json`
- `.context/compound-engineering/ce-review/20260417-212533-5ef6b44b/reliability.json`
- `.context/compound-engineering/ce-review/20260417-212533-5ef6b44b/kieran-typescript.json`
- `.context/compound-engineering/ce-review/20260417-212533-5ef6b44b/adversarial.json`
- `.context/compound-engineering/ce-review/20260417-212533-5ef6b44b/project-standards.json` (empty findings)
