---
story_id: E23-S01
story_name: "Remove Hardcoded Branding from Courses Page"
status: done
started: 2026-03-22
completed: 2026-03-23
reviewed: true
review_started: 2026-03-22
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 23.1: Remove Hardcoded Branding from Courses Page

## Story

As a learner,
I want the Courses page to reflect my actual imported courses without hardcoded branding,
so that the platform feels personal and accurately represents my learning content.

## Acceptance Criteria

- **AC1**: Given the Courses page is loaded, when the user views the page, then no hardcoded course provider names, logos, or branding text are displayed
- **AC2**: Given the Courses page is loaded, when there are no imported courses, then an appropriate empty state is shown instead of hardcoded placeholder courses
- **AC3**: Given hardcoded branding elements existed previously, when they are removed, then design tokens and the existing theme system are used for all remaining styling
- **AC4**: Given the Courses page is modified, when viewed on mobile, tablet, and desktop, then the layout remains responsive and visually correct

## Tasks / Subtasks

- [ ] Task 1: Audit Courses page for hardcoded branding (AC: 1)
  - [ ] 1.1 Identify hardcoded provider names, logos, course titles
  - [ ] 1.2 Identify hardcoded image URLs or placeholder content
- [ ] Task 2: Remove or replace hardcoded branding elements (AC: 1, 2)
  - [ ] 2.1 Replace hardcoded content with dynamic data from store/DB
  - [ ] 2.2 Add empty state for when no courses exist
- [ ] Task 3: Verify design token compliance (AC: 3)
  - [ ] 3.1 Ensure no hardcoded colors remain (ESLint will catch)
  - [ ] 3.2 Use theme.css tokens for all styling
- [ ] Task 4: Responsive verification (AC: 4)
  - [ ] 4.1 Test mobile, tablet, desktop layouts

## Design Guidance

### Scope

This story targets the **Courses page header** (line 209 of `Courses.tsx`) which displays hardcoded branding: `"Chase Hughes — The Operative Kit"`. The pre-seeded course *data* in `src/data/courses/` is out of scope (covered by E23-S05).

### Key Changes

**1. Header subtitle (line 209)**
- **Remove**: `"Chase Hughes — The Operative Kit ({count} courses + {n} imported)"`
- **Replace with**: Dynamic summary derived from actual data — e.g., `"{totalCount} courses"` or `"{importedCount} imported courses"` when only imported courses exist
- **Empty state**: When both `allCourses.length === 0 && importedCourses.length === 0`, show no subtitle (count is meaningless at zero)

**2. Empty state component (`data-testid="courses-empty-state"`)**
- The "Imported Courses" section already has an empty state (line 274-301)
- The pre-seeded section (line 367-370) shows `"No courses match your search"` — this is a *filter* empty state, not a *zero courses* empty state
- **Reuse**: `src/app/components/EmptyState.tsx` — the project already has a motion-animated empty state component used in Overview.tsx and Reports.tsx
- **Add**: A true empty state when `allCourses.length === 0 && importedCourses.length === 0`:
  - Use `<EmptyState>` component with `data-testid="courses-empty-state"`
  - Icon: `BookOpen` from lucide-react (same as Overview.tsx empty state)
  - Title: "No courses yet"
  - Description: "Import a course folder to get started"
  - `onAction`: reuse existing `handleImportCourse`
  - Action label: "Import Course"

**3. Design tokens**
- All existing styling on the Courses page already uses design tokens (`bg-card`, `text-muted-foreground`, `bg-brand`, etc.)
- The header subtitle uses `text-muted-foreground` — keep this
- Empty state should use: `text-muted-foreground` for text, `bg-muted/50` for background (matching the imported courses empty state pattern at line 277)

**4. Responsive considerations**
- Header: `flex items-start justify-between gap-4` already handles responsive — keep as-is
- Empty state: Use `flex flex-col items-center text-center` for vertical centering at all breakpoints
- No layout changes needed beyond the empty state addition

### Component patterns to follow
- Match the existing imported courses empty state pattern (lines 274-301) for visual consistency
- Use `role="region"` and `aria-label` on the empty state container

## Implementation Plan

See [plan](plans/e23-s01-remove-hardcoded-branding.md) for implementation approach.

## Implementation Notes

