---
story_id: E29-S04
story_name: "Remove focus-visible:outline-none from Legal Pages"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
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

- [ ] Task 1: Remove focus-visible:outline-none from PrivacyPolicy.tsx (AC: 1)
  - [ ] 1.1 Open `PrivacyPolicy.tsx:51`
  - [ ] 1.2 Remove `focus-visible:outline-none` from the className string
  - [ ] 1.3 Optionally add `focus-visible:ring-2 focus-visible:ring-brand` if no default focus ring is present
- [ ] Task 2: Remove focus-visible:outline-none from TermsOfService.tsx TOC links (AC: 2)
  - [ ] 2.1 Open `TermsOfService.tsx:54`
  - [ ] 2.2 Remove `focus-visible:outline-none` from the className string
  - [ ] 2.3 Optionally add custom focus ring styling
- [ ] Task 3: Remove focus-visible:outline-none from TermsOfService.tsx cross-page links (AC: 2)
  - [ ] 3.1 Open `TermsOfService.tsx:81`
  - [ ] 3.2 Remove `focus-visible:outline-none` from the className string
  - [ ] 3.3 Optionally add custom focus ring styling
- [ ] Task 4: Verify focus visibility (AC: 1, 2)
  - [ ] 4.1 Tab through Privacy Policy page, verify visible focus rings on all links
  - [ ] 4.2 Tab through Terms of Service page, verify visible focus rings on all links
  - [ ] 4.3 Verify WCAG 2.4.7 compliance

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

- **Brand focus ring over browser default**: Used `ring-2 ring-brand ring-offset-2` for consistent design system appearance across light/dark modes rather than relying on browser defaults
- **3 occurrences**: PrivacyPolicy had 1, TermsOfService had 2 (TOC links + cross-page links)
