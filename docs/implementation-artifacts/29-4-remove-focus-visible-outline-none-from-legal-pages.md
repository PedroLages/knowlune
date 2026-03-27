---
story_id: E29-S04
story_name: "Remove focus-visible:outline-none from Legal Pages"
status: done
started: 2026-03-27
completed: 2026-03-27
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, typecheck, format, unit-tests, e2e-tests, design-review, code-review, test-coverage-review]
burn_in_validated: false
---

# Story 29.4: Remove focus-visible:outline-none from Legal Pages

## Story

As a keyboard-only user,
I want to see focus indicators on all interactive elements in legal pages,
So that I can navigate the table of contents and cross-page links.

## Acceptance Criteria

**Given** the Privacy Policy page (`/privacy-policy`)
**When** I Tab through the table of contents links
**Then** each link shows a visible focus ring (browser default or custom `ring-2 ring-brand`)
**And** `focus-visible:outline-none` is NOT present on any interactive element

**Given** the Terms of Service page (`/terms-of-service`)
**When** I Tab through both TOC links (line 54) and cross-page links (line 81)
**Then** each link shows a visible focus ring
**And** WCAG 2.4.7 (Focus Visible) is satisfied

## Tasks / Subtasks

- [x] Task 1: Remove focus-visible:outline-none from PrivacyPolicy.tsx (AC: 1)
  - [x] 1.1 Open `PrivacyPolicy.tsx:51`
  - [x] 1.2 Remove `focus-visible:outline-none` from the className string
  - [x] 1.3 Added `ring-2 ring-brand ring-offset-2` for consistent focus ring styling
- [x] Task 2: Remove focus-visible:outline-none from TermsOfService.tsx TOC links (AC: 2)
  - [x] 2.1 Open `TermsOfService.tsx:54`
  - [x] 2.2 Remove `focus-visible:outline-none` from the className string
  - [x] 2.3 Added `ring-2 ring-brand ring-offset-2` for consistent focus ring styling
- [x] Task 3: Remove focus-visible:outline-none from TermsOfService.tsx cross-page links (AC: 2)
  - [x] 3.1 Open `TermsOfService.tsx:81`
  - [x] 3.2 Remove `focus-visible:outline-none` from the className string
  - [x] 3.3 Added `ring-2 ring-brand ring-offset-2` for consistent focus ring styling
- [x] Task 4: Verify focus visibility (AC: 1, 2)
  - [x] 4.1 Tab through Privacy Policy page, verify visible focus rings on all links
  - [x] 4.2 Tab through Terms of Service page, verify visible focus rings on all links
  - [x] 4.3 Verify WCAG 2.4.7 compliance

## Implementation Notes

- **Files:**
  - `PrivacyPolicy.tsx:51` — TOC links with `focus-visible:outline-none`
  - `TermsOfService.tsx:54` — TOC links with `focus-visible:outline-none`
  - `TermsOfService.tsx:81` — cross-page links with `focus-visible:outline-none`
- **Audit finding:** B5 (blocker severity — WCAG 2.4.7 Focus Visible failure)
- **Fix:** Simply remove `focus-visible:outline-none` from those className strings. The browser default focus ring will appear, or add a custom `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` for consistent styling.
- This is a pure CSS class removal — no logic changes needed.

## Testing Notes

- Manual keyboard testing: Tab through both legal pages, verify focus rings appear
- Automated: Consider a simple E2E test that tabs through links and checks for visible focus indicators
- Check both light and dark mode for sufficient contrast on focus rings
- WCAG 2.4.7 requires focus indicators to be visible — verify no other CSS is suppressing them

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [x] All changes committed (`git status` clean)
- [x] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence — state updates after DB write succeeds
- [x] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [x] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [x] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

PASS — zero story-related issues. See [design-review-2026-03-27-e29-s04.md](../reviews/design/design-review-2026-03-27-e29-s04.md).

## Code Review Feedback

PASS — zero story-related issues. See [code-review-2026-03-27-e29-s04.md](../reviews/code/code-review-2026-03-27-e29-s04.md) and [code-review-testing-2026-03-27-e29-s04.md](../reviews/code/code-review-testing-2026-03-27-e29-s04.md).

## Challenges and Lessons Learned

- **Brand focus ring over browser default**: Used `ring-2 ring-brand ring-offset-2` for consistent design system appearance across light/dark modes rather than relying on browser defaults
- **3 occurrences**: PrivacyPolicy had 1, TermsOfService had 2 (TOC links + cross-page links)
