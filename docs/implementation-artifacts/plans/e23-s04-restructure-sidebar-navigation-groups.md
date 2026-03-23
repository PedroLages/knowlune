# Plan: E23-S04 — Restructure Sidebar Navigation Groups

## Context

The sidebar navigation currently has 3 groups with an imbalanced structure:
- **Learn** (8 items): Overview, My Courses, Courses, Learning Path, Knowledge Gaps, Notes, Review, Retention
- **Connect** (1 item): Authors
- **Track** (5 items): Challenges, Session History, Study Analytics, Quiz Analytics, AI Analytics

Problems:
1. **"Learn" is overloaded** — 8 items mixes active learning (Courses, Notes) with retention features (Review, Retention) and AI tools (Learning Path, Knowledge Gaps)
2. **"Connect" has a single item** — wasteful as a group; "Connect" implies social features, but Authors is about content creators
3. **Cognitive load** — users must scan 8 items in "Learn" to find retention features buried at the bottom

This story reorganizes into a balanced 5-4-5 structure with semantically meaningful groups.

## Target State

```
Learn (5)               Review (4)                Track (5)
├ Overview              ├ Learning Path           ├ Challenges
├ My Courses            ├ Knowledge Gaps          ├ Session History
├ Courses               ├ Review                  ├ Study Analytics
├ Authors               └ Retention               ├ Quiz Analytics
└ Notes                                           └ AI Analytics
```

**Settings** remains pinned at the bottom, separate from groups (unchanged).

## Files to Modify

| File | Change | Lines |
|------|--------|-------|
| `src/app/config/navigation.ts` | Restructure `navigationGroups` array | ~47-75 |
| `tests/e2e/story-e23-s04.spec.ts` | New E2E test file for this story | ~80 lines |

## Files Verified (No Changes Needed)

| File | Why | Verified |
|------|-----|----------|
| `src/app/components/Layout.tsx` | `SidebarContent` maps over `navigationGroups` generically — works with any group count/structure | Lines 108-131 |
| `src/app/components/navigation/BottomNav.tsx` | Uses `getPrimaryNav()` / `getOverflowNav()` from config — driven by `primaryNavPaths`, not group labels | Lines 6-10 |
| `src/app/components/figma/SearchCommandPalette.tsx` | Maintains its own `navigationPages` list — decoupled from sidebar groups. **Note**: Already uses different labels ("About" for Authors). No change required for this story, though syncing is a future improvement. | Lines 41-114 |
| `tests/e2e/navigation.spec.ts` | Tests route navigation, not group labels — all routes unchanged | Full file |
| `tests/support/helpers/navigation.ts` | Pure navigation helpers by route path — unaffected by group restructuring | Full file |

## Implementation Steps

### Step 1: Update Navigation Config (AC1-4)

**File:** `src/app/config/navigation.ts`

Replace the `navigationGroups` array (lines 47-75) with the new 3-group structure:

```typescript
export const navigationGroups: NavigationGroup[] = [
  {
    label: 'Learn',
    items: [
      { name: 'Overview', path: '/', icon: LayoutDashboard },
      { name: 'My Courses', path: '/my-class', icon: BookOpen },
      { name: 'Courses', path: '/courses', icon: GraduationCap },
      { name: 'Authors', path: '/authors', icon: Users },
      { name: 'Notes', path: '/notes', icon: StickyNote },
    ],
  },
  {
    label: 'Review',
    items: [
      { name: 'Learning Path', path: '/ai-learning-path', icon: Sparkles },
      { name: 'Knowledge Gaps', path: '/knowledge-gaps', icon: Brain },
      { name: 'Review', path: '/review', icon: RotateCcw },
      { name: 'Retention', path: '/retention', icon: ShieldCheck },
    ],
  },
  {
    label: 'Track',
    items: [
      { name: 'Challenges', path: '/challenges', icon: Target },
      { name: 'Session History', path: '/session-history', icon: History },
      { name: 'Study Analytics', path: '/reports', tab: 'study', icon: BarChart3 },
      { name: 'Quiz Analytics', path: '/reports', tab: 'quizzes', icon: ClipboardList },
      { name: 'AI Analytics', path: '/reports', tab: 'ai', icon: BrainCircuit },
    ],
  },
]
```

**Key changes:**
- "Connect" group eliminated entirely
- Authors moved to "Learn" (position 4, between Courses and Notes)
- Learning Path, Knowledge Gaps, Review, Retention extracted to new "Review" group
- "Track" items unchanged (same order)
- No icon imports need adding/removing — all icons already imported

