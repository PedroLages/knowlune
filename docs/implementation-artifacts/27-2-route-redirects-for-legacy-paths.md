---
story_id: E27-S02
story_name: "Route Redirects For Legacy Paths"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 27.2: Route Redirects For Legacy Paths

## Story

As a learner,
I want old or path-based analytics URLs to redirect to the correct Reports tab,
so that bookmarks, shared links, and legacy navigation still reach the right content.

## Acceptance Criteria

**AC1 — URL-controlled tabs:**

**Given** I navigate to `/reports?tab=study`
**When** the Reports page loads
**Then** the Study Analytics tab is active

**Given** I navigate to `/reports?tab=ai`
**When** the Reports page loads
**Then** the AI Analytics tab is active

**AC2 — Tab click updates URL:**

**Given** I am on the Reports page
**When** I click a different tab
**Then** the URL updates to reflect the selected tab (`?tab=<value>`)
**And** the browser history entry is replaced (not pushed) to avoid back-button spam

**AC3 — Path-based redirects:**

**Given** someone navigates to `/reports/study`
**When** the route resolves
**Then** they are redirected (HTTP 302 equivalent via `<Navigate replace />`) to `/reports?tab=study`

**Given** someone navigates to `/reports/ai`
**When** the route resolves
**Then** they are redirected to `/reports?tab=ai`

**Given** someone navigates to `/reports/quizzes`
**When** the route resolves
**Then** they are redirected to `/reports?tab=quizzes`

**AC4 — Default tab fallback:**

**Given** I navigate to `/reports` with no tab parameter
**When** the page loads
**Then** the Study Analytics tab is active (default)

**Given** I navigate to `/reports?tab=unknown`
**When** the page loads
**Then** the Study Analytics tab is active (fallback to default)

**AC5 — Backward compatibility:**

**Given** existing E2E tests navigate to `/reports`
**When** those tests run
**Then** they still pass (Reports heading visible, Study Analytics tab active by default)

## Tasks / Subtasks

- [x] Task 1: Make Reports.tsx URL-aware (AC: 1, 2, 4) -- already done by E27-S01
  - [x] 1.1 Add `useSearchParams` to read `?tab=` from URL
  - [x] 1.2 Wire `<Tabs value={...}>` to be controlled by URL param
  - [x] 1.3 On tab change, update URL with `setSearchParams` (replace mode)
  - [x] 1.4 Handle unknown/missing tab values -> default to `study`

- [x] Task 2: Add path-based redirect routes (AC: 3)
  - [x] 2.1 Add `<Navigate>` routes in `routes.tsx` for `/reports/study`, `/reports/quizzes`, `/reports/ai`
  - [x] 2.2 Follow existing pattern from `/library` -> `/notes?tab=bookmarks`

- [x] Task 3: Unit tests for Reports tab URL sync (AC: 1, 2, 4) -- already done by E27-S01
  - [x] 3.1 Reports renders with study tab active when URL has `?tab=study`
  - [x] 3.2 Reports renders with AI tab active when URL has `?tab=ai`
  - [x] 3.3 Reports defaults to study tab on bare `/reports`
  - [x] 3.4 Reports defaults to study tab on unknown `?tab=garbage`

- [x] Task 4: E2E tests for redirects and URL behavior (AC: 3, 5)
  - [x] 4.1 `/reports/study` redirects to `/reports?tab=study`
  - [x] 4.2 `/reports/ai` redirects to `/reports?tab=ai`
  - [x] 4.3 `/reports/quizzes` redirects to `/reports?tab=quizzes`
  - [x] 4.4 Tab click updates URL
  - [x] 4.5 Existing E27-S01 regression tests pass (13/13)

- [x] Task 5: Build verification

## Design Guidance

No visual changes. This story is routing/URL infrastructure only. The Reports page appearance stays the same — only the tab state source changes from internal `defaultValue` to URL-controlled `value`.

## Implementation Notes

**Scope reduction**: Tasks 1 and 3 (URL-aware tabs + unit tests) were already implemented by E27-S01 on main. After rebasing, this story only needed Task 2 (path-based redirects) and Task 4 (E2E tests).

**Pattern followed**: Three `<Navigate replace />` entries in `routes.tsx` after the existing `/reports` route, matching the established pattern from `/library` -> `/notes?tab=bookmarks` (line 180).

**Pre-existing test failures**: Reports.test.tsx (4 unit tests) and story-e27-s03.spec.ts (10 E2E tests) fail on main as well. The unit test failures are due to a missing mock after E27-S01 changes. The E27-S03 E2E failures are due to missing welcome wizard seed in `beforeEach`.

**Plan**: [docs/implementation-artifacts/plans/e27-s02-route-redirects-for-legacy-paths.md](plans/e27-s02-route-redirects-for-legacy-paths.md)

## Testing Notes

Unit tests use `MemoryRouter` with `initialEntries` to simulate URL params. E2E tests verify redirect behavior via `page.goto` + `toHaveURL` assertions.

Existing reports-redesign.spec.ts and navigation.spec.ts tests must continue passing after changes.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

- E27-S01 was merged to main before this story began implementation, which meant Tasks 1 and 3 were already complete. The plan was written before E27-S01 shipped, so the scope was larger than needed. Rebasing onto main resolved this cleanly.
- The feature branch had a merge conflict in sprint-status.yaml due to E27-S01 marking itself as done while this branch had marked itself as in-progress. Straightforward resolution by taking both state changes.
