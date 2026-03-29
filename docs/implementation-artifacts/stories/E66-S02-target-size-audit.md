---
story_id: E66-S02
story_name: "Target Size Audit and Fixes"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 66.2: Target Size Audit and Fixes (WCAG 2.5.8)

## Story

As a user with motor impairments,
I want all interactive elements to meet the 24px minimum target size,
so that I can reliably tap and click controls without misses.

## Acceptance Criteria

**Given** I audit all interactive elements across the application
**When** I measure button, link, and control sizes
**Then** all targets are at least 24x24 CSS pixels or have at least 24px spacing from neighboring targets

**Given** dense UI areas (table action buttons, tag chips, inline links)
**When** I measure their click targets
**Then** each meets the 24px minimum or has sufficient spacing to qualify for the spacing exception

**Given** quiz question option buttons
**When** I measure their dimensions
**Then** each option is at least 44x44px (Knowlune's existing standard, exceeding the 24px requirement)

**Given** the TopicFilter chip buttons
**When** I measure their dimensions
**Then** each chip is at least 24px tall with 24px horizontal spacing between chips

**Given** small icon buttons (e.g., close buttons, action icons in lists)
**When** they are smaller than 24x24px visually
**Then** their click area (padding included) is at least 24x24px

**Given** an E2E test runs the target size audit
**When** it checks all `button`, `a[href]`, `[role="button"]`, `input`, `select` elements
**Then** it reports any elements below 24x24px (excluding inline text links and browser-controlled elements)

## Tasks / Subtasks

- [ ] Task 1: Create automated target size audit test (AC: 6)
  - [ ] 1.1 Create `tests/audit/target-size.spec.ts`
  - [ ] 1.2 For each page route, query all interactive elements: `button`, `a[href]`, `[role="button"]`, `input`, `select`, `[role="checkbox"]`, `[role="switch"]`, `[role="slider"]`
  - [ ] 1.3 Measure bounding box of each element via `element.boundingBox()`
  - [ ] 1.4 Report any element where `width < 24 || height < 24` AND spacing to nearest interactive neighbor < 24px
  - [ ] 1.5 Exclude: inline text links within paragraphs, browser-controlled elements (`<select>` native dropdown)
  - [ ] 1.6 Generate report output listing non-compliant elements with page, selector, and measured dimensions

- [ ] Task 2: Run audit and catalog findings (AC: 1-2)
  - [ ] 2.1 Run audit across all routes: Overview, MyClass, Courses, CourseDetail, Authors, AuthorProfile, Reports, Settings, LearningPaths, LearningPathDetail, Notes, Quiz, Flashcards, Challenges, Login
  - [ ] 2.2 Catalog each finding: element, page, current size, required fix

- [ ] Task 3: Fix TopicFilter chip buttons (AC: 4)
  - [ ] 3.1 Open `src/app/components/figma/TopicFilter.tsx`
  - [ ] 3.2 Ensure chips have `min-h-6` (24px) minimum and `gap-6` (24px spacing) between chips
  - [ ] 3.3 If using `Badge` component, check that padding provides adequate touch target

- [ ] Task 4: Fix small icon buttons across the app (AC: 5)
  - [ ] 4.1 Audit close buttons (X icons) — ensure `min-w-6 min-h-6` or padding expands click area
  - [ ] 4.2 Audit table action buttons (edit, delete icons in list views)
  - [ ] 4.3 Audit inline icon buttons (TagEditor, TagBadgeList, StatusFilter)
  - [ ] 4.4 For each: add `min-w-6 min-h-6` padding or use `size="icon"` Button variant which already has 36x36px target

- [ ] Task 5: Fix dense UI areas (AC: 2)
  - [ ] 5.1 Review `TagManagementPanel.tsx` — tag action buttons
  - [ ] 5.2 Review `TagBadgeList.tsx` — remove tag buttons
  - [ ] 5.3 Review `StatusFilter.tsx` — filter chips
  - [ ] 5.4 Review quiz-related grids: `QuestionGrid.tsx`, `ReviewQuestionGrid.tsx`, `QuestionBreakdown.tsx`
  - [ ] 5.5 Apply minimum size or spacing fixes

- [ ] Task 6: Verify quiz option buttons meet 44px standard (AC: 3)
  - [ ] 6.1 Check `src/app/pages/Quiz.tsx` option buttons
  - [ ] 6.2 Confirm they already meet 44x44px — document as passing

- [ ] Task 7: Re-run audit to confirm all fixes (AC: 1-6)
  - [ ] 7.1 Re-run `tests/audit/target-size.spec.ts`
  - [ ] 7.2 Verify zero violations (or only acceptable exclusions)
  - [ ] 7.3 Add audit as regression guard in CI

## Design Guidance

- **Minimum size**: 24x24 CSS pixels per WCAG 2.5.8 AA
- **Knowlune standard**: 44x44px for primary interactive elements (exceeds requirement)
- **Spacing exception**: Elements < 24px are compliant if they have >= 24px spacing from nearest interactive neighbor
- **Fix strategy**: Prefer increasing padding (invisible to users) over increasing visual size
- **Classes**: `min-w-6 min-h-6` (24px), `min-w-11 min-h-11` (44px) — Tailwind default spacing scale
- **Do not** change visual design for elements that already feel right — just increase click target via padding

## Implementation Notes

### Audit approach:
The audit test should visit each major route and programmatically measure all interactive elements. Use Playwright's `page.$$eval()` to collect bounding boxes efficiently.

### Key areas likely to need fixes:
- **Tag chips**: `TopicFilter.tsx`, `TagBadgeList.tsx`, `TagEditor.tsx` — small badge-like buttons
- **Table actions**: Any `IconButton` or small action icons in data tables
- **Close buttons**: Dialog/Sheet close buttons (check if shadcn defaults are sufficient — `DialogClose` is usually 24px+)
- **Quiz grids**: `QuestionGrid.tsx` number buttons — verify size

### WCAG 2.5.8 exceptions (no fix needed):
- Inline links within text paragraphs
- Browser-controlled native UI (select dropdowns, date pickers)
- Elements where size is essential to the information conveyed
- Elements conforming via the spacing exception

### Existing patterns:
- shadcn `Button` with `size="icon"` = 36x36px (compliant)
- shadcn `Button` with `size="sm"` = 36px height (compliant)
- Custom icon buttons may lack minimum size constraints

## Testing Notes

- The audit test itself IS the primary testing artifact for this story
- Run on desktop viewport (1280x720) and mobile viewport (375x667) — some elements may only be small on mobile
- Use `page.evaluate()` to get computed styles when bounding box alone is insufficient (e.g., elements with overflow: visible that have larger click targets than visual size)
- Exclude elements with `display: none` or `visibility: hidden`

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

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
