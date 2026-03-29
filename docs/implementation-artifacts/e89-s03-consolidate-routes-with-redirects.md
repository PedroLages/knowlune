---
story_id: E89-S03
story_name: "Consolidate Routes with Redirects"
status: in-progress
started: 2026-03-29
completed:
reviewed: true
review_started: 2026-03-29
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 89.03: Consolidate Routes with Redirects

## Story

As a learner,
I want all course content accessible under a single `/courses/` URL family,
so that I have consistent, predictable URLs regardless of course source.

## Acceptance Criteria

- AC1: Given unified routes exist at `/courses/:courseId` (detail) and `/courses/:courseId/lessons/:lessonId` (player), when navigating to either, then the correct unified page component renders.
- AC2: Given redirect routes for all 4 old URL patterns (`/imported-courses/:courseId`, `/imported-courses/:courseId/lessons/:lessonId`, `/youtube-courses/:courseId`, `/youtube-courses/:courseId/lessons/:lessonId`), when navigating to any old path, then the browser redirects to the corresponding `/courses/` path using `<Navigate replace />`.
- AC3: Given all internal `<Link>` components in the codebase, when grepping for `/imported-courses/` or `/youtube-courses/` in non-redirect `.tsx` files, then zero occurrences are found.
- AC4: Given quiz routes are kept under `/courses/:courseId/lessons/:lessonId/quiz`, when navigating to quiz paths, then quizzes render correctly.
- AC5: Given redirect routes include `// TODO: Remove redirect after Epic E91+` comments, when reviewing the code, then cleanup intent is documented.
- AC6: All E2E tests are updated to use new `/courses/` URL patterns and pass.

## Tasks / Subtasks

- [ ] Task 1: Add unified routes `/courses/:courseId` and `/courses/:courseId/lessons/:lessonId` to routes.tsx (AC: 1)
  - [ ] 1.1 Create placeholder components that render existing ImportedCourseDetail/ImportedLessonPlayer (adapter detection comes in S04/S05)
- [ ] Task 2: Replace old imported/youtube route entries with redirect components (AC: 2, 5)
  - [ ] 2.1 Create redirect components following InstructorProfileRedirect pattern
  - [ ] 2.2 Add TODO comments for future cleanup
- [ ] Task 3: Update all internal `<Link>` and `navigate()` calls (AC: 3)
  - [ ] 3.1 Update ImportedCourseCard.tsx navigate calls
  - [ ] 3.2 Update ImportedCourseDetail.tsx Link components
  - [ ] 3.3 Update ImportedLessonPlayer.tsx Link components
  - [ ] 3.4 Update YouTubeCourseDetail.tsx Link components
  - [ ] 3.5 Update YouTubeLessonPlayer.tsx Link components
  - [ ] 3.6 Update KnowledgeGaps.tsx video path
  - [ ] 3.7 Update courseImport.ts actionUrl
- [ ] Task 4: Verify quiz sub-routes work (AC: 4)
- [ ] Task 5: Update E2E tests to use new URL patterns (AC: 6)
- [ ] Task 6: Verify build passes and run E2E smoke tests

## Implementation Notes

- Created `UnifiedCourseDetail` and `UnifiedLessonPlayer` as thin delegation wrappers using `useCourseAdapter` to detect course source and render the appropriate existing component
- Added 4 redirect components (`ImportedCourseRedirect`, `ImportedLessonRedirect`, `YouTubeCourseRedirect`, `YouTubeLessonRedirect`) following the existing `InstructorProfileRedirect` pattern with `<Navigate replace />`
- All redirect components include `// TODO: Remove redirect after Epic E91+` comments (AC5)
- Quiz sub-routes at `courses/:courseId/lessons/:lessonId/quiz/*` placed before the unified routes to ensure more specific paths match first

## Testing Notes

- Updated 14 E2E spec files to use new `/courses/` URL patterns
- Unit tests for ImportedCourseDetail and ImportedLessonPlayer updated with new route paths
- Verified zero occurrences of `/imported-courses/` or `/youtube-courses/` in non-redirect `.tsx` files (AC3)

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

Skipped — no visual UI changes. This story only changes route wiring and internal link targets. The rendered components (ImportedCourseDetail, YouTubeCourseDetail, etc.) are unchanged.

## Code Review Feedback

**Reviewed 2026-03-29** — 37 files changed, 366 insertions, 237 deletions.

**Architecture**: Clean delegation pattern. UnifiedCourseDetail/UnifiedLessonPlayer are thin wrappers using useCourseAdapter to detect source and delegate to existing components. This is the correct transitional approach for S03 before S04/S05 build real unified pages.

**Findings:**
- [MEDIUM] Redirect components do not preserve query strings or hash fragments. If a user bookmarks `/imported-courses/abc?tab=notes`, the redirect loses `?tab=notes`. Matches existing InstructorProfileRedirect pattern, but worth noting for E91+ cleanup.
- [LOW] UnifiedCourseDetail performs a Dexie lookup via useCourseAdapter just to determine source, then delegates to ImportedCourseDetail/YouTubeCourseDetail which perform their own lookups. Double database hit per page load. Acceptable for transitional component — S04 will eliminate this.
- [NIT] Four redirect components share identical structure and could be a single generic `CourseRedirect` component with a path mapping. Not worth refactoring since these are temporary (E91+ removal).

## Challenges and Lessons Learned

- **Unused lazy imports after route refactoring**: When replacing direct route components with redirect components, the original `React.lazy()` imports for `ImportedCourseDetail`, `ImportedLessonPlayer`, `YouTubeCourseDetail`, and `YouTubeLessonPlayer` were left in routes.tsx but no longer referenced in JSX. TypeScript caught these as TS6133 errors during pre-review. Pattern: when replacing route components with redirects, always remove the corresponding lazy imports.
- **Formatter-driven diffs in adapter layer**: Prettier reformatted the `courseAdapter.ts` and `useCourseAdapter.ts` files significantly (trailing commas, arrow function parens, line wrapping) despite minimal functional changes. This inflated the diff from ~10 functional lines to ~50 lines. Worth noting for future reviews that large diffs in these files may be formatting-only.
- **Pre-existing unit test failures**: 5 test files (settings, isPremium, Authors, AtRiskBadge, VideoReorderList) have pre-existing failures unrelated to this branch. The 2 failures in ImportedCourseDetail.test.tsx (testid content assertions) are also pre-existing -- the branch actually fixed 2 additional URL-related failures in that file.
