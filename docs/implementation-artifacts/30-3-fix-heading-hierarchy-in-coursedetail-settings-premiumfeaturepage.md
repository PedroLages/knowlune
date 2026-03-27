---
story_id: E30-S03
story_name: "Fix Heading Hierarchy in CourseDetail, Settings, PremiumFeaturePage"
status: done
started: 2026-03-27
completed: 2026-03-27
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, typecheck, format, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
burn_in_validated: false
---

# Story 30.3: Fix Heading Hierarchy in CourseDetail, Settings, PremiumFeaturePage

## Story

As a screen reader user,
I want headings to follow a logical hierarchy (H1 → H2 → H3),
So that I can navigate the page structure without confusion.

## Acceptance Criteria

**Given** the CourseDetail page
**When** the sidebar renders card titles
**Then** headings follow H1 → H2 → H3 order (no H1 → H3 → H2 skip)

**Given** the Settings page Account section
**When** the card renders
**Then** the card title uses `<h2>` (not `<h3>` which creates an H1 → H3 skip)

**Given** any of the 7 PremiumFeaturePage routes
**When** the page renders
**Then** the first heading is `<h1>` (not `<h2>`)
**And** subsequent headings follow sequential order

## Tasks / Subtasks

- [ ] Task 1: Fix CourseDetail heading hierarchy (AC: 1)
  - [ ] 1.1 Open `CourseDetail.tsx` and examine heading levels around line 148
  - [ ] 1.2 Map current heading hierarchy: identify where H1 → H3 skip occurs
  - [ ] 1.3 Fix sidebar card titles to use `<h2>` instead of `<h3>` (or adjust parent heading level)
  - [ ] 1.4 Verify sequential order: H1 (page title) → H2 (section titles) → H3 (subsection titles)
- [ ] Task 2: Fix Settings page Account card heading (AC: 2)
  - [ ] 2.1 Open `Settings.tsx` and examine heading at/near line 491
  - [ ] 2.2 Change Account `<CardTitle>` from rendering `<h3>` to `<h2>`
  - [ ] 2.3 Check if `<CardTitle>` component supports an `asChild` or `as` prop for heading level override
  - [ ] 2.4 If not, render heading directly: `<CardTitle><h2 className="...">Account</h2></CardTitle>` or modify CardTitle component
- [ ] Task 3: Fix PremiumFeaturePage first heading (AC: 3)
  - [ ] 3.1 Open `PremiumFeaturePage.tsx` and examine heading at/near line 211
  - [ ] 3.2 Change first heading from `<h2>` to `<h1>`
  - [ ] 3.3 Verify all 7 PremiumFeaturePage routes render correctly with the fix
  - [ ] 3.4 Ensure subsequent headings on the page follow sequential order (H1 → H2 → H3)
- [ ] Task 4: Global heading hierarchy audit
  - [ ] 4.1 Run axe-core or a heading-level linter across all pages to catch any other skips
  - [ ] 4.2 Document any additional findings for future stories

## Implementation Notes

- **WCAG Reference:** WCAG 1.3.1 (Info and Relationships), WCAG 2.4.6 (Headings and Labels) — headings must convey document structure
- **Audit Findings:** H12 (`CourseDetail.tsx:148`), H13 (`Settings.tsx:491`), H14 (`PremiumFeaturePage.tsx:211`)
- **Root cause:** The `<CardTitle>` component (from shadcn/ui) renders as `<h3>` by default. When used inside a page that has an `<h1>` but no `<h2>`, it creates an H1 → H3 skip.
- **Fix approaches:**
  1. **Preferred:** If `CardTitle` supports a prop to change heading level (check `src/app/components/ui/card.tsx`), use `<CardTitle as="h2">` or similar
  2. **Alternative:** Wrap the text in the correct heading tag inside CardTitle: `<CardTitle><h2 className="text-lg font-semibold">Title</h2></CardTitle>` — but beware of nested heading semantics
  3. **Component-level fix:** Modify `CardTitle` to accept a `level` prop that maps to h1-h6
- **Heading level rules:**
  - Each page should have exactly one `<h1>`
  - Heading levels must not skip (H1 → H2 → H3, never H1 → H3)
  - Heading levels can go back up (H3 → H2 is valid for a new section)

## Testing Notes

- **Screen reader verification:** Use VoiceOver rotor (Ctrl+Option+U → Headings) to inspect heading hierarchy on each affected page
- **Automated audit:** Run axe-core to check for "Heading levels should only increase by one" violations
- **E2E assertions:**
  ```typescript
  // Verify heading hierarchy on CourseDetail
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
  // Verify no level skips in the sequence
  ```
- **Visual regression:** Verify heading style changes don't alter visual appearance (font size, weight should remain the same via className overrides)
- **Coverage:** Test all 7 PremiumFeaturePage routes to ensure the fix applies universally

## Pre-Review Checklist

Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

- **Settings.tsx was already correct:** The audit cited line 491 as having an H3 skip, but the current code already uses raw `<h2>` tags instead of `<CardTitle>`. The fix was likely applied in a prior commit or the audit was based on an older snapshot. No changes needed.
- **CardTitle `as` prop added for future-proofing:** Rather than just fixing the immediate instances, added an `as` prop to the `CardTitle` component so any future use can specify the correct heading level. Default remains `h3` for backward compatibility.
- **Heading hierarchy rules recap:** H1->H2->H3 must be sequential (no skips), but going back up (H3->H2) is valid when starting a new section at a higher level.
