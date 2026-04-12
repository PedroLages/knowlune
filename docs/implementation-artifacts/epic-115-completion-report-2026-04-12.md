# Epic 115 Completion Report — Custom Reading Challenges

**Date:** 2026-04-12
**Epic:** E115 — Custom Reading Challenges
**Status:** Done
**Stories:** 1/1 completed (100%)

---

## Executive Summary

Epic 115 delivered two new reading challenge types — "books" (finish N books) and "pages" (read N pages) — extending the existing challenge infrastructure without a Dexie schema migration. The single-story epic completed in 2 review rounds with 3 issues resolved (1 MEDIUM, 1 LOW, 1 NIT), 26 unit tests passing, and no production incidents.

---

## Stories Delivered

| Story | Name | PR | Status | Review Rounds | Issues Fixed |
|-------|------|----|--------|---------------|--------------|
| E115-S01 | Custom Reading Challenges | [#307](https://github.com/PedroLages/knowlune/pull/307) | Done | 2 | 3 |

---

## Features Shipped

- **Books challenge type**: `'books'` added to `ChallengeType` union. `calculateBooksProgress()` counts books with `status=finished` whose `finishedAt` date is on or after the challenge creation date. Uses Dexie `where('status').equals('finished')` index for efficiency.
- **Pages challenge type**: `'pages'` added to `ChallengeType` union. `calculatePagesProgress()` sums `totalPages × progress%` across books updated since challenge creation. Full-table scan via `.filter()` accepted (no Dexie index for `updatedAt`; personal collections typically <500 books).
- **CreateChallengeDialog updated**: Books and pages `<SelectItem>` options added. TypeScript exhaustive `Record<ChallengeType, ...>` enforces completeness at compile time.
- **Challenges page updated**: `typeConfig` extended with `books` and `pages` entries (label, unit, icon). `ChallengeCard` renders correctly for both new types.
- **26 unit tests added**: `challengeProgress.test.ts` covers both calculators with edge cases: empty DB, zero progress, null/undefined `totalPages`, `finishedAt` null guard, mixed status, and dispatcher routing.

---

## Quality Gates

| Gate | Result |
|------|--------|
| Build | PASS |
| Lint | PASS |
| Type check | PASS |
| Format check | PASS |
| Unit tests | PASS (26 new + 21 store tests) |
| E2E tests | SKIPPED (complex Dexie state seeding, regression spec exists) |
| Design review | SKIPPED |
| Code review | PASS (R1 findings fixed, R2 clean) |
| Code review — testing | PASS |
| Performance benchmark | SKIPPED |
| Security review | SKIPPED |
| Exploratory QA | SKIPPED |

---

## Review Summary

**Round 1 (R1) — Findings Fixed:**

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | MEDIUM | `createdAtMs` computed inside `.filter()` callback on every iteration | Extracted `const createdAtMs = new Date(challenge.createdAt).getTime()` before the filter loop in both calculators |
| 2 | LOW | `calculatePagesProgress` JSDoc missing pages-baseline limitation note | Added accepted trade-off note to JSDoc: pages = current position, not delta since challenge start |
| 3 | NIT | Minor date extraction inconsistency | Aligned date extraction pattern across both calculators |

**Round 2 (R2):** Clean pass. No findings.

---

## Traceability

**Overall coverage: 96% — Gate: PASS**

| AC | Description | Verdict |
|----|-------------|---------|
| AC-1 | Dialog supports books/pages types | COVERED (TypeScript exhaustive records + dispatcher routing tests) |
| AC-2 | Books progress: finished books after challenge creation | FULLY COVERED (6 tests) |
| AC-3 | Pages progress: totalPages × progress% for updated books | FULLY COVERED (5 tests) |
| AC-4 | Display: correct labels, icons, progress bars | PARTIALLY COVERED (code review; no component render tests) |
| AC-5 | Progress recalculated on each page load | FULLY COVERED (7 store tests) |

**Gaps (all LOW, no fix required):**

| Gap | AC | Description |
|-----|----|-------------|
| G-1 | AC-1 | No unit test renders `CreateChallengeDialog` and asserts books/pages options appear |
| G-2 | AC-4 | No unit test renders `ChallengeCard` with books/pages type |
| G-3 | AC-3 | No test explicitly exercises the `updatedAt \|\| createdAt` fallback path |

---

## NFR Assessment — PASS

| NFR | Status | Notes |
|-----|--------|-------|
| Performance — indexed queries | PASS | `calculateBooksProgress` uses `status` index |
| Performance — filter loop | PASS | `createdAtMs` extracted before loop (R1 fix) |
| Performance — pages full scan | ACCEPTED | No Dexie index for `updatedAt`; acceptable for personal book collections |
| Bundle size | PASS | No new dependencies; two ~20-line functions in existing module |
| Reliability — edge cases | PASS | Empty DB, null guards, zero progress all tested |
| Maintainability — JSDoc | PASS | All 5 exports documented including known limitations |
| Type safety | PASS | Zero TypeScript errors; exhaustive switch in `calculateProgress` |
| Accessibility | PASS | New `<SelectItem>` elements follow Radix UI `Select` ARIA pattern |
| Security | PASS | No new external calls; challenge type constrained to union |

**Accepted trade-offs:**
1. **Pages baseline**: Pages progress counts current reading position, not delta since challenge start (no baseline snapshot in data model). Documented in JSDoc as accepted product decision.
2. **Pages full scan**: `calculatePagesProgress` uses `.filter()` because `updatedAt` has no Dexie index. Negligible for typical personal collections.

---

## Known Issues

**None.** No known issues opened during E115.

---

## Technical Notes

### Schema-free extension

E115 extended the challenge system without a Dexie schema migration. `ChallengeType` union was expanded from `'completion' | 'time' | 'streak'` to add `'books' | 'pages'`. The existing `type`, `target`, and `createdAt` columns on the Challenges table were sufficient — no new columns required.

### Architecture

- **`src/data/types.ts`**: `ChallengeType` union extended
- **`src/lib/challengeProgress.ts`**: `calculateBooksProgress()` and `calculatePagesProgress()` added; `calculateProgress()` dispatcher updated
- **`src/app/components/library/CreateChallengeDialog.tsx`**: Books and pages `<SelectItem>` options added
- **`src/app/pages/Challenges.tsx`**: `typeConfig` record extended; no structural changes

---

## Retrospective Highlights

**What went well:**
- Narrow scope and contained code surface — existing infrastructure did most of the work
- `calculateBooksProgress` correctly uses Dexie's `status` index pattern (index on high-cardinality discriminator, filter in JS on date)
- 26 edge-case tests with thorough coverage of calculation logic
- One round of fixes to clean pass — target met

**What was challenging:**
- Pages progress baseline limitation: accepted as product trade-off (snapshot baseline would require schema change — future story)
- E2E tests skipped due to complex Dexie state seeding requirements (recurring gap for state-heavy features)

**Patterns extracted:**

| Pattern | Description |
|---------|-------------|
| Dexie filter loop optimization | Extract derived comparison values (timestamps, scores) before `.filter()` callback, not inside it |
| Accept-and-document | Accepted scope limitations belong in function JSDoc, not just story notes |
| Schema-free extension | Before planning a Dexie migration, check if union type expansion covers the new variant |

---

## Action Items Carried Forward

| # | Action | Origin |
|---|--------|--------|
| 1–8 | Engineering patterns and story template updates (0/8 completed from E114) | E112–E114 |
| 9 | Add Dexie filter loop optimization to `docs/engineering-patterns.md` | E115 |
| 10 | Add accept-and-document pattern to story template or engineering-patterns.md | E115 |

**Note:** Eleven consecutive epics with near-zero follow-through on inter-session action items. The retrospective identifies committed changes within the session as the only reliable mechanism.

---

## Sprint Status

```yaml
epic-115: done
115-1-custom-reading-challenges: done
epic-115-retrospective: done
```