### Step 2: Verify Mobile Bottom Bar (AC5)

**File:** `src/app/config/navigation.ts` (lines 91-101)

The `primaryNavPaths` array is `['/', '/my-class', '/courses', '/notes']` — all 4 items remain in the "Learn" group so no change is needed.

`getOverflowNav()` dynamically filters all items not in `primaryNavPaths` — it will automatically include Authors, all Review items, and all Track items in the overflow drawer.

**Verification only** — run existing E2E navigation tests to confirm.

### Step 3: Verify Collapsed Sidebar Separators (AC6)

**File:** `src/app/components/Layout.tsx` (lines 111-114)

The collapsed sidebar separator logic is:
```tsx
{iconOnly ? (
  idx > 0 && (
    <div className="mx-4 mb-2 border-t border-border/50" aria-hidden="true" />
  )
) : (
```

This renders a separator before groups with index > 0 — it works with any number of groups. With 3 groups, separators appear before "Review" and "Track" — correct behavior.

**Verification only** — no code change needed.

### Step 4: Write E2E Tests

**File:** `tests/e2e/story-e23-s04.spec.ts` (new)

```typescript
test.describe('E23-S04: Restructure Sidebar Navigation Groups', () => {
  // AC1: Three groups exist with correct labels
  test('sidebar shows Learn, Review, Track group labels', async ({ page }) => {
    // Navigate at desktop viewport, assert group labels visible
  })

  // AC2: Learn group contains correct items in order
  test('Learn group contains Overview, My Courses, Courses, Authors, Notes', async ({ page }) => {
    // Assert 5 items in Learn group
  })

  // AC3: Review group contains correct items
  test('Review group contains Learning Path, Knowledge Gaps, Review, Retention', async ({ page }) => {
    // Assert 4 items in Review group
  })

  // AC4: Track group contains correct items
  test('Track group contains Challenges, Session History, and 3 analytics tabs', async ({ page }) => {
    // Assert 5 items in Track group
  })

  // AC5: Mobile overflow drawer works
  test('mobile More drawer shows all non-primary items', async ({ page }) => {
    // Set mobile viewport, open More drawer, verify items
  })

  // AC6: Collapsed sidebar separators align with groups
  test('collapsed sidebar shows separators between groups', async ({ page }) => {
    // Collapse sidebar, verify separator elements
  })

  // AC7: Responsive layout at 3 breakpoints
  test('no layout overflow at mobile, tablet, desktop', async ({ page }) => {
    // Check each viewport for overflow
  })
})
```

**Test strategy:**
- Desktop viewport (1440px) for AC1-4, AC6
- Mobile viewport (375px) for AC5, AC7
- Tablet viewport (768px) for AC7
- Selectors: group labels via text content, items via link names within nav landmark

### Step 5: Verify Existing Tests Pass

Run all existing test suites to confirm no regressions:
- `npm run test:unit` — 2151+ unit tests
- Smoke E2E specs: `navigation.spec.ts`, `overview.spec.ts`, `courses.spec.ts`
- E23 story specs: `story-e23-s01.spec.ts`, `story-e23-s02.spec.ts`, `story-e23-s03.spec.ts`

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| E2E tests break due to selector changes | Low | Medium | Navigation tests use route-based selectors, not group labels |
| SearchCommandPalette inconsistency | None | Low | Already decoupled — uses its own `navigationPages` list |
| Mobile bottom bar breaks | Very Low | Medium | `primaryNavPaths` unchanged; `getOverflowNav()` is dynamic |
| Accessibility regression | Very Low | Medium | Group labels rendered as text divs, not ARIA landmarks — structure unchanged |

## Complexity Estimate

**Low** (1-2 hours) — The change is concentrated in a single config file. The Layout and BottomNav components consume the config generically and require no modification. The primary work is in writing E2E tests.

## Decision Log

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| Authors in "Learn" not "Track" | Authors are content creators browsed alongside courses — fits the "content access" mental model | "Track" — rejected because tracking is about progress/analytics, not content |
| "Review" label (not "Retain" or "Deepen") | "Review" is the clearest action verb matching what users do: review flashcards, review knowledge gaps, check retention | "Retain" — too passive; "Deepen" — too vague |
| Keep Search palette decoupled | SearchCommandPalette has its own navigation list with different labels (e.g., "About" vs "Authors"). Syncing is out of scope for this story. | Refactor to import from navigation config — too large a scope |
| No route changes | All routes stay the same (`/authors`, `/review`, `/retention`, etc.). Only group assignment and labels change. | Moving routes — unnecessary complexity |
