---
story_id: E18-S04
story_name: "Verify Contrast Ratios and Touch Targets"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 18.4: Verify Contrast Ratios and Touch Targets

## Story

As a learner with visual impairments or using a mobile device,
I want sufficient color contrast and large touch targets,
So that I can see and interact with quiz elements easily.

**FRs Fulfilled: QFR44, QFR48**

## Acceptance Criteria

**AC1: Text contrast ratios**
**Given** any text in the quiz interface
**When** measuring contrast against background
**Then** normal text has >=4.5:1 contrast ratio
**And** large text (>=18pt or >=14pt bold) has >=3:1 contrast ratio

**AC2: Non-text element contrast**
**Given** UI components (buttons, inputs, focus indicators)
**When** measuring contrast
**Then** non-text elements have >=3:1 contrast ratio against adjacent colors

**AC3: Touch target sizes**
**Given** interactive elements on mobile
**When** measuring touch target size
**Then** all buttons, links, and form controls are >=44px tall
**And** >=44px wide (or full width on mobile)

**AC4: Focus indicator contrast**
**Given** focus indicators on interactive elements
**When** an element receives keyboard focus
**Then** the focus indicator has >=3:1 contrast against the background
**And** the indicator is at least 2px thick

**AC5: Dark mode contrast compliance**
**Given** dark mode is enabled
**When** viewing quiz components
**Then** all contrast ratios still meet WCAG 2.1 AA minimum requirements
**And** focus indicators remain visible against dark backgrounds

## Tasks / Subtasks

- [ ] Task 1: Audit all quiz components for contrast ratio compliance (AC: 1, 2)
- [ ] Task 2: Fix any text contrast violations found in audit (AC: 1)
- [ ] Task 3: Fix any non-text element contrast violations (AC: 2)
- [ ] Task 4: Audit and fix touch target sizes across all quiz components (AC: 3)
- [ ] Task 5: Verify focus indicator contrast and thickness (AC: 4)
- [ ] Task 6: Audit dark mode contrast compliance (AC: 5)
- [ ] Task 7: Write E2E accessibility tests with axe-core for quiz pages (AC: 1-5)
- [ ] Task 8: Write unit tests for touch target and focus indicator classes (AC: 3, 4)

## Design Guidance

Use the contrast ratios table from the UX specification (lines 615-623) as reference. All colors must use design tokens from `src/styles/theme.css`. Focus indicator and touch target implementation using Tailwind utilities and theme tokens per epic technical details.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Implementation Plan

[docs/plans/e18-s04-verify-contrast-ratios-and-touch-targets.md](../plans/e18-s04-verify-contrast-ratios-and-touch-targets.md)

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
