# Plan: E07-S07 — Error Path: Corrupted IndexedDB Sessions

## Context

The momentum calculation in `src/lib/momentum.ts` assumes all `StudySession` objects have valid fields — particularly `startTime` as a parseable ISO date string. If IndexedDB contains corrupted sessions (missing fields, invalid timestamps, wrong types), `new Date(s.startTime).getTime()` returns `NaN`, which propagates silently through arithmetic and can produce incorrect momentum scores or crash downstream UI.

This story adds defensive validation so corrupted sessions are **skipped** rather than crashing the app. Analysis tests already exist at `tests/analysis/error-path-corrupted-sessions.spec.ts` — the implementation must make those tests pass, then promote them to regression.

## Approach: Validate at the source (momentum.ts)

Add a `isValidSession()` guard function in `momentum.ts` that filters out corrupted sessions before any date parsing. This is the **single choke point** — both `Courses.tsx` and `StudyScheduleWidget.tsx` call `calculateMomentumScore()`, so fixing it here protects all consumers.

### Task 1: Add session validation in `src/lib/momentum.ts`

Add a `isValidSession()` function that checks:
- `s.startTime` exists and `new Date(s.startTime).getTime()` is not `NaN`
- `s.duration` is a finite positive number (`typeof === 'number'`, `isFinite()`, `>= 0`)
- `s.courseId` is a non-empty string

Filter sessions at the top of `calculateMomentumScore()`:
```typescript
const validSessions = sessions.filter(isValidSession)
```

Then use `validSessions` instead of `sessions` throughout the function. Log a `console.warn` when sessions are filtered out (not `console.error` — this is expected degradation, not an app error).

**File:** `src/lib/momentum.ts` (~15 lines added)

### Task 2: Add defensive filtering in `src/app/pages/Courses.tsx`

The `loadCourseMetrics()` function at line 69 does `db.studySessions.toArray()` and groups by `courseId`. Add a filter after the query to skip sessions with non-string `courseId` (prevents `Map.get()` issues):

```typescript
const rawSessions = await db.studySessions.toArray()
const sessions = rawSessions.filter(s => typeof s.courseId === 'string' && s.courseId)
```

**File:** `src/app/pages/Courses.tsx` (line ~69, ~2 lines changed)

### Task 3: Add defensive filtering in `src/app/components/StudyScheduleWidget.tsx`

The `buildActiveCoursesWithMomentum()` function at line 40 filters sessions by `s.courseId`. Same pattern — filter for valid `courseId` before processing:

```typescript
const courseSessions = sessions.filter(s => typeof s.courseId === 'string' && s.courseId === course.id)
```

**File:** `src/app/components/StudyScheduleWidget.tsx` (line ~40, ~1 line changed)

### Task 4: Promote analysis tests to regression

Copy `tests/analysis/error-path-corrupted-sessions.spec.ts` → `tests/e2e/regression/story-e07-s07.spec.ts`. Update:
- Import paths (relative path change from `../support/` to `../../support/`)
- Verify all 7 test scenarios pass

**Files:**
- Create: `tests/e2e/regression/story-e07-s07.spec.ts`
- Reference: `tests/analysis/error-path-corrupted-sessions.spec.ts`

### Task 5: Run existing momentum tests to verify no regressions

Run the E07-S01 regression tests and any unit tests that exercise momentum calculation to confirm the validation doesn't break happy-path behavior.

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `src/lib/momentum.ts` | Add `isValidSession()` + filter in `calculateMomentumScore()` | ~15 added |
| `src/app/pages/Courses.tsx` | Filter raw sessions after `toArray()` | ~2 changed |
| `src/app/components/StudyScheduleWidget.tsx` | Guard `courseId` filter | ~1 changed |
| `tests/e2e/regression/story-e07-s07.spec.ts` | New file — promoted from analysis | ~362 lines |

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations
3. `npx playwright test tests/e2e/regression/story-e07-s07.spec.ts` — all 7 tests pass
4. `npx playwright test tests/e2e/regression/story-e07-s01.spec.ts` — no regressions in momentum tests
5. `npm run test:unit` — no regressions in unit tests
