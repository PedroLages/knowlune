# Adversarial Review: Epic 59 — FSRS Spaced Repetition Migration

**Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (adversarial)
**Epic:** E59 — FSRS Spaced Repetition Migration (8 stories, completed 2026-03-29 to 2026-03-30)
**Files Reviewed:** `src/lib/spacedRepetition.ts`, `src/data/types.ts`, `src/db/schema.ts` (v31 migration), `src/stores/useFlashcardStore.ts`, `src/stores/useReviewStore.ts`, `src/lib/exportService.ts`, `src/lib/importService.ts`, `src/app/components/figma/RatingButtons.tsx`, `tests/support/fixtures/factories/`, all 8 story files

---

## Findings Summary

| ID | Severity | Category | Description |
|----|----------|----------|-------------|
| C-01 | CRITICAL | Data Loss | Flashcards table excluded from export/import — user data unrecoverable |
| C-02 | CRITICAL | Data Loss | Migration sets `lapses: 0` for all cards — destroys lapse inference signal |
| H-01 | HIGH | Resilience | No migration rollback strategy — failed v31 upgrade corrupts DB irreversibly |
| H-02 | HIGH | Scope | FSRS parameters hardcoded — no user-configurable retention target |
| H-03 | HIGH | Compatibility | Export schema version unchanged (v14) despite ReviewRecord field restructure |
| H-04 | HIGH | Process | E59-S05 shipped without review (`reviewed: false`) — quality gate bypassed |
| M-01 | MEDIUM | Testing | Zero burn-in validation across all 8 stories despite FSRS fuzz/timing sensitivity |
| M-02 | MEDIUM | Architecture | `new Date()` default parameter in `calculateNextReview` violates deterministic time principle |
| M-03 | MEDIUM | UX | No user-visible indication that scheduling algorithm changed |
| M-04 | MEDIUM | Testing | Performance benchmark skipped on every story — no regression baseline for FSRS computation cost |
| M-05 | MEDIUM | Scope | `maximum_interval: 365` is hardcoded — advanced learners cannot exceed 1-year intervals |
| L-01 | LOW | Debt | SM-2 field names in 50+ lines of `schema.ts` historical versions — no cleanup or deprecation markers |
| L-02 | LOW | Process | Epic tracking file shows "Story Details" section stuck at "queued" despite all stories being done |
| L-03 | LOW | A11y | RatingButtons keyboard shortcuts (1/2/3/4) not discoverable without visual hover on `<kbd>` elements |

**Total findings: 14** (2 CRITICAL, 4 HIGH, 5 MEDIUM, 3 LOW)

---

## Critical Findings

### C-01: Flashcards table excluded from export/import — user data unrecoverable

**Location:** `src/lib/exportService.ts:113-127`, `src/lib/exportService.ts:34-53`

The `exportAllAsJson()` function explicitly lists 13 tables to export. The `flashcards` table is not among them. The `KnowluneExport` interface does not include a `flashcards` field. This means:

1. Users who export their data lose all flashcard definitions (front/back text, FSRS scheduling state, review history)
2. The import service (`importFullData`) cannot restore flashcards because the export never contained them
3. Settings > Data > "Export All Data" gives users a false sense of backup completeness

This is a pre-existing gap (flashcards were added in E20-S02 but never added to the export), but Epic 59 made it worse by adding 9 new FSRS fields per flashcard that are now also lost. The epic's scope should have included an export schema update since it restructured the data model.

**Impact:** Complete flashcard data loss on export/import cycle. Users who reset their database or migrate devices lose all flashcards and their FSRS scheduling state.

**Fix:** Add `flashcards` to both `KnowluneExport` interface and `exportAllAsJson()` tables list. Bump `CURRENT_SCHEMA_VERSION` to 15. Add import handler for the new table.

### C-02: Migration sets `lapses: 0` for all cards — destroys lapse inference signal

**Location:** `src/db/schema.ts:1127`, `src/db/schema.ts:1156`

The v31 migration sets `lapses: 0` for all migrated flashcards and review records with the comment "SM-2 doesn't track lapses." This is technically correct — SM-2 has no explicit lapse counter. However, the migration *could* have inferred lapse data from the review history. A card that was rated "hard" or "wrong" (SM-2 quality < 3) after previously being in a Review state experienced a lapse. The `reviewRecords` table contains the full rating history per note.

By setting `lapses: 0` universally, FSRS treats every migrated card as if it was never forgotten. This inflates FSRS stability estimates for cards that have a history of being forgotten, causing the algorithm to schedule longer intervals than appropriate. For a user with hundreds of reviewed flashcards, this is a silent regression in scheduling quality.

**Impact:** FSRS overestimates memory strength for previously-lapsed cards. Users see fewer reviews for cards they historically struggled with, leading to knowledge gaps.

**Fix:** Before migration, scan `reviewRecords` per noteId. Count records where `rating` was 'hard' or 'wrong' and the card was previously in a review state. Use that count as `lapses`.

