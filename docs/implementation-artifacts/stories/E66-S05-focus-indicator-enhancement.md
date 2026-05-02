---
story_id: E66-S05
story_name: "Focus Indicator Enhancement and Compliance Audit"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 66.5: Focus Indicator Enhancement and Compliance Audit (WCAG 2.4.13 AAA)

## Story

As a low-vision or keyboard-only user,
I want focus indicators to be clearly visible with sufficient contrast,
so that I can always see which element has keyboard focus.

## Acceptance Criteria

**Given** the global focus style is `outline: 2px solid var(--brand)`
**When** I measure the contrast ratio between the outline and adjacent backgrounds
**Then** the contrast ratio is at least 3:1 in both light and dark themes

**Given** I tab through all interactive elements on the Overview page
**When** each element receives focus
**Then** the focus indicator is at least as large as a 2px perimeter of the element
**And** the indicator is visible against the element's background

**Given** shadcn/ui components that override focus styles (e.g., Dialog trigger, Dropdown items)
**When** they receive keyboard focus
**Then** their custom focus indicators also meet the 3:1 contrast and 2px perimeter requirements

**Given** custom interactive components (custom buttons, card links, toggle switches)
**When** they receive keyboard focus
**Then** their focus indicators are consistent with the global style

**Given** I run an automated focus indicator audit across all pages
**When** the audit completes
**Then** a report lists any elements with non-compliant focus indicators
**And** all listed elements are fixed

**Given** the focus indicator meets requirements
**When** it is displayed on both light background (`bg-background`) and dark background (`bg-card`)
**Then** the 3:1 contrast ratio is maintained on both

## Tasks / Subtasks

- [ ] Task 1: Measure current focus indicator contrast (AC: 1, 6)
  - [ ] 1.1 Read `src/styles/theme.css` — extract `--ring` values for light and dark themes
  - [ ] 1.2 Light theme `--ring`: `oklch(0.708 0 0)` — convert to hex, measure contrast against `--background`, `--card`, `--muted`, `--accent`
  - [ ] 1.3 Dark theme `--ring`: `oklch(0.45 0.05 270)` — same contrast measurements
  - [ ] 1.4 Document all contrast ratios in a table
  - [ ] 1.5 Identify any background where contrast < 3:1

- [ ] Task 2: Fix insufficient contrast (AC: 1, 6)
  - [ ] 2.1 If `--ring` fails 3:1 on any background, consider adding a dedicated `--focus-ring` token
  - [ ] 2.2 Option A: Adjust `--ring` value to pass 3:1 on all backgrounds (may affect other ring usages)
  - [ ] 2.3 Option B: Add `--focus-ring` token separate from `--ring`, update global `focus-visible` styles
  - [ ] 2.4 If creating new token, add to both light and dark sections of `theme.css`
  - [ ] 2.5 Update `tailwind.css` if needed to map `--focus-ring` to a Tailwind utility

- [ ] Task 3: Audit shadcn/ui component focus overrides (AC: 3)
  - [ ] 3.1 Search for `focus-visible` and `focus:` in `src/app/components/ui/` files
  - [ ] 3.2 Catalog components with custom focus styles that differ from global
  - [ ] 3.3 Key components to check: `button.tsx`, `input.tsx`, `select.tsx`, `checkbox.tsx`, `switch.tsx`, `radio-group.tsx`, `tabs.tsx`, `accordion.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`, `navigation-menu.tsx`
  - [ ] 3.4 For each override, verify 3:1 contrast and 2px perimeter
  - [ ] 3.5 Fix any non-compliant overrides

- [ ] Task 4: Audit custom component focus styles (AC: 4)
  - [ ] 4.1 Check `src/app/components/figma/` for components with custom focus styles
  - [ ] 4.2 Check page components for inline focus overrides
  - [ ] 4.3 Verify `.focus-ring-enhanced` styles in `src/styles/animations.css` (lines ~208-214) meet requirements
  - [ ] 4.4 Ensure consistency with global focus style

- [ ] Task 5: Create automated focus indicator audit test (AC: 5)
  - [ ] 5.1 Create `tests/audit/focus-indicators.spec.ts`
  - [ ] 5.2 For each major page, tab through interactive elements
  - [ ] 5.3 After each focus, capture the focused element's computed `outline` style
  - [ ] 5.4 Verify: outline width >= 2px, outline style is solid, outline color has 3:1 contrast against parent background
  - [ ] 5.5 Report non-compliant elements with page, selector, computed outline, and measured contrast
  - [ ] 5.6 Test on both light and dark themes

- [ ] Task 6: Verify Overview page focus indicators (AC: 2)
  - [ ] 6.1 Tab through all interactive elements on Overview page in E2E test
  - [ ] 6.2 Take screenshot of each focused state for visual verification
  - [ ] 6.3 Confirm consistent 2px outline on all elements

## Design Guidance

- **WCAG 2.4.13 (AAA)**: Focus indicator must be at least as large as the area of a 2px perimeter of the component, with 3:1 contrast ratio between focused and unfocused states
- **Current ring token**: `--ring` is used for focus indicators globally
- **Existing enhanced style**: `.focus-ring-enhanced` in `animations.css` adds `0 0 0 3px` box-shadow — may already exceed requirements
- **Color considerations**: The focus ring color must work against ALL possible backgrounds: `--background` (warm off-white), `--card`, `--muted`, `--accent`, `--brand-soft`
- **Do not** use `outline: none` or `outline: 0` anywhere — only override with a visible alternative

## Implementation Notes

### Current theme values (from `theme.css`):
- Light `--ring`: `oklch(0.708 0 0)` — a medium gray
- Dark `--ring`: `oklch(0.45 0.05 270)` — a dark purple-tinted gray
- These are used by shadcn/ui via `ring-ring` utility class

### Focus indicator patterns in Knowlune:
1. **Global**: Most elements use `focus-visible:ring-2 ring-ring ring-offset-2` (shadcn default)
2. **Enhanced**: `.focus-ring-enhanced:focus-visible` adds `box-shadow: 0 0 0 3px var(--brand-soft)`
3. **Overrides**: Some components use `focus-visible:outline-none` then custom ring styles

### Contrast calculation approach:
Use WCAG relative luminance formula. For OKLCH colors, convert to sRGB first.
Can also use online tools: https://webaim.org/resources/contrastchecker/

### If `--ring` needs to change:
- Changing `--ring` affects ALL components using `ring-ring`
- A dedicated `--focus-ring` token is safer — only affects focus indicators
- Map in tailwind: `@theme { --color-focus-ring: var(--focus-ring) }`
- Update global focus style: `focus-visible:ring-focus-ring`

### Known areas of concern:
- Dark theme: `--ring` at `oklch(0.45 ...)` against `--card` background may be low contrast
- Components using `outline-none` without visible replacement
- Dropdown menu items that use `bg-accent` on focus instead of outline

## Testing Notes

- Contrast testing in E2E: use `page.evaluate()` to compute colors and calculate contrast ratio programmatically
- Test both themes by toggling dark mode class on `<html>`
- Visual regression screenshots are useful for design review but not sufficient alone — programmatic contrast check is required
- Some elements may use `box-shadow` instead of `outline` for focus — audit should check both properties

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
