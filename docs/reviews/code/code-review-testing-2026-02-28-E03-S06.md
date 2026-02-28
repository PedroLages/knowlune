# Test Coverage Review: E03-S06 — View Course Notes Collection

**Review Date**: 2026-02-28
**Branch**: `feature/e03-s06-view-course-notes-collection`

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Notes tab visible | None | story-e03-s06.spec.ts:98 | Covered |
| 1 | Notes grouped by video | None | story-e03-s06.spec.ts:108 | Covered |
| 1 | Preview snippet | None | story-e03-s06.spec.ts:126 | Covered |
| 1 | Tags | None | story-e03-s06.spec.ts:135-136 | Covered |
| 1 | Timestamp link | None | story-e03-s06.spec.ts:139 | Covered |
| 1 | Last updated date | None | story-e03-s06.spec.ts:126 (title claims it, no assertion) | **Gap** |
| 1 | Sort controls presence | None | story-e03-s06.spec.ts:142 | Partial |
| 1 | Sort controls reorder | None | None | **Gap** |
| 2 | Expand to full content | None | story-e03-s06.spec.ts:156 | Partial |
| 2 | Markdown preview render | None | None | **Gap** |
| 2 | Inline edit | None | story-e03-s06.spec.ts:170 | Covered |
| 2 | Delete with confirmation | None | story-e03-s06.spec.ts:188 | Covered |
| 2 | Delete removes MiniSearch | noteSearch.test.ts:80 (unit) | None | Partial |
| 2 | Timestamp link navigates | None | None | **Gap** |
| 3 | Empty state | None | story-e03-s06.spec.ts:215 | Covered |

**Coverage**: 8/15 sub-criteria fully covered | 4 gaps | 3 partial

## Findings

### Blockers (untested ACs)

1. **AC1 "last updated date" not asserted** (confidence: 95) — Test title claims it but no assertion on formatRelativeDate output.
2. **AC2 timestamp link navigation untested** (confidence: 92) — No test clicks timestamp link and verifies ?t= navigation.

### High Priority

3. **Sort controls not behaviorally tested** (confidence: 88) — Only presence check, no click+reorder assertion.
4. **Expanded content not verified** (confidence: 85) — Expansion test asserts Edit button as proxy, not actual content.
5. **Sort button selector ambiguity** (confidence: 82) — `.or(getByRole('combobox'))` union could match unintended elements.
6. **No beforeEach cleanup for seeded notes** (confidence: 80) — Risk of accumulating duplicate notes across tests.

### Medium

7. **seedNotes duplicates factory functionality** (confidence: 75) — Hardcodes IDs coupled to course data.
8. **Delete toast not verified** (confidence: 72) — NFR23 confirmation tested but success feedback path not asserted.
9. **No cancel-delete test** (confidence: 72) — Critical safety path for NFR23 untested.

### Nits

10. Repeated setup in AC1 tests — extract to beforeEach.
11. Seed order dependency needs comment.
12. createNote factory missing default courseId/videoId.

## Edge Cases to Consider

- Note with `timestamp: 0` (boundary value)
- Content exceeding 120 chars (truncation)
- Note with empty tags array
- Loading state skeleton
- Inline edit save path (full cycle)
- `?t=abc` or `?t=-5` (malformed params)
- Multiple notes on same video (grouping)

Findings: 12 | Blockers: 2 | High: 4 | Medium: 3 | Nits: 3
