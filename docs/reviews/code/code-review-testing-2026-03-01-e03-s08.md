# Test Coverage Review: E03-S08 — Global Notes Dashboard

**Date**: 2026-03-01
**Test file**: `tests/e2e/story-e03-s08.spec.ts`

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Notes page displays all notes across courses (context, sort, count) | None (story says not required) | `story-e03-s08.spec.ts:118–174` — 5 tests | Covered |
| 2 | Full-text search with real-time filtering and highlights | None | `story-e03-s08.spec.ts:176–215` — 3 tests | Partial |
| 3 | Tag-based filtering with AND semantics when combined with search | None | `story-e03-s08.spec.ts:217–284` — 4 tests | Covered |
| 4 | Sort controls (Most Recent, Oldest First, By Course) | None | `story-e03-s08.spec.ts:286–326` — 3 tests | Partial |
| 5 | Expand note card with full content and "Open in Lesson" navigation | None | `story-e03-s08.spec.ts:328–374` — 3 tests | Partial |

**Coverage**: 2/5 ACs fully covered | 0 with zero coverage | 3 partial

## Findings

### High Priority

1. **AC5 timestamp test doesn't verify click behavior** (confidence: 88) — `story-e03-s08.spec.ts:362–373`: Only asserts `getByText('0:30')` is visible, never clicks the button or verifies navigation. AC says "clicking it seeks the video to that position." Fix: add click + URL assertion.

2. **AC2 highlight test has broad locator** (confidence: 85) — `story-e03-s08.spec.ts:193–203`: Checks for `<mark>` with "influence" but doesn't scope to note cards. Fix: scope to `[data-testid="note-card"] mark`.

3. **seedNotes lacks retry logic** (confidence: 80) — `story-e03-s08.spec.ts:27–94`: Raw `indexedDB.open` without retry, unlike the `indexeddb-fixture.ts` which retries 10 times. May fail if Dexie hasn't initialized the store yet.

4. **No afterEach cleanup** (confidence: 78) — `story-e03-s08.spec.ts:96–116`: Tests don't clean up seeded notes between runs. Stale data from previous runs could affect retries.

### Medium

5. **Sort dropdown locator uses unnecessary `.or()` fallback** (confidence: 72) — `story-e03-s08.spec.ts:292–295`: `combobox` role is correct, the `button` fallback is dead code.

6. **Oldest First sort test lacks dropdown-close wait** (confidence: 70) — `story-e03-s08.spec.ts:303–309`: No explicit wait for Select portal to close before asserting card order.

7. **Sidebar navigation test doesn't actually click sidebar** (confidence: 65) — `story-e03-s08.spec.ts:119–125`: Navigates directly to `/notes` instead of clicking the sidebar link.

8. **Inline seed data duplicates factory** (confidence: 72) — A `createNote` factory exists at `tests/support/fixtures/factories/course-factory.ts:110–121` but isn't used.

### Nits

9. **Stale "RED phase" comment** in file header (confidence: 50)
10. **Dead `.or()` fallback** in "Open in Lesson" locator (confidence: 50)
11. **Course name dependency undocumented** — uses `shortTitle` from static data without comment (confidence: 60)

## Edge Cases Not Tested

- No-timestamp note expansion (conditional timestamp button branch)
- Notes with unrecognized `courseId` (fallback to raw ID display)
- "By Course" sort combined with active search/tag filter
- Combined empty state message (search + tag filter both active, zero results)
