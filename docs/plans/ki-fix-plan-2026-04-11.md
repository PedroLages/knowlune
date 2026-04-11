# Retroactive Known Issues Fix Plan (KI-033 to KI-056)

> **For Claude:** Run this plan in a separate session from the mega-run. Use `/auto-answer autopilot` in all fix agents.

**Goal:** Fix all open HIGH and MEDIUM known issues accumulated during E107–E109 (Phase C was skipped). LOW/NIT items triaged — fix easy ones, mark remainder as `wont-fix` or `scheduled_for` a future epic.

**Branch:** `chore/ki-fix-retroactive-2026-04-11`

**Created:** 2026-04-11

---

## Context

During the E107–E115 mega-run, post-epic Phase C (fix pass) was skipped for E107, E108, and E109. This left 22 open known issues in `docs/known-issues.yaml`. This plan addresses them retroactively before new epics benefit from the updated Phase C enforcement.

---

## Issue Inventory (22 open)

### HIGH (6 items — MUST fix)

| KI | Summary | File/Area | Origin |
|----|---------|-----------|--------|
| KI-034 | OPDS credentials stored in plaintext IndexedDB | opdsCatalogs table + Book.source.auth | E88-NFR |
| KI-049 | "Spaced repetition" label but no SM-2 scheduling | HighlightReview.tsx | E109-adversarial |
| KI-050 | Vocabulary review serves all items every session — no scheduling | useVocabularyStore.ts | E109-adversarial |
| KI-051 | SearchAnnotations loads full DB (500+500) on mount before user types | SearchAnnotations.tsx | E109-adversarial |
| KI-052 | HighlightExportDialog modal={false} breaks focus trap | HighlightExportDialog.tsx | E109-adversarial |
| KI-053 | AnnotationSummary load() has no try/catch | AnnotationSummary.tsx | E109-nfr |

### MEDIUM (6 items — fix)

| KI | Summary | File/Area | Origin |
|----|---------|-----------|--------|
| KI-037 | react-hooks/exhaustive-deps rule not found — ESLint config | eslint.config.js | E107-S01 |
| KI-038 | Duplicate of KI-037 | eslint.config.js | E107-S01 |
| KI-041 | skipSilence toggle persists but has zero functional effect | AudioSettings | E108-adversarial |
| KI-042 | Book.genre typed as string instead of BookGenre enum | data/types.ts | E108-adversarial |
| KI-043 | Bulk EPUB import has no E2E coverage (OPFS fixtures needed) | E108-S01 tests | E108-adversarial |
| KI-054 | AnnotationSummary back button hardcodes `/library` | AnnotationSummary.tsx | E109-adversarial |
| KI-055 | Vocabulary mutation flows have zero E2E coverage | E109-S01 tests | E109-adversarial |

### LOW (10 items — triage: fix easy ones, defer rest)

| KI | Summary | Fix? |
|----|---------|------|
| KI-033 | 55 ESLint warnings across codebase | defer — cleanup epic |
| KI-039 | AudioMiniPlayer coverError state not reset on switch | fix (1 line) |
| KI-040 | BookReader uses raw useEffect for keyboard shortcuts | defer — refactor |
| KI-044 | usePagesReadToday 2-min/page estimation inaccurate | defer — needs research |
| KI-045 | G+L chord shortcut lacks visual feedback | defer — UX epic |
| KI-046 | useVocabularyStore now() testability | fix (extract helper) |
| KI-047 | Vocabulary handleDelete stale closure risk | fix (use functional setState) |
| KI-048 | EditDialog uses Input instead of Textarea | fix (swap component) |
| KI-056 | Daily Review/Search have no sidebar nav entries | fix (add nav items) |

---

## Execution Steps

### Task 1: Create branch and verify baseline

```bash
git checkout main && git pull
git checkout -b chore/ki-fix-retroactive-2026-04-11
npm run build && npm run lint && npm run test:unit && npx tsc --noEmit
```

All must pass before any changes.

### Task 2: Fix HIGH issues (dispatch parallel agents where independent)

**Agent A — KI-053 + KI-051 + KI-054 (AnnotationSummary + SearchAnnotations):**