- Replaced hardcoded header subtitle `"Chase Hughes — The Operative Kit ({count} courses + {n} imported)"` with dynamic `"{totalCount} courses"` derived from actual data
- Added global `EmptyState` component (reused from Overview.tsx) when both `allCourses` and `importedCourses` are empty — this takes priority over the per-section imported courses empty state
- Used existing `EmptyState` component with `BookOpen` icon, matching the established pattern
- Prototype file `HybridCourses.tsx` also updated to remove hardcoded branding references

## Testing Notes

- Unit tests updated to assert against global empty state ("No courses yet" + test ID) instead of per-section imported courses empty state
- E2E test AC2 clears IndexedDB via fixture `clearStore()` helper, then blocks re-seeding with `addInitScript` to test true empty state
- Responsive tests verify no horizontal overflow at 375px, 768px, and 1440px viewports

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

- **All 4 ACs pass** — no blockers, no high-priority issues
- AC1: Header reads "All Courses / 8 courses" — no hardcoded branding
- AC2: EmptyState renders with BookOpen icon, correct title/description, Import Course CTA
- AC3: Zero hardcoded colors in Courses.tsx and EmptyState.tsx
- AC4: Desktop 5 cols, Tablet 3 cols, Mobile 1 col — no overflow
- Accessibility: contrast ratios well above 4.5:1, skip-to-content link, prefers-reduced-motion honored
- **M1**: EmptyState action button missing `variant="brand"` (visual inconsistency with header button)
- **M2** (pre-existing): Search input height 36px, below 44px touch target on mobile
- Report: `docs/reviews/design/design-review-2026-03-22-E23-S01.md`

## Code Review Feedback

- **0 blockers** — 2 HIGH findings both fixed in commit `1f4fb505`
- [FIXED] HybridCourses.tsx:42 — `text-neutral-500` → `text-muted-foreground`
- [FIXED] Courses.tsx:249 — `w-5 h-5` → `size-5` on Search icon
- [FIXED] Courses.tsx:211 — singular/plural "1 courses" → "1 course" (edge case review)
- M: `addInitScript` IDB monkey-patch fragility (documented in lessons learned)
- M: Duplicate `allCourses.length + importedCourses.length` expression
- M: 10s timeout on empty state assertion
- Report: `docs/reviews/code/code-review-2026-03-22-E23-S01.md`
- Test coverage: 4/4 ACs covered — `docs/reviews/code/code-review-testing-2026-03-22-E23-S01.md`
- Edge cases: 8 findings (0 high, 3 medium) — `docs/reviews/code/edge-case-review-2026-03-22-E23-S01.md`

## Web Design Guidelines Review

- HIGH: `transition-all` on Button — pre-existing pattern, not introduced by E23-S01
- M: Placeholder uses `...` instead of `…` (ellipsis character)
- M: Search input missing `name` and `autocomplete="off"`
- M: Filter/search state not reflected in URL params (broader architectural concern)
- Report: `docs/reviews/design/web-design-guidelines-2026-03-22-E23-S01.md`

## Challenges and Lessons Learned

- **Two-tier empty state design**: The Courses page now has two empty state tiers — a global one (EmptyState component, shown when no courses at all) and a per-section one (inline card, shown when pre-seeded courses exist but no imported courses). The global empty state short-circuits the entire page, so the per-section empty state only renders when `allCourses.length > 0`. Unit tests must account for this hierarchy.
- **Unit test mock coverage gap**: The existing `Courses.test.tsx` didn't mock `useCourseStore`, so `allCourses` defaulted to `[]`. This meant the test saw the global empty state rather than the imported courses empty state it was asserting against. Fixed by updating assertions to match the actual rendered state.
- **E2E IndexedDB clearing**: Initially used manual `indexedDB.open()` + transaction clearing, but the test pattern validator flagged this as a MEDIUM anti-pattern. Simplified to use the `indexedDB` fixture's `clearStore()` method which has built-in retry logic and is more reliable.
- **addInitScript for seed blocking**: To test a truly empty Courses page in E2E, we need to not only clear IDB but also prevent the app from re-seeding on navigation. The `page.addInitScript()` approach intercepts `IDBObjectStore.prototype.add` to silently skip course seeding — a pattern worth reusing for other "empty state" E2E tests.
