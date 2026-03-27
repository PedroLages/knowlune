---
story_id: E30-S01
story_name: "Global Touch Target Sweep — 44px Minimum"
status: done
started: 2026-03-27
completed: 2026-03-27
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, typecheck, format, unit-tests, e2e-tests, design-review, code-review, test-coverage-review]
burn_in_validated: false
---

# Story 30.1: Global Touch Target Sweep — 44px Minimum

## Story

As a mobile user,
I want all interactive elements to meet the 44px minimum touch target,
So that I can tap buttons and links without accidental mis-taps.

## Acceptance Criteria

**Given** sidebar navigation links
**When** rendered on any viewport
**Then** each link has a minimum height of 44px (`min-h-[44px]` or `py-3`)

**Given** tab trigger elements (MyClass tabs, Notes tabs, Settings tabs)
**When** rendered on mobile (< 640px)
**Then** each tab trigger has a minimum height of 44px (`h-11`)

**Given** the header search bar
**When** rendered on any viewport
**Then** the input has a minimum height of 44px (`h-11`)

**Given** icon buttons (sidebar collapse toggle, header icons, settings info tooltips)
**When** rendered on any viewport
**Then** each button has a minimum clickable area of 44x44px (using padding if icon is smaller)

## Tasks / Subtasks

- [ ] Task 1: Fix sidebar navigation link touch targets (AC: 1)
  - [ ] 1.1 Locate sidebar nav links in `Layout.tsx` or sidebar component
  - [ ] 1.2 Add `min-h-[44px]` and appropriate vertical padding to each nav link
  - [ ] 1.3 Verify visual alignment is preserved after height increase
- [ ] Task 2: Fix tab trigger touch targets across all pages (AC: 2)
  - [ ] 2.1 Audit `MyClass.tsx` tab triggers — add `h-11` class
  - [ ] 2.2 Audit Notes page tab triggers — add `h-11` class
  - [ ] 2.3 Audit `Settings.tsx` tab triggers — add `h-11` class
  - [ ] 2.4 Consider applying fix at `TabsTrigger` component level in `src/app/components/ui/tabs.tsx` if all tabs need 44px
- [ ] Task 3: Fix header search bar height (AC: 3)
  - [ ] 3.1 Locate search input in header (likely `Layout.tsx` or a header subcomponent)
  - [ ] 3.2 Change height to `h-11` (44px)
- [ ] Task 4: Fix icon button touch targets (AC: 4)
  - [ ] 4.1 Fix sidebar collapse toggle (currently 24px) — add padding to reach 44x44px clickable area
  - [ ] 4.2 Fix header icon buttons (notification bell, etc.)
  - [ ] 4.3 Fix settings info tooltip triggers (currently 16x16px) — wrap in a 44x44px touch target area
- [ ] Task 5: Full sweep verification
  - [ ] 5.1 Run through all pages on mobile viewport (375px) to catch any remaining undersized targets
  - [ ] 5.2 Verify no layout shifts or visual regressions from size changes

## Implementation Notes

- **WCAG Reference:** WCAG 2.5.5 (Target Size) Level AAA recommends 44x44px; WCAG 2.5.8 (Target Size Minimum) Level AA requires at least 24x24px with sufficient spacing. We target 44px for best mobile UX.
- **Audit Finding:** H10 (3-agent consensus) — highest confidence accessibility finding
- **Affected elements and current sizes:**
  - Sidebar nav links: 40px (need +4px)
  - Tab triggers: 29px (need +15px)
  - Search bar: 36px (need +8px)
  - Collapse toggle: 24px (need +20px padding)
  - Info tooltips: 16x16px (need 44x44px wrapper)
- **Approach:** Global sweep — fix all instances in one pass rather than per-page. Use Tailwind utility classes (`min-h-[44px]`, `h-11`, `p-2.5`) to achieve minimum sizes.
- **For small icons:** Use padding to expand the clickable area without enlarging the visual icon. Pattern: `<button className="p-3"><Icon className="h-4 w-4" /></button>` gives 40px total (p-3 = 12px each side + 16px icon). Use `p-3.5` for exact 44px with 16px icons.

## Testing Notes

- **Visual regression:** Compare before/after screenshots at mobile (375px), tablet (768px), and desktop (1440px) viewports
- **Keyboard navigation:** Verify Tab order and focus visibility are unaffected by size changes
- **Touch testing:** If possible, test on a real mobile device or use Chrome DevTools device emulation with touch simulation
- **E2E tests:** Add assertions checking `min-height` computed style on critical elements:
  ```typescript
  const navLink = page.locator('[data-testid="sidebar-nav-link"]').first();
  const box = await navLink.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  ```
- **Accessibility audit:** Run axe-core after changes to verify no new violations introduced

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

PASS — See [design-review-2026-03-27-e30-s01.md](../reviews/design/design-review-2026-03-27-e30-s01.md)

## Code Review Feedback

PASS (1 LOW fixed: duplicate flex class in TabsList) — See [code-review-2026-03-27-e30-s01.md](../reviews/code/code-review-2026-03-27-e30-s01.md), [code-review-testing-2026-03-27-e30-s01.md](../reviews/code/code-review-testing-2026-03-27-e30-s01.md)

## Challenges and Lessons Learned

- **Component-level fix for tabs**: Applied min-h-[44px] at TabsTrigger/TabsList level rather than per-page — prevents future regressions
- **Bare SVG tooltip trigger**: AIConfigurationSettings had a raw `<Info>` SVG as TooltipTrigger — wrapped in `<button>` for accessibility + touch target
- **Collapse toggle positioning**: Increasing toggle from size-6 to size-11 required adjusting `-right-3` to `-right-5` to maintain visual alignment
