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
| `src/app/config/__tests__/navigation.test.ts` | New unit test for navigation config structure | ~60 lines |
| `tests/e2e/story-e23-s04.spec.ts` | New E2E test file for this story | ~80 lines |

## Files Verified (No Changes Needed)

| File | Why | Verified |
|------|-----|----------|
| `src/app/components/Layout.tsx` | `SidebarContent` maps over `navigationGroups` generically — works with any group count/structure | Lines 108-131 |
| `src/app/components/navigation/BottomNav.tsx` | Uses `getPrimaryNav()` / `getOverflowNav()` from config — driven by `primaryNavPaths`, not group labels | Lines 6-10 |
| `src/app/components/figma/SearchCommandPalette.tsx` | Maintains its own `navigationPages` list — decoupled from sidebar groups. **Note**: Already uses different labels ("About" for Authors). No change required for this story, though syncing is a future improvement. | Lines 41-114 |
| `tests/e2e/navigation.spec.ts` | Tests route navigation, not group labels — all routes unchanged | Full file |
| `tests/support/helpers/navigation.ts` | Pure navigation helpers by route path — unaffected by group restructuring | Full file |
| `tests/e2e/accessibility-navigation.spec.ts` | Tests `aria-current="page"` on active link — structural change doesn't affect this | Full file |
| `tests/e2e/regression/story-e23-s03.spec.ts` | Tests "Authors" link visibility in nav — verified no reference to "Connect" group label | Full file |
| `src/app/components/__tests__/NavLink.test.tsx` | Tests `getIsActive()` logic — function unchanged, tests unaffected | Full file |

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

### Step 5: Add Unit Tests for Navigation Config (AC1-4)

**File:** `src/app/config/__tests__/navigation.test.ts` (new)

```typescript
import { navigationGroups, getPrimaryNav, getOverflowNav } from '../navigation'

describe('navigationGroups', () => {
  it('has exactly 3 groups: Learn, Review, Track', () => {
    expect(navigationGroups).toHaveLength(3)
    expect(navigationGroups.map(g => g.label)).toEqual(['Learn', 'Review', 'Track'])
  })

  it('Learn group has 5 items in correct order', () => {
    const learn = navigationGroups[0]
    expect(learn.items.map(i => i.name)).toEqual([
      'Overview', 'My Courses', 'Courses', 'Authors', 'Notes',
    ])
  })

  it('Review group has 4 items in correct order', () => {
    const review = navigationGroups[1]
    expect(review.items.map(i => i.name)).toEqual([
      'Learning Path', 'Knowledge Gaps', 'Review', 'Retention',
    ])
  })

  it('Track group has 5 items in correct order', () => {
    const track = navigationGroups[2]
    expect(track.items.map(i => i.name)).toEqual([
      'Challenges', 'Session History', 'Study Analytics', 'Quiz Analytics', 'AI Analytics',
    ])
  })

  it('all items have unique navigation keys (path or path+tab)', () => {
    const allItems = navigationGroups.flatMap(g => g.items)
    const keys = allItems.map(i => i.tab ? `${i.path}?tab=${i.tab}` : i.path)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('no "Connect" group exists', () => {
    const labels = navigationGroups.map(g => g.label)
    expect(labels).not.toContain('Connect')
  })
})

describe('getPrimaryNav', () => {
  it('returns 4 primary items for mobile bottom bar', () => {
    const primary = getPrimaryNav()
    expect(primary.map(i => i.name)).toEqual([
      'Overview', 'My Courses', 'Courses', 'Notes',
    ])
  })
})

describe('getOverflowNav', () => {
  it('returns remaining items including Authors', () => {
    const overflow = getOverflowNav()
    const names = overflow.map(i => i.name)
    expect(names).toContain('Authors')
    expect(names).toContain('Settings')
    expect(names).toContain('Learning Path')
    expect(names).not.toContain('Overview')
  })
})
```

**Why:** The `navigationGroups` config drives 3 UI surfaces (sidebar, collapsed sidebar, mobile bottom bar). A structural unit test prevents accidental reordering in future stories (E23-S05, E25-S08).

### Step 6: Verify Existing Tests Pass

Run all existing test suites to confirm no regressions:
- `npm run test:unit` — all unit tests including new navigation config tests
- Smoke E2E specs: `navigation.spec.ts`, `accessibility-navigation.spec.ts`
- E23 story specs: `story-e23-s02.spec.ts`, `story-e23-s03.spec.ts`
- `NavLink.test.tsx` — `getIsActive()` logic unchanged

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
| Add unit tests for config | Navigation config drives 3 UI surfaces — structural unit test prevents regression in future stories | Skip unit tests — rejected because config is shared state worth protecting |

## Codebase Impact Summary

**Consumers of `navigationGroups` (3 total, all verified):**
1. `Layout.tsx:108-131` — `SidebarContent` iterates groups generically via `.map()`. Handles any group count, renders labels and separators by index. **No change needed.**
2. `BottomNav.tsx:6-10` — Uses `getPrimaryNav()` / `getOverflowNav()` which are driven by `primaryNavPaths`, not group labels. **No change needed.**
3. `navigation.ts:84-88` — `navigationItems` flat list derived from `navigationGroups.flatMap()`. Automatically correct. **No change needed.**

**Consumers of `getIsActive` (2 total, both verified):**
1. `Layout.tsx:38` — `NavLink` component. **No change needed.**
2. `BottomNav.tsx:17,32,78` — Active state highlighting. **No change needed.**

**No existing E2E tests reference:**
- The "Connect" group label (grep confirmed: zero matches)
- Group order or group item counts
- Any selector that would break from group reassignment

**SearchCommandPalette is decoupled** — maintains its own `navigationPages` array (verified at `SearchCommandPalette.tsx:41-114`). Group restructuring does not affect search results.
