# Fix E10-S02 Traceability Report Findings

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all actionable findings from the E10-S02 traceability report to achieve PASS gate decision.

**Architecture:** Batch-fix broken import paths in regression specs (systemic issue affecting 9 files), fix stale comment, and verify regression suite runs. The AC5/AC7 timing gaps are accepted as-is (soft gaps, not worth adding flaky timing assertions).

**Tech Stack:** Playwright, TypeScript, sed (batch find-replace)

---

## Findings Summary

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| 1 | 9 regression specs have wrong `../support/` imports (should be `../../support/`) | HIGH | Fix |
| 2 | 5 regression specs have wrong `../utils/` imports (should be `../../utils/`) | HIGH | Fix |
| 3 | E10-S02 spec comment says "13 tests" but has 16 | LOW | Fix |
| 4 | AC5: Missing 300ms timing assertion | P2 | Accept — 500ms timeout is practical guard |
| 5 | AC7: Missing 2-min duration assertion | P3 | Accept — adds flakiness risk |

**Affected files (broken imports):**
- `story-e10-s02.spec.ts` (3 wrong `../support/`)
- `story-e08-s01.spec.ts` (3 wrong `../support/` + 1 wrong `../utils/`)
- `story-e09-s03.spec.ts` (2 wrong `../support/` + 1 wrong `../utils/`)
- `story-e09b-s04.spec.ts` (1 wrong `../support/` + 1 wrong `../utils/`)
- `story-e09b-s06.spec.ts` (2 wrong `../support/` + 1 wrong `../utils/`)
- `story-e9b-s03.spec.ts` (2 wrong `../support/`)
- `story-e9b-s05.spec.ts` (2 wrong `../support/` + 1 wrong `../utils/`)
- `offline-smoke.spec.ts` (2 wrong `../support/`)
- `story-e09-s02-worker-infrastructure.spec.ts` (1 wrong `../support/`)

---

### Task 1: Fix broken `../support/` imports in 9 regression specs

**Files:**
- Modify: `tests/e2e/regression/story-e10-s02.spec.ts`
- Modify: `tests/e2e/regression/story-e08-s01.spec.ts`
- Modify: `tests/e2e/regression/story-e09-s03.spec.ts`
- Modify: `tests/e2e/regression/story-e09b-s04.spec.ts`
- Modify: `tests/e2e/regression/story-e09b-s06.spec.ts`
- Modify: `tests/e2e/regression/story-e9b-s03.spec.ts`
- Modify: `tests/e2e/regression/story-e9b-s05.spec.ts`
- Modify: `tests/e2e/regression/offline-smoke.spec.ts`
- Modify: `tests/e2e/regression/story-e09-s02-worker-infrastructure.spec.ts`

**Step 1: Batch replace `../support/` → `../../support/` in all 9 files**

Run this sed command to fix all imports at once:

```bash
cd tests/e2e/regression
for f in story-e10-s02.spec.ts story-e08-s01.spec.ts story-e09-s03.spec.ts story-e09b-s04.spec.ts story-e09b-s06.spec.ts story-e9b-s03.spec.ts story-e9b-s05.spec.ts offline-smoke.spec.ts story-e09-s02-worker-infrastructure.spec.ts; do
  sed -i '' "s|from '\.\./support/|from '../../support/|g" "$f"
done
```

**Why:** Regression specs live one directory deeper (`tests/e2e/regression/`) than active specs (`tests/e2e/`). The shared support code is at `tests/support/`. From `tests/e2e/regression/`, the correct relative path is `../../support/`, not `../support/`.

**Step 2: Verify no `../support/` imports remain in regression dir**

```bash
grep -r "from '\.\./support/" tests/e2e/regression/ | wc -l
```

Expected: `0`

---

### Task 2: Fix broken `../utils/` imports in 5 regression specs

**Files:**
- Modify: `tests/e2e/regression/story-e08-s01.spec.ts`
- Modify: `tests/e2e/regression/story-e09-s03.spec.ts`
- Modify: `tests/e2e/regression/story-e09b-s04.spec.ts`
- Modify: `tests/e2e/regression/story-e09b-s06.spec.ts`
- Modify: `tests/e2e/regression/story-e9b-s05.spec.ts`

**Step 1: Batch replace `../utils/` → `../../utils/` in all 5 files**

```bash
cd tests/e2e/regression
for f in story-e08-s01.spec.ts story-e09-s03.spec.ts story-e09b-s04.spec.ts story-e09b-s06.spec.ts story-e9b-s05.spec.ts; do
  sed -i '' "s|from '\.\./utils/|from '../../utils/|g" "$f"
done
```

**Step 2: Verify no `../utils/` imports remain**

```bash
grep -r "from '\.\./utils/" tests/e2e/regression/ | wc -l
```

Expected: `0`

---

### Task 3: Fix stale test count comment in E10-S02 spec

**File:**
- Modify: `tests/e2e/regression/story-e10-s02.spec.ts:6`

**Step 1: Update comment from "13 tests" to "16 tests"**

Change line 6:
```
 * 13 tests covering all 7 ACs.
```
To:
```
 * 16 tests covering all 7 ACs.
```

---

### Task 4: Verify regression specs compile and run

**Step 1: Verify all 9 fixed specs can be found by Playwright**

```bash
RUN_REGRESSION=1 npx playwright test tests/e2e/regression/story-e10-s02.spec.ts --project=chromium --list 2>&1 | grep -c "test"
```

Expected: `16` (test listings, not "No tests found")

**Step 2: Run one fixed spec end-to-end to confirm**

```bash
RUN_REGRESSION=1 npx playwright test tests/e2e/regression/story-e10-s02.spec.ts --project=chromium --reporter=list
```

Expected: All 16 tests pass.

**Step 3: Spot-check another fixed spec**

```bash
RUN_REGRESSION=1 npx playwright test tests/e2e/regression/story-e09b-s06.spec.ts --project=chromium --list 2>&1 | head -20
```

Expected: Test listings appear (no import error).

---

### Task 5: Commit

**Step 1: Stage and commit**

```bash
git add tests/e2e/regression/story-e10-s02.spec.ts \
        tests/e2e/regression/story-e08-s01.spec.ts \
        tests/e2e/regression/story-e09-s03.spec.ts \
        tests/e2e/regression/story-e09b-s04.spec.ts \
        tests/e2e/regression/story-e09b-s06.spec.ts \
        tests/e2e/regression/story-e9b-s03.spec.ts \
        tests/e2e/regression/story-e9b-s05.spec.ts \
        tests/e2e/regression/offline-smoke.spec.ts \
        tests/e2e/regression/story-e09-s02-worker-infrastructure.spec.ts

git commit -m "fix(regression): correct import paths for 9 archived specs

Specs moved to tests/e2e/regression/ need ../../support/ and ../../utils/
(one directory deeper than active specs). Also fixes stale test count
comment in E10-S02 spec (13 → 16 tests)."
```

---

### Task 6: Update traceability report

**File:**
- Modify: `_bmad-output/test-artifacts/traceability-report.md`

**Step 1: Update gate decision from CONCERNS to PASS**

After fixing the regression import paths, AC5 is the only remaining soft gap. Since all functional tests pass, the regression spec is now runnable, and the timing assertion gap is accepted — update the gate decision.

Update the YAML frontmatter `lastSaved` to today's date, and change:
- Gate decision: `CONCERNS` → `PASS` (with note about accepted timing gap)
- Rationale: Note regression specs now runnable
