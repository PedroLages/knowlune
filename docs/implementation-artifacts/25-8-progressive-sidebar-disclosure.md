---
story_id: E25-S08
story_name: "Progressive Sidebar Disclosure"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 25.8: Progressive Sidebar Disclosure

## Story

As a new user,
I want the sidebar to show only the navigation items relevant to my current data state,
so that I am not overwhelmed by features I haven't used yet and can focus on the natural next step.

## Acceptance Criteria

**AC1: Minimal sidebar for zero-data users**

**Given** I am a new user with no courses imported, no sessions, no notes, and no challenges
**When** I view the sidebar on desktop
**Then** I see only the "Learn" group with: Overview, Courses
**And** I see Settings at the bottom
**And** the "Connect" and "Track" groups are completely hidden (no group labels, no items)

**AC2: Items appear after first course import**

**Given** I have imported at least one course (importedCourses.count > 0)
**When** the sidebar renders
**Then** "My Courses" and "Notes" appear in the "Learn" group
**And** the items appear without page reload (reactive to store changes)

**AC3: Session-dependent items appear after first study session**

**Given** I have at least one study session recorded (studySessions.count > 0)
**When** the sidebar renders
**Then** "Session History" and "Study Analytics" appear in the "Track" group
**And** the "Track" group label becomes visible

**AC4: Challenge-dependent item appears after first challenge**

**Given** I have at least one challenge created (challenges.count > 0)
**When** the sidebar renders
**Then** "Challenges" appears in the "Track" group

**AC5: Review/Retention items appear after review data exists**

**Given** I have at least one review record (reviewRecords.count > 0)
**When** the sidebar renders
**Then** "Review" and "Retention" appear in the "Learn" group

**AC6: AI feature items appear after AI usage**

**Given** I have at least one AI usage event (aiUsageEvents.count > 0) OR imported courses exist
**When** the sidebar renders
**Then** "Learning Path" and "Knowledge Gaps" appear in the "Learn" group

**AC7: Quiz Analytics appears after first quiz attempt**

**Given** I have at least one quiz attempt (quizAttempts.count > 0)
**When** the sidebar renders
**Then** "Quiz Analytics" appears in the "Track" group

**AC8: Authors section appears after course import**

**Given** I have imported at least one course
**When** the sidebar renders
**Then** the "Connect" group with "Authors" becomes visible

**AC9: Mobile bottom nav respects disclosure rules**

**Given** the progressive disclosure rules are active
**When** I view the app on mobile (< 640px)
**Then** the bottom navigation and "More" drawer only show items that pass their visibility conditions
**And** hidden items are not accessible from the bottom nav

**AC10: Direct URL access still works for hidden items**

**Given** a sidebar item is currently hidden (e.g., "Challenges" with no challenges)
**When** I navigate directly to the URL (e.g., /challenges)
**Then** the page loads normally and shows the appropriate empty state
**And** the route is NOT blocked — progressive disclosure is cosmetic only

**AC11: Transition animation when items appear**

**Given** a previously hidden sidebar item becomes visible (e.g., after first import)
**When** the item appears in the sidebar
**Then** it fades/slides in with a subtle animation (150-200ms)
**And** existing items do not jump abruptly

**AC12: Full sidebar override in Settings**

**Given** I am a power user who wants all navigation items visible
**When** I toggle "Show all navigation items" in Settings
**Then** the sidebar shows all items regardless of data state
**And** this preference persists across sessions (localStorage)

## Tasks / Subtasks

See [implementation plan](plans/e25-s08-progressive-sidebar-disclosure.md).

## Design Guidance

**Layout approach:**
- No structural changes to sidebar — items are conditionally included in the existing `navigationGroups` array
- Groups with zero visible items are hidden entirely (including group label)
- New items fade in via CSS transition (`animate-in fade-in slide-in-from-left-2 duration-200`)

**Component structure:**
- `useNavigationVisibility()` hook — reads Dexie counts + Settings preference, returns filtered `NavigationGroup[]`
- `SidebarContent` updated to use filtered groups instead of static `navigationGroups`
- `BottomNav` updated similarly via `getPrimaryNav()`/`getOverflowNav()` accepting filtered items

**Design system usage:**
- No new design tokens needed
- Uses existing `tw-animate-css` animation utilities
- Group labels remain `text-[10px] font-semibold uppercase tracking-widest text-muted-foreground`

**Responsive strategy:**
- Desktop sidebar: groups with zero items hidden
- Tablet sheet: same filtering
- Mobile bottom nav: primary items filtered, overflow drawer filtered

**Accessibility:**
- Hidden items must not appear in the accessibility tree (not just visually hidden)
- When items appear, no disruptive ARIA announcements (silent appearance)
- `aria-label` on nav doesn't change

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
