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

- [ ] Task 1: Make Reports.tsx URL-aware (AC: 1, 2, 4)
  - [ ] 1.1 Add `useSearchParams` to read `?tab=` from URL
  - [ ] 1.2 Wire `<Tabs value={...}>` to be controlled by URL param
  - [ ] 1.3 On tab change, update URL with `setSearchParams` (replace mode)
  - [ ] 1.4 Handle unknown/missing tab values → default to `study`

- [ ] Task 2: Add path-based redirect routes (AC: 3)
  - [ ] 2.1 Add `<Navigate>` routes in `routes.tsx` for `/reports/study`, `/reports/quizzes`, `/reports/ai`
  - [ ] 2.2 Follow existing pattern from `/library` → `/notes?tab=bookmarks`

- [ ] Task 3: Unit tests for Reports tab URL sync (AC: 1, 2, 4)
  - [ ] 3.1 Reports renders with study tab active when URL has `?tab=study`
  - [ ] 3.2 Reports renders with AI tab active when URL has `?tab=ai`
  - [ ] 3.3 Reports defaults to study tab on bare `/reports`
  - [ ] 3.4 Reports defaults to study tab on unknown `?tab=garbage`

- [ ] Task 4: E2E tests for redirects and URL behavior (AC: 3, 5)
  - [ ] 4.1 `/reports/study` redirects to `/reports?tab=study`
  - [ ] 4.2 `/reports/ai` redirects to `/reports?tab=ai`
  - [ ] 4.3 `/reports/quizzes` redirects to `/reports?tab=quizzes`
  - [ ] 4.4 Tab click updates URL
  - [ ] 4.5 Existing navigation/reports tests still pass

- [ ] Task 5: Build verification

## Design Guidance

No visual changes. This story is routing/URL infrastructure only. The Reports page appearance stays the same — only the tab state source changes from internal `defaultValue` to URL-controlled `value`.

## Implementation Notes

**Pattern reference**: `Notes.tsx:106-107` shows the `useSearchParams()` approach for URL-controlled tabs. Apply the same pattern to Reports.tsx.

**Existing redirect patterns** in `routes.tsx`:
- Line 173-174: `/library` → `/notes?tab=bookmarks` (exact match for our use case)
- Line 209-216: `/instructors` → `/authors`

**Dependency**: E27-S01 adds a `quizzes` tab. This story's redirect for `/reports/quizzes` will work even before E27-S01 — it just falls back to the default `study` tab until the quizzes TabsTrigger exists.

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

[Document issues, solutions, and patterns worth remembering]
