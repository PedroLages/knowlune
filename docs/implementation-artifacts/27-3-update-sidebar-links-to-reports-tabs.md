---
story_id: E27-S03
story_name: "Update Sidebar Links To Reports Tabs"
status: in-progress
started: 2026-03-22
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 27.3: Update Sidebar Links To Reports Tabs

## Story

As a learner,
I want the sidebar navigation to link directly to specific Reports tabs,
so that I can jump to the analytics view I need (study, quiz, or AI) in one click.

## Acceptance Criteria

**Given** the Reports page has URL-aware tabs (`?tab=study`, `?tab=quizzes`, `?tab=ai`)
**When** I look at the sidebar "Track" group
**Then** I see navigation items that link to specific Reports tabs (not just `/reports`)

**Given** I click a tab-specific Reports link in the sidebar
**When** the page navigates
**Then** the Reports page opens with the correct tab pre-selected based on the URL query param

**Given** I am on `/reports?tab=study`
**When** I look at the sidebar
**Then** the "Study Analytics" (or equivalent) sidebar item appears active (highlighted)
**And** other Reports tab items appear inactive

**Given** I am on `/reports?tab=quizzes`
**When** I look at the sidebar
**Then** the "Quiz Analytics" (or equivalent) sidebar item appears active
**And** other Reports tab items appear inactive

**Given** I am on `/reports?tab=ai`
**When** I look at the sidebar
**Then** the "AI Analytics" (or equivalent) sidebar item appears active
**And** other Reports tab items appear inactive

**Given** I navigate to `/reports` with no tab param
**When** the page loads (defaults to `study` tab)
**Then** the "Study Analytics" sidebar item appears active (since it is the default)

**Given** the sidebar is collapsed (icon-only mode)
**When** I hover over a Reports tab icon
**Then** a tooltip shows the correct tab name

## Tasks / Subtasks

- [ ] Task 1: Extend NavigationItem interface with optional tab param support (AC: tab-specific links)
  - [ ] 1.1 Add optional `tab?: string` field to `NavigationItem` in `src/app/config/navigation.ts`
  - [ ] 1.2 Replace single "Reports" item with three tab-specific items: Study Analytics, Quiz Analytics, AI Analytics

- [ ] Task 2: Update NavLink active state detection for tab-aware links (AC: correct active highlighting)
  - [ ] 2.1 Update `isActive` logic in `NavLink` (`src/app/components/Layout.tsx:38-39`) to check `location.search` when `item.tab` is set
  - [ ] 2.2 Update `<Link to={item.path}>` to include `?tab=${item.tab}` when `item.tab` is set
  - [ ] 2.3 Update BottomNav and `getPrimaryNav()` / `getOverflowNav()` if tab-linked items need mobile handling

- [ ] Task 3: Update SearchCommandPalette entries for tab-specific Reports (AC: search still works)
  - [ ] 3.1 Update `src/app/components/figma/SearchCommandPalette.tsx` to have tab-specific entries for each Reports tab

- [ ] Task 4: Unit tests (AC: isActive logic, navigation config)
  - [ ] 4.1 NavLink renders `href="/reports?tab=study"` when item has `tab: "study"`
  - [ ] 4.2 NavLink is active when pathname is `/reports` and search is `?tab=study`
  - [ ] 4.3 NavLink is inactive when pathname is `/reports` and search is `?tab=quizzes`
  - [ ] 4.4 Default tab (`/reports` with no search) activates the "study" item

- [ ] Task 5: E2E tests (`tests/e2e/regression/story-e27-s03.spec.ts`)
  - [ ] 5.1 Clicking "Study Analytics" link → navigates to `/reports?tab=study` with Study tab active
  - [ ] 5.2 Clicking "Quiz Analytics" link → navigates to `/reports?tab=quizzes` with Quizzes tab active
  - [ ] 5.3 Sidebar active state correct on each Reports tab URL
  - [ ] 5.4 Collapsed sidebar tooltip shows correct tab names

## Design Guidance

**Layout**: No layout changes. The sidebar Track group currently shows "Challenges", "Session History", "Reports" — replace "Reports" with three sub-items or keep one "Reports" item with updated logic. Prefer three explicit items for clarity.

**Icons for the three entries:**
- Study Analytics → `BarChart3` (current Reports icon)
- Quiz Analytics → `Trophy` or `ClipboardCheck`
- AI Analytics → `Sparkles` (already used for Learning Path)

**Consider icon collision**: If `Sparkles` is already used for "Learning Path", use `BrainCircuit` or `Bot` for AI Analytics. Pick from Lucide icons already imported in the codebase.

**Active state**: The active strip (`bg-brand-soft text-brand-soft-foreground`) should only appear on the specific tab item matching the current URL (pathname + search param). Other Reports tab items should show inactive state.

**Accessibility**: Each link's tooltip in collapsed mode must reflect the specific tab name, not just "Reports".

## Implementation Notes

**Dependency**: This story requires E27-S01 (`Reports.tsx` reading `?tab=` via `useSearchParams`) and E27-S02 (route redirects) to be completed first. The navigation config changes here are inert without URL-aware tabs.

**Pattern reference**: `Notes.tsx:106-107` shows `useSearchParams()` for tab-param reading. The same `?tab=` approach will be used in Reports after E27-S01.

**NavLink active detection change**: Current logic (`src/app/components/Layout.tsx:38-39`):
```typescript
const isActive =
  item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
```
New logic when `item.tab` is set:
```typescript
const isActive = item.tab
  ? location.pathname === item.path && location.search === `?tab=${item.tab}`
  : item.path === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(item.path)
```

**Default tab fallback**: When the user navigates to `/reports` with no `?tab=` param, the Reports page defaults to `study`. The "Study Analytics" sidebar item should be active in this case too. Handle this by also activating "study" when `location.search === ''` and `location.pathname === '/reports'`.

**Plan**: [docs/implementation-artifacts/plans/e27-s03-update-sidebar-links-to-reports-tabs.md](plans/e27-s03-update-sidebar-links-to-reports-tabs.md)

## Testing Notes

E2E tests depend on E27-S01 completing first (tabs must be URL-aware). Unit tests for `NavLink` active logic can be written independently using mock router values.

Use `data-testid="nav-study-analytics"` etc. for selector stability in E2E.

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

Pending implementation.

## Code Review Feedback

Pending implementation.

## Web Design Guidelines Review

Pending implementation.

## Challenges and Lessons Learned

**Planning phase observations:**

- E27-S03 depends on E27-S01 (URL-aware tabs in Reports.tsx) and E27-S02 (route redirects). The navigation changes here are meaningful only once those tabs respond to `?tab=` query params.
- The `NavLink` `isActive` logic currently uses `startsWith` for path matching — this is correct for most routes but fails when the same path (`/reports`) needs to differentiate multiple tab-linked items. Adding `tab`-aware matching is the correct extension without breaking existing behavior.
- Three separate sidebar items (Study Analytics, Quiz Analytics, AI Analytics) are cleaner UX than one "Reports" item, because each click takes the user directly to their desired view — no need to remember which tab has what data.
- Icon reuse risk: `Sparkles` is used for "Learning Path". Pick a different icon for "AI Analytics" (e.g., `BrainCircuit`, `Bot`, `Cpu`) to avoid visual confusion.
