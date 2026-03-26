# Adversarial Review: Epic 20 — Learning Pathways & Knowledge Retention

**Date:** 2026-03-26
**Reviewer:** Claude Opus 4.6 (adversarial mode)
**Scope:** E20-S01 (Career Paths), E20-S02 (Flashcards/FSRS), E20-S03 (Activity Heatmap), E20-S04 (Skill Radar)
**Stories reviewed:** 4/4 complete

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 5 |
| MEDIUM | 5 |
| LOW | 3 |
| **Total** | **15** |

Epic 20 bundles four loosely related features under a "Learning Pathways & Knowledge Retention" umbrella. The individual stories are well-implemented and passed their per-story review gates. However, this adversarial review examines cross-cutting concerns, unfixed review findings, scope coherence, and systemic weaknesses that per-story reviews structurally miss.

---

## CRITICAL Issues

### C1: `FIXED_NOW = new Date()` at module scope — stale time bug still shipped (E20-S02)

**File:** `src/app/pages/Flashcards.tsx:27`

The code review for E20-S02 flagged this as **HIGH (H1)**: `FIXED_NOW` is computed once at module load time. If the user leaves the Flashcards page open across midnight, all "due today" calculations use yesterday's date. Cards that become due at midnight never appear. The `formatNextReviewDate` function also uses `new Date()` independently (line 33), creating a split-brain where the header says "Tomorrow" but the review queue is computed against a stale `now`.

**Evidence:** The code review report explicitly lists this as H1. The story was marked `done` with `review_gates_passed` including `code-review`, yet the code at line 27 still reads `const FIXED_NOW = new Date()`. This was NOT fixed.

**Impact:** Users who study late at night or leave the tab open will see incorrect due counts, miss reviews, and degrade their spaced repetition schedule — the core value proposition of the feature.

**Fix:** Replace with `useMemo(() => new Date(), [])` at component level, or compute `now` inside `useEffect` and store in state, refreshing on visibility change via `document.addEventListener('visibilitychange', ...)`.

### C2: `handleRate` missing try/catch — UI permanently freezes on DB failure (E20-S02)

**File:** `src/app/pages/Flashcards.tsx:134-155`

The code review for E20-S02 flagged this as **HIGH (H2)**: `handleRate` sets `isRating = true`, then `await`s the store's `rateFlashcard`. If the store call throws (IndexedDB failure, quota exceeded), `isRating` is never set back to `false`. The rating buttons remain permanently disabled, the review session is stuck, and there is no recovery path.

**Evidence:** Lines 134-155 show `setIsRating(true)` at 136, `await rateFlashcard(...)` at 137, `setIsRating(false)` at 138 — but no try/catch/finally. If `rateFlashcard` throws, line 138 never executes.

**Impact:** Data loss scenario. The user's review session is bricked with no way to continue or exit gracefully. The store does have its own rollback, but the component-level `isRating` flag is orphaned.

**Fix:** Wrap in try/catch/finally: `finally { setIsRating(false) }`.

---

## HIGH Issues

### H1: No dedicated E2E test suite for Flashcards (E20-S02)

The story file explicitly admits: "No story-specific E2E spec was written; the AC coverage relies on unit tests for SM-2 logic and store behavior." There is no `tests/e2e/regression/story-e20-s02.spec.ts` or `tests/e2e/flashcards.spec.ts`. The Flashcards route is only covered by a navigation smoke test.

This is the most complex interactive feature in the epic (3D flip animation, keyboard shortcuts, multi-phase state machine, session persistence) and it has zero E2E coverage for:
- The flip-and-rate cycle
- Keyboard shortcuts (Space/Enter/1/2/3)
- Session completion flow
- Empty state transitions
- Error recovery

All other E20 stories have dedicated E2E specs. This is a gap.

### H2: No E2E test suite for Career Paths (E20-S01)

There is no `tests/e2e/career-paths.spec.ts` or `tests/e2e/regression/story-e20-s01.spec.ts` file on disk, despite the plan calling for one (Task 9). The story passed `e2e-tests` in its review gates, suggesting the tests may have been run against navigation smoke tests only, or the spec was deleted (the code review notes a `debug-enroll.spec.ts` was removed). Career Paths is a multi-page feature with enrollment, progress tracking, and stage locking — all untested at the E2E level.

### H3: Dexie schema version collision between E20-S01 and E20-S02

Both plans specify creating "Dexie v20" — E20-S01 adds `careerPaths` + `pathEnrollments`, while E20-S02 adds `flashcards`. The actual schema file shows v20 added career path tables and a later version (v21+) added flashcards. This worked out, but the plans were contradictory. This suggests the stories were planned in isolation without coordinating shared infrastructure changes. If they had been developed in parallel (e.g., by two developers), the schema versions would have collided.

### H4: `CreateFlashcardDialog.handleCreate` — no try/catch, no error feedback (E20-S02)

**File:** `src/app/components/notes/CreateFlashcardDialog.tsx:44-53`

The code review flagged this as M3. The `handleCreate` function uses `try { ... } finally { ... }` but has no `catch` block. If `createFlashcard` throws, the dialog closes silently (the `finally` resets `isSubmitting`) with no error toast. The user thinks the card was created but it was not. The store's own error handling fires `toast.error`, but the dialog has already closed by the time the toast appears, creating a confusing UX.

### H5: Entire Zustand store destructured without selectors — excessive re-renders (E20-S02)

**File:** `src/app/pages/Flashcards.tsx:79-91`