---

## High Findings

### H-01: No migration rollback strategy — failed v31 upgrade corrupts DB irreversibly

**Location:** `src/db/schema.ts:1054-1170`

The v31 migration deletes SM-2 fields (`easeFactor`, `interval`, `reviewCount`, `nextReviewAt`, `reviewedAt`) from every flashcard and review record. If the migration partially fails (e.g., browser crash mid-upgrade, IndexedDB quota exceeded during field writes), the database is left in an inconsistent state: some records have FSRS fields, others still have SM-2 fields, and the schema version is ambiguous.

Dexie does not provide transactional migrations — the `.upgrade()` callback runs outside a single transaction when modifying multiple tables. There is no pre-migration backup, no schema version checkpoint, and no way for the user to recover.

**Impact:** A failed migration leaves the database in an unrecoverable mixed state. The user must clear all data and start fresh.

**Fix:** Before running the v31 upgrade, serialize the current `flashcards` and `reviewRecords` tables to a temporary IndexedDB table or localStorage backup. If the migration fails, restore from backup. Alternatively, keep SM-2 fields as deprecated (don't delete them) and only remove them in a subsequent migration after verifying FSRS fields are populated.

### H-02: FSRS parameters hardcoded — no user-configurable retention target

**Location:** `src/lib/spacedRepetition.ts:23-28`

The FSRS instance is configured with `request_retention: 0.9` (90% target retention) and `maximum_interval: 365` days. These are hardcoded constants with no settings UI, no user preference storage, and no way to adjust them.

FSRS's primary value proposition over SM-2 is its configurability — users can tune `request_retention` between 0.7 (fewer reviews, lower retention) and 0.99 (more reviews, higher retention) based on their learning goals. The epic migrated the algorithm but did not expose any of its tuning parameters.

This is not just a "nice to have" — the 90% target may be too aggressive for casual learners (causing review fatigue) or too lenient for medical/legal students (who need 95%+ retention).

**Impact:** Users cannot tune the algorithm to their learning style. The migration promises "more accurate review intervals based on proven memory science" (E59-S02 story) but locks users into a single retention target.

**Fix:** Add FSRS configuration to Settings page. Store `request_retention` and `maximum_interval` in localStorage. Pass user config to FSRS instance (recreate on settings change). Default to 0.9/365.

### H-03: Export schema version unchanged despite ReviewRecord field restructure

**Location:** `src/lib/exportService.ts:32`

`CURRENT_SCHEMA_VERSION` remains at 14 after Epic 59. The `ReviewRecord` interface was completely restructured — 5 SM-2 fields removed, 9 FSRS fields added. If a user exports data at v14 with FSRS fields and later imports it into a pre-E59 codebase (which expects SM-2 fields at v14), the import will silently succeed but populate the wrong field names into IndexedDB.

The export schema version should have been bumped to 15 with a migration registered in `importService.ts` that handles the SM-2 to FSRS field mapping for older exports.

**Impact:** Cross-version import/export is silently incompatible. Data corruption on downgrade scenarios.

**Fix:** Bump `CURRENT_SCHEMA_VERSION` to 15. Register a v14-to-v15 migration in `importService.ts` that transforms SM-2 review records to FSRS format.

### H-04: E59-S05 shipped without review

**Location:** `docs/implementation-artifacts/stories/E59-S05.md:7`

E59-S05 (Retention Metrics and Consumer Updates) has `reviewed: false` in its frontmatter. The "Code Review Feedback" and "Design Review Feedback" sections are still placeholder text ("[Populated by /review-story]"). Despite this, the story was merged to main (PR #165) and marked `done` in sprint-status.yaml.

This means 85 tests across 4 modified files were never subjected to the code review agent, test coverage agent, or security review. The story touches `retentionMetrics.ts`, `interleave.ts`, `exportService.ts`, and `NotificationService.ts` — all critical paths.

**Impact:** Unreviewed code in production. Potential for bugs in retention calculation logic that would have been caught by the review agent swarm.

**Fix:** Run `/review-story E59-S05` retroactively. Update the story file with review findings.

---

## Medium Findings

### M-01: Zero burn-in validation across all 8 stories

**Location:** All E59 story files — `burn_in_validated: false`

None of the 8 stories underwent burn-in testing (10-iteration stability validation). FSRS with `enable_fuzz: true` introduces intentional randomness in scheduling intervals. The E2E tests run against production FSRS (with fuzz), meaning test results may vary between runs. The burn-in process exists precisely to catch this class of flakiness.

**Impact:** Potential for intermittent E2E test failures in CI that only manifest under certain fuzz seeds.

### M-02: `new Date()` default parameter in production code

**Location:** `src/lib/spacedRepetition.ts:92`, `src/lib/spacedRepetition.ts:142`, `src/lib/spacedRepetition.ts:166`

All three exported functions (`calculateNextReview`, `predictRetention`, `isDue`) use `now: Date = new Date()` as a default parameter. While callers *can* inject a fixed date, the default makes it easy to accidentally use wall-clock time in tests. The ESLint rule `test-patterns/deterministic-time` catches `Date.now()` and `new Date()` in test files, but production code calling these functions without an explicit `now` parameter produces non-deterministic results that are harder to debug.

**Impact:** Debugging scheduling issues requires knowledge that the default parameter exists. Store functions that call these without explicit `now` produce subtly different results on each invocation.

### M-03: No user-visible indication that scheduling algorithm changed

**Location:** No changelog, no migration toast, no settings indicator

When a user's database migrates from v30 to v31, their flashcard scheduling silently changes from SM-2 to FSRS. Cards that were previously due in 7 days may now be due in 3 days (or 14 days). The user sees different review intervals with no explanation. There is no toast, banner, changelog entry, or settings indicator that says "Your scheduling algorithm has been upgraded to FSRS."

**Impact:** User confusion when review intervals suddenly change. No way for users to understand why their study schedule shifted.

### M-04: Performance benchmark skipped on every story

**Location:** All 8 story review gates show `performance-benchmark-skipped`

FSRS computations (power-law forgetting curve, scheduling calculations) replace SM-2's simpler arithmetic. No performance benchmarking was done to verify that FSRS is not measurably slower for users with large card collections (1000+ flashcards). The `predictRetention()` function is called per-card in retention dashboards and could be a hot path.

**Impact:** No baseline for detecting FSRS-related performance regressions. If a future story adds batch retention calculations, there is no reference point.

### M-05: `maximum_interval: 365` is hardcoded — no ceiling justification

**Location:** `src/lib/spacedRepetition.ts:25`

FSRS defaults to `maximum_interval: 36500` (100 years). The epic hardcodes it to 365 days. While 365 is reasonable for most learners, there is no documented justification for this choice, and no way for advanced users to change it. A user who has perfectly retained a card for 6 months is told to review it again in at most 1 year, when FSRS would naturally schedule it for 2+ years.

**Impact:** Unnecessary reviews for well-known cards. Review backlog inflation for long-term users.

---

## Low Findings

### L-01: SM-2 field names preserved in 50+ lines of historical schema versions

**Location:** `src/db/schema.ts:381-1036`

Historical Dexie schema versions (v10 through v30) still reference `nextReviewAt`, `easeFactor`, etc. in their index declarations. While these are necessary for Dexie's migration chain to work, there are no deprecation comments on these historical references. A future developer may see `nextReviewAt` in schema.ts and think it is still a valid field name.

### L-02: Epic tracking file inconsistent

**Location:** `docs/implementation-artifacts/epic-59-tracking-2026-03-29.md:21-43`

The Progress Summary table shows all 8 stories as `done` with PR URLs, but the "Story Details" section below shows all stories as `Status: queued`. The epic summary section shows `Completed: --` and `Total Review Rounds: --`. The tracking file was never updated after the initial generation.

### L-03: Keyboard shortcuts not discoverable on mobile

**Location:** `src/app/components/figma/RatingButtons.tsx:70`

The `<kbd>` elements showing keyboard shortcuts (1/2/3/4) are hidden on mobile (`hidden sm:inline-block`). This is correct behavior (mobile users don't have keyboards), but there is no equivalent touch gesture or long-press hint for mobile users. The buttons themselves work on mobile, but users have no visual cue about the rating severity order (Again < Hard < Good < Easy).

---

## Scope Assessment

**What was promised:** "Replace SM-2 with FSRS for more accurate review intervals based on proven memory science."

**What was delivered:** A working FSRS algorithm swap with proper type definitions, database migration, store updates, UI changes (Again button), and comprehensive unit/E2E test rewrites. The mechanical migration is solid.

**What was missed:**
1. **User control** — FSRS's primary advantage (configurable retention) was not exposed
2. **Data completeness** — Flashcards missing from export, lapses information discarded during migration
3. **Migration safety** — No rollback path, no user notification
4. **Export versioning** — Schema version not bumped despite breaking field changes
5. **Review process** — One story (E59-S05) bypassed review entirely; zero burn-in across all stories

The epic successfully replaced the algorithm engine but did not deliver the *user-facing value* that FSRS enables. The migration is more of a "tech stack upgrade" than a "feature improvement" — users get different intervals but no control, no explanation, and potentially degraded scheduling for historically-lapsed cards.

---

## Recommendations

1. **Immediate (before next epic):** Add flashcards to export/import. Bump export schema version. Run retroactive review on E59-S05.
2. **Near-term (next 1-2 epics):** Add FSRS settings UI (retention target, max interval). Add migration toast explaining the algorithm change.
3. **Technical debt:** Consider a v32 migration that retroactively computes `lapses` from review history. Add a performance benchmark for `predictRetention()` batch calls.