- KI-053: Wrap `load()` in try/catch with `toast.error()` and `setLoading(false)` in catch
- KI-051: Remove eager full-DB load on mount — only query after user types (debounced)
- KI-054: Replace `navigate('/library')` with `navigate(-1)` for proper back navigation

**Agent B — KI-052 (HighlightExportDialog):**

- Remove `modal={false}` or replace with proper focus-trap-aware implementation
- Verify keyboard tab containment after fix

**Agent C — KI-049 + KI-050 (Review scheduling):**

- KI-049: Rename "spaced repetition" to "priority review" throughout HighlightReview.tsx (honest labeling)
- KI-050: Add `lastReviewedAt` field to vocabulary items; skip recently-reviewed items in review session

**Agent D — KI-034 (OPDS credentials):**

- This is a security issue — evaluate scope carefully
- Minimum fix: remove credential duplication from Book.source.auth (single source in opdsCatalogs)
- Full fix (if straightforward): encrypt credentials at rest in IndexedDB
- If encryption requires significant architecture work → fix duplication only, mark encryption as `scheduled_for: E119` (security epic)

### Task 3: Fix MEDIUM issues

**Agent E — KI-037/KI-038 (ESLint config):**

- Install `eslint-plugin-react-hooks` if missing, or fix config reference
- KI-038 is duplicate of KI-037 — fix once, close both

**Agent F — KI-041 + KI-042 (AudioSettings + Book.genre):**

- KI-041: Either wire skipSilence to audio processor OR remove the toggle with a comment explaining it's not implemented yet
- KI-042: Change `genre: string` to `genre: BookGenre` in types.ts; update all consumers

**Agent G — KI-043 + KI-055 (missing E2E coverage):**

- KI-043: Create basic E2E test for bulk import (mock file input if OPFS not available)
- KI-055: Create E2E tests for vocabulary edit, delete, undo flows
- If OPFS fixtures genuinely can't be created → mark KI-043 as `scheduled_for` with explanation

### Task 4: Fix easy LOW issues

Fix these directly (no agents needed — they're 1-5 line changes each):

- KI-039: Reset `coverError` state when `currentBook` changes in AudioMiniPlayer
- KI-046: Extract `now()` helper for testability in useVocabularyStore
- KI-047: Use functional `setState(prev => ...)` in handleDelete to avoid stale closure
- KI-048: Replace `<Input>` with `<Textarea>` in EditDialog definition field
- KI-056: Add sidebar nav entries for Daily Highlight Review and Cross-Book Search

### Task 5: Mark remaining LOW as deferred

Update `docs/known-issues.yaml` for items NOT fixed:

- KI-033: `scheduled_for: cleanup-epic`
- KI-040: `scheduled_for: cleanup-epic`
- KI-044: `scheduled_for: E112` (Reading Analytics — has pages/speed context)
- KI-045: `scheduled_for: cleanup-epic`

### Task 6: Verify and commit

```bash
npm run build && npm run lint && npm run test:unit && npx tsc --noEmit
```

All must pass. Then:

```bash
git add -A
git commit -m "fix: retroactive known issues cleanup (KI-033 to KI-056)

Fixes 17 known issues accumulated during E107-E109 mega-run.
HIGH: 6 fixed, MEDIUM: 7 fixed, LOW: 5 fixed, 4 deferred.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 7: Create PR and merge

```bash
gh pr create --title "fix: retroactive KI cleanup (KI-033 to KI-056)" --body "..."
gh pr merge --squash --auto
```

### Task 8: Update known-issues.yaml statuses

After merge, update all fixed KIs:

- `status: fixed`
- `fixed_by: chore/ki-fix-retroactive-2026-04-11`
- `fixed_on: 2026-04-11`

---

## Success Criteria

- Zero HIGH known issues with `status: open`
- Zero MEDIUM known issues with `status: open`
- All deferred LOW items have `scheduled_for` set
- `npm run build && npm run lint && npm run test:unit && npx tsc --noEmit` all pass
- PR merged to main

---

## Estimated Scope

- **17 fixes** (6 HIGH + 7 MEDIUM + 5 easy LOW)
- **4 deferred** (complex LOW items → future epics)
- **Parallel agents:** Up to 4 concurrent fix agents for HIGH, 3 for MEDIUM