The code review flagged this as H3. The component destructures 10 fields from `useFlashcardStore()` without selectors. Any state change in the store (including flashcard CRUD from other components) triggers a full re-render of the Flashcards page. `getStats()` and `getDueFlashcards()` are called on every render (they use `get()` internally, not reactive state). For a store with potentially hundreds of flashcards, this is a performance concern.

---

## MEDIUM Issues

### M1: Epic scope incoherence — "Learning Pathways & Knowledge Retention" is two epics forced into one

The epic bundles:
- **Learning Pathways:** E20-S01 (Career Paths) — a navigation/enrollment feature
- **Knowledge Retention:** E20-S02 (Flashcards/SM-2) — a spaced repetition system
- **Analytics:** E20-S03 (Heatmap) + E20-S04 (Radar) — data visualization

These share no data models, no UI components, no business logic. Career Paths and Flashcards have nothing to do with each other. The heatmap and radar chart are independent analytics widgets. Grouping them creates a false sense of cohesion and makes sprint tracking harder — "Epic 20 is 75% done" means nothing when the stories are unrelated.

### M2: `perspective: 1000` should be `perspective: '1000px'` (E20-S02)

**File:** `src/app/components/figma/FlashcardReviewCard.tsx:43`

The web design guidelines review flagged this as LOW. CSS `perspective` requires a unit. While browsers may coerce the number `1000` to `1000px`, this is technically invalid CSS and could behave differently across rendering engines. The inline style `{ perspective: 1000 }` should be `{ perspective: '1000px' }`.

### M3: Career Paths has multiple unfixed MEDIUM code review findings

The E20-S01 code review identified several MEDIUM items marked as "follow-up":
- Course tile display name derived from courseId slug instead of actual course title from DB
- `sortedPaths` applies no sort — misleading variable name
- `networkidle` used as wait strategy in E2E tests instead of auto-retry locators
- Completed courses cannot be revisited (non-interactive div)

These are documented but not tracked in any issue tracker or backlog. "Follow-up" items tend to be forgotten.

### M4: `formatNextReviewDate` off-by-one — today/overdue cards show "Tomorrow" (E20-S02)

**File:** `src/app/pages/Flashcards.tsx:29-40`

Both the code review (M1) and web design guidelines review (L) flagged this. The function returns "Tomorrow" for any date before `tomorrow` (line 37: `if (date < tomorrow)`), which includes today and overdue dates. A card due now shows "Tomorrow" in the stats. This is misleading for a spaced repetition system where "due today" vs "due tomorrow" is a meaningful distinction.

### M5: `aria-disabled` on plain `<div>` has no AT effect (E20-S01)

The design review flagged that locked career path course tiles use `aria-disabled` on plain `<div>` elements. This attribute has no semantic effect on non-interactive elements — screen readers will not announce it. The item needs `role="link"` or `role="button"` with `aria-disabled`, or a visually-hidden description explaining the locked state.

---

## LOW Issues

### L1: Hardcoded `en-US` locale in date formatting (E20-S02, E20-S03)

`formatNextReviewDate` in Flashcards.tsx hardcodes `'en-US'` (line 40). The heatmap also uses `'en-US'` for month labels. While the project is English-only, hardcoding locale creates future i18n friction.

### L2: No burn-in validation on any E20 story

All four stories have `burn_in_validated: false`. For an epic introducing a new spaced repetition algorithm (SM-2), a multi-phase state machine (Flashcards page), and a 365-cell grid renderer (Heatmap), at least E20-S02 and E20-S03 should have been burn-in tested for flakiness. The Flashcards page's `setTimeout(500)` for post-flip focus (line 149) is exactly the kind of timing-dependent behavior that causes E2E flakiness.

### L3: SkillProficiencyRadar `useMemo` has empty dependency array

**File:** `src/app/pages/Overview.tsx` — `useMemo(() => getSkillProficiencyForOverview(), [])`

The computation is memoized with `[]`, meaning it runs once on mount and never updates if the user completes a course while the Overview is open. The radar chart will show stale proficiency data until a full page reload. This is inconsistent with how the rest of the Overview page handles real-time updates.

---

## Cross-Cutting Observations

### Testing Gap Pattern

Two of four stories (S01, S02) — the most complex features — lack dedicated E2E test specs. The simpler analytics widgets (S03, S04) have E2E specs. This is backwards. Complex interactive flows need E2E coverage more than static data visualization.

### Unfixed Review Findings

The code review and design review for E20-S01 and E20-S02 identified multiple HIGH/MEDIUM issues. Some were fixed, but C1, C2, H4, H5, M4, and M5 from this report are all items that were identified in per-story reviews and remain unfixed in the shipped code. The review workflow appears to mark stories as `done` even when HIGH-severity findings are outstanding.

### No Integration Between Features

Career Paths, Flashcards, Heatmap, and Radar Chart are completely siloed:
- Completing a career path course does not create suggested flashcards
- Flashcard review sessions do not contribute to the heatmap's study activity
- The radar chart does not reflect career path progression
- Career path skills are not shown on the proficiency radar

The epic title promises "Learning Pathways & Knowledge Retention" as a unified concept, but the features are isolated islands.

---

## Recommendations

1. **Immediately fix C1 and C2** — these are runtime bugs that affect the core flashcard UX
2. **Add E2E specs for E20-S01 and E20-S02** — the most complex features have the least E2E coverage
3. **Track unfixed review findings** — add M3 items to `docs/known-issues.yaml` or a future epic backlog
4. **Run burn-in on E20-S02** — the flashcard review cycle has timing-dependent UI state transitions
5. **Consider splitting future epics** — unrelated features grouped by theme create false coherence and make progress tracking meaningless

---

*Report generated by adversarial review for Epic 20.*
