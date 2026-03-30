# Non-Functional Requirements Report: Epic 59 — FSRS Spaced Repetition Migration

**Date:** 2026-03-30
**Epic:** E59 (8 stories: E59-S01 through E59-S08)
**Assessor:** Claude Opus 4.6 (automated NFR analysis)
**Overall Assessment:** PASS

---

## 1. Performance

| Metric | Result | Status |
|--------|--------|--------|
| Build time | 18.96s (no regression from E58 baseline of 19.52s) | PASS |
| ts-fsrs package size | 432 KB on disk; tree-shakeable | PASS |
| Single gateway pattern | Only `spacedRepetition.ts` imports from ts-fsrs | PASS |
| Bundle output | 681 KB main chunk (gzip 195 KB) — unchanged from pre-E59 | PASS |
| FSRS computation | Pure functions, no DOM or async; sub-ms per call | PASS |
| Migration upgrade callback | Runs once per user at v31; O(n) on card+review count | PASS |
| Store rendering | Optimistic updates prevent UI blocking on persist | PASS |

**Notes:**
- The `ts-fsrs` dependency is 432 KB on disk but only the `FSRS`, `Rating`, `createEmptyCard`, and `forgetting_curve` exports are used — Vite tree-shakes the rest.
- The `calculateNextReview` function is pure and synchronous; no risk of blocking the main thread.
- Production FSRS instance uses `enable_fuzz: true` for natural interval variation; test instance uses `enable_fuzz: false` for deterministic assertions.
- The v31 Dexie migration runs a single `modify()` pass over flashcards and reviewRecords tables — linear time, no network calls.

## 2. Security

| Check | Result | Status |
|-------|--------|--------|
| XSS via user input | No `dangerouslySetInnerHTML` or `innerHTML` in FSRS-related files | PASS |
| No eval/Function constructors | Verified — no dynamic code execution | PASS |
| No secrets in FSRS code | Algorithm is client-side, no API keys or tokens | PASS |
| Input validation | Rating mapped via exhaustive `RATING_MAP`; invalid ratings won't match | PASS |
| IndexedDB injection | Dexie parameterized queries; no raw string interpolation | PASS |
| Type safety on CardState | `CardState = 0 | 1 | 2 | 3` — union type prevents invalid states | PASS |

**Notes:**
- The FSRS algorithm is entirely client-side with no network communication. No authentication or authorization concerns.
- The `RATING_MAP` is a `Record<ReviewRating, Grade>` — TypeScript enforces exhaustive coverage at compile time.
- The migration `easeFactorToDifficulty()` clamps input to valid SM-2 range before conversion, preventing out-of-bounds difficulty values.

## 3. Reliability

| Check | Result | Status |
|-------|--------|--------|
| Error handling — stores | Optimistic update with rollback on persist failure | PASS |
| Error handling — user feedback | Toast with Retry action on failed ratings | PASS |
| Pending rating recovery | `pendingRating` state + `retryPendingRating()` in ReviewStore | PASS |
| Migration edge cases | Handles empty tables, missing fields, extreme easeFactor values | PASS |
| Null card handling | `calculateNextReview(null, ...)` creates empty card via ts-fsrs | PASS |
| Invalid date handling | `predictRetention` returns 0 for invalid/missing `last_review` | PASS |
| Stability bounds | Returns 0 for stability <= 0; clamps retention to 0-100 range | PASS |
| Difficulty bounds | ts-fsrs enforces 0-10 range; verified via 10x Again/Easy stress tests | PASS |

**Notes:**
- Both `useReviewStore` and `useFlashcardStore` implement the optimistic update + rollback pattern with `persistWithRetry` for IndexedDB writes.
- The migration handles all SM-2 edge cases: missing fields default to safe values (easeFactor=2.5, interval=0, reviewCount=0), extreme easeFactor clamped to [1.3, 2.5].
- `predictRetention` defensively handles: undefined last_review (returns 0), invalid date strings (returns 0), zero stability (returns 0), negative elapsed time (returns 100).

## 4. Maintainability

| Check | Result | Status |
|-------|--------|--------|
| Single gateway pattern | `spacedRepetition.ts` is the only ts-fsrs import point | PASS |
| Pure functions | All algorithm functions are side-effect-free | PASS |
| Deterministic test instance | `fsrsTest` export (enable_fuzz: false) for all tests | PASS |
| Type definitions | FSRS fields properly typed in `types.ts` (Flashcard, ReviewRecord) | PASS |
| Migration tested | `migration-v31-fsrs.test.ts` covers SM-2 to FSRS transformation | PASS |
| Unit test coverage | 108 tests across 5 test files — all passing | PASS |
| Code documentation | JSDoc on all exported functions with parameter descriptions | PASS |
| Checkpoint updated | `checkpoint.ts` at v31 with FSRS indexes | PASS |

**Type check concern (MEDIUM):**
- 9 TypeScript errors exist in `src/db/__tests__/schema.test.ts` — all are `CardState` narrowing issues where `state: number` is not assignable to `CardState = 0 | 1 | 2 | 3`. These are pre-existing test data construction issues, not FSRS logic bugs. The tests still pass at runtime via Vitest (which doesn't enforce strict types). Recommend adding `as CardState` casts to the test factory.

**Lint status:**
- 3 lint errors (all binary file parsing errors, not FSRS-related)
- 24 warnings (silent-catch and unused-var — none in FSRS files)
- No design token violations in FSRS code

## 5. Test Coverage Summary

| Test File | Tests | Focus |
|-----------|-------|-------|
| `spacedRepetition.test.ts` | 26 | Core FSRS algorithm wrapper: all ratings, edge cases, retention prediction, due checks, full review flow integration |
| `migration-v31-fsrs.test.ts` | 9 | SM-2 to FSRS data migration: field mapping, state derivation, index updates, edge cases, table preservation |
| `useReviewStore.test.ts` | 19 | Review store: CRUD, due filtering, interleaved sessions, error handling, retry |
| `useFlashcardStore.test.ts` | 17 | Flashcard store: CRUD, due ordering, review sessions, FSRS field updates, stats |
| `retentionMetrics.test.ts` | 37 | Retention metrics: topic grouping, decay detection, stats aggregation |
| **Total** | **108** | All passing |

## 6. Architecture Assessment

**Strengths:**
- Clean single-gateway pattern isolates ts-fsrs dependency — easy to swap algorithm in the future
- Pure functions with injectable `now: Date` and `fsrsInstance` parameters enable deterministic testing
- The SM-2 to FSRS migration is well-engineered: one-time upgrade callback with safe defaults, comprehensive edge case handling, and backward-compatible index updates
- Optimistic update pattern in both stores provides responsive UI while ensuring data consistency

**No concerns identified for:**
- Memory leaks (no subscriptions or timers in algorithm code)
- Bundle size regression (ts-fsrs is small and tree-shakeable)
- Migration data loss (SM-2 fields are deleted only after FSRS fields are written, in the same transaction)

---

## Verdict

| Category | Rating |
|----------|--------|
| Performance | PASS |
| Security | PASS |
| Reliability | PASS |
| Maintainability | PASS (1 MEDIUM note on test type narrowing) |

**Overall: PASS**

The Epic 59 FSRS migration is well-architected with strong separation of concerns, comprehensive error handling, thorough test coverage (108 tests), and a robust data migration strategy. The single type-narrowing issue in test data construction is cosmetic and does not affect correctness.
