## Edge Case Review — E07-S06 (2026-03-21)

### Unhandled Edge Cases

**[src/stores/useCourseStore.ts:17]** — `loadCourses() called when DB returns empty array and isLoaded is already true`
> Consequence: The condition `courses.length > 0 || !get().isLoaded` short-circuits: if `isLoaded` is `true` and the DB returns `[]` (e.g., IndexedDB cleared mid-session, or DB populated asynchronously after first call), the store silently keeps stale course data and never updates. The original code's early return (`if (get().isLoaded) return`) had the same stale-data risk but was at least idempotent. The new code re-queries the DB every call but discards valid empty results once loaded.
> Guard: `set({ courses, isLoaded: true })` unconditionally — remove the conditional. If the intent is to avoid unnecessary re-renders on identical data, compare array references: `if (courses.length !== get().courses.length || !get().isLoaded) { set({ courses, isLoaded: true }) }`

**[src/stores/useCourseStore.ts:16-18]** — `Concurrent calls to loadCourses() race on db.courses.toArray()`
> Consequence: The original code guarded against concurrent calls with `if (get().isLoaded) return`. The new code always calls `db.courses.toArray()` before checking state, so two rapid calls (e.g., Layout mount + main.tsx init) both hit the DB concurrently. While this is benign (last writer wins), it's an unnecessary double DB read on every app startup since `loadCourses` is called from both `main.tsx:41` and `Layout.tsx:185`.
> Guard: Add a `loading` flag or restore the early return: `if (get().isLoaded) return` at the top, then handle the empty-DB-on-first-load case separately.

**[tests/e2e/regression/story-e07-s03.spec.ts:507-510]** — `Synthetic lesson IDs don't match actual course lesson IDs for confidence-reboot`
> Consequence: The test seeds `completedLessons` with IDs like `confidence-reboot-lesson-01` but real lesson IDs are like `cr-00-welcome`. The suggestion algorithm only checks `completedLessons.length` (not ID validity), so this works today. However, if the algorithm or progress loading ever validates lesson IDs against actual course data (e.g., filtering out unknown IDs), the seeded progress would silently collapse to 0%, changing scores and potentially flipping the test result without any code change in the test itself.
> Guard: `// WARNING: synthetic IDs — algorithm only checks .length, not validity. If progress validation is added, replace with actual lesson IDs from src/data/courses/confidence-reboot.ts`

**[tests/e2e/regression/story-e07-s03.spec.ts:520-523]** — `Synthetic lesson IDs don't match actual course lesson IDs for behavior-skills-breakthrough`
> Consequence: Same as above. Seeded IDs like `behavior-skills-breakthrough-lesson-01` vs real IDs like `bsb-lesson-01`. Currently harmless but fragile.
> Guard: Same defensive comment as above, or import actual lesson IDs from course data modules.

**[tests/e2e/regression/story-e07-s03.spec.ts:486]** — `Excluded courses seeded with 1000 synthetic lesson IDs may fail the >= totalLessons check if completion validation changes`
> Consequence: The `completedLessons >= totalLessons` exclusion check at `suggestions.ts:44` only compares counts. The 1000-ID approach is a pragmatic shortcut that works because no course has 1000+ lessons. If the algorithm ever intersects `completedLessons` with actual lesson IDs before counting, excluded courses would have 0 valid completions and become surprise candidates, breaking test isolation.
> Guard: Add a comment: `// 1000 synthetic IDs — relies on algorithm counting .length only (suggestions.ts:41-44)`

**[tests/e2e/regression/story-e07-s03.spec.ts:462-466]** — `Confidence-reboot lesson count changes from 20 to a different number`
> Consequence: The test math assumes 20 module-derived lessons (10/20 = 50% progress). If a lesson is added or removed from confidence-reboot's modules, the progress percentage shifts. With 21 lessons, progress becomes 10/21 = 47.6%, narrowing the margin. While the margin (0.457 vs 0.275) is wide enough to absorb small changes, there's no assertion or guard verifying the assumed lesson count.
> Guard: Add a static smoke assertion at the top of the test or in a shared constant: `expect(CONFIDENCE_REBOOT_LESSON_COUNT).toBe(20)` importing the actual module data.

**[tests/e2e/regression/story-e07-s03.spec.ts:459]** — `finalScore values are not exactly equal despite identical tagScore`
> Consequence: The test intends to exercise the tiebreaker path at `suggestions.ts:72` (momentum comparison when scores are equal). However, the two candidates have *different* finalScores (0.457 vs 0.275) because their momentum differs. The primary sort at line 69 (`b.score !== a.score`) resolves the ordering before the tiebreaker at line 72 fires. Due to IEEE 754 floating-point, even with identical tag overlap, `tagScore * 0.6 + momentumA * 0.4 !== tagScore * 0.6 + momentumB * 0.4` when momentums differ. The test validates "higher momentum produces higher finalScore" (primary sort), not the tiebreaker code path specifically.
> Guard: To truly exercise the tiebreaker, seed both candidates with identical momentum (same progress ratio and same recency) so `finalScore` is numerically equal, then differentiate only by the `momentumProxy` recomputation at line 72. Alternatively, document that the test validates "momentum-driven score separation" rather than "tiebreaker path."

---
**Total:** 7 unhandled edge cases found.
