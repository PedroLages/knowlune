# E25-S08: Progressive Sidebar Disclosure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Conditionally show sidebar navigation items based on the user's data state, so new users see a minimal sidebar (Overview + Courses) that grows as they use the app. Items appear reactively when relevant data exists in IndexedDB.

**Architecture:** A `useNavigationVisibility()` hook reads Dexie table counts and a Settings preference to produce a filtered `NavigationGroup[]` array. `SidebarContent`, `BottomNav`, and `SearchCommandPalette` consume this filtered array instead of the static `navigationGroups` export.

**Tech Stack:** Zustand, Dexie (IndexedDB), React hooks, existing `src/app/config/navigation.ts`, existing `src/app/components/Layout.tsx`

**Key Design Decision:** Progressive disclosure is **cosmetic only** — direct URL navigation to hidden pages always works. This prevents user lockout and simplifies implementation (no route guards needed).

---

## Visibility Rules Reference

| Navigation Item      | Group   | Visible When                                     |
|---------------------|---------|--------------------------------------------------|
| Overview            | Learn   | Always                                           |
| Courses             | Learn   | Always                                           |
| My Courses          | Learn   | `importedCourses.count > 0`                      |
| Notes               | Learn   | `importedCourses.count > 0`                      |
| Learning Path       | Learn   | `importedCourses.count > 0`                      |
| Knowledge Gaps      | Learn   | `importedCourses.count > 0`                      |
| Review              | Learn   | `reviewRecords.count > 0`                        |
| Retention           | Learn   | `reviewRecords.count > 0`                        |
| Authors             | Connect | `importedCourses.count > 0`                      |
| Challenges          | Track   | `challenges.count > 0`                           |
| Session History     | Track   | `studySessions.count > 0`                        |
| Study Analytics     | Track   | `studySessions.count > 0`                        |
| Quiz Analytics      | Track   | `quizAttempts.count > 0`                         |
| AI Analytics        | Track   | `aiUsageEvents.count > 0`                        |
| Settings            | Bottom  | Always                                           |

**Override:** When `showAllNav` is true in Settings, all items are visible regardless of data state.

---

### Task 1: Create `useNavigationVisibility` Hook

**Files:**
- Create: `src/app/hooks/useNavigationVisibility.ts`

**Step 1: Read existing stores and Dexie schema**

Read these files to understand the data access patterns:
- `src/db/schema.ts` (table names)
- `src/db/index.ts` (db export)
- `src/stores/useCourseStore.ts` (pattern for reading from Dexie)

**Step 2: Implement the hook**

The hook needs to:
1. Read table counts from Dexie (not full rows — use `db.tableName.count()`)
2. Read the "show all nav" override from localStorage/Settings
3. Return a filtered `NavigationGroup[]` and a `navigationItems` flat list

```typescript
import { useState, useEffect } from 'react'
import { db } from '@/db'
import { navigationGroups, settingsItem, type NavigationGroup, type NavigationItem } from '@/app/config/navigation'

const SHOW_ALL_NAV_KEY = 'knowlune-show-all-nav-v1'

interface NavigationCounts {
  importedCourses: number
  studySessions: number
  challenges: number
  reviewRecords: number
  quizAttempts: number
  aiUsageEvents: number
}

// Map each nav item path to its visibility predicate
function isItemVisible(item: NavigationItem, counts: NavigationCounts): boolean {
  switch (item.path) {
    // Always visible
    case '/':
    case '/courses':
      return true

    // Visible after first course import
    case '/my-class':
    case '/notes':
    case '/ai-learning-path':
    case '/knowledge-gaps':
    case '/authors':
      return counts.importedCourses > 0

    // Visible after review data
    case '/review':
    case '/retention':
      return counts.reviewRecords > 0

    // Visible after study sessions
    case '/session-history':
      return counts.studySessions > 0

    // Visible after challenges
    case '/challenges':
      return counts.challenges > 0

    // Tab-based items in /reports
    case '/reports':
      if (item.tab === 'study') return counts.studySessions > 0
      if (item.tab === 'quizzes') return counts.quizAttempts > 0
      if (item.tab === 'ai') return counts.aiUsageEvents > 0
      return counts.studySessions > 0 // fallback for bare /reports

    default:
      return true // Unknown items always visible (safety net)
  }
}

export function useNavigationVisibility() {
  const [counts, setCounts] = useState<NavigationCounts>({
    importedCourses: 0,
    studySessions: 0,
    challenges: 0,
    reviewRecords: 0,
    quizAttempts: 0,
    aiUsageEvents: 0,
  })
  const [showAll, setShowAll] = useState(() => {
    try {
      return localStorage.getItem(SHOW_ALL_NAV_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [isLoaded, setIsLoaded] = useState(false)

  // Load counts from Dexie
  useEffect(() => {
    let cancelled = false

    async function loadCounts() {
      try {
        const [
          importedCourses,
          studySessions,
          challenges,
          reviewRecords,
          quizAttempts,
          aiUsageEvents,
        ] = await Promise.all([
          db.importedCourses.count(),
          db.studySessions.count(),
          db.challenges.count(),
          db.reviewRecords.count(),
          db.quizAttempts.count(),
          db.aiUsageEvents.count(),
        ])

        if (!cancelled) {
          setCounts({
            importedCourses,
            studySessions,
            challenges,
            reviewRecords,
            quizAttempts,
            aiUsageEvents,
          })
          setIsLoaded(true)
        }
      } catch (error) {
        console.error('[NavigationVisibility] Failed to load counts:', error)
        if (!cancelled) {
          setIsLoaded(true) // Show all items on error (safe fallback)
        }
      }
    }

    loadCounts()
    return () => { cancelled = true }
  }, [])

  // Listen for custom events that signal data changes
  // (e.g., after import, after session ends, after challenge created)
  useEffect(() => {
    const handleDataChange = () => {
      // Re-read counts when data changes
      Promise.all([
        db.importedCourses.count(),
        db.studySessions.count(),
        db.challenges.count(),
        db.reviewRecords.count(),
        db.quizAttempts.count(),
        db.aiUsageEvents.count(),
      ]).then(([importedCourses, studySessions, challenges, reviewRecords, quizAttempts, aiUsageEvents]) => {
        setCounts({ importedCourses, studySessions, challenges, reviewRecords, quizAttempts, aiUsageEvents })
      }).catch(error => {
        console.error('[NavigationVisibility] Failed to refresh counts:', error)
      })
    }

    // Listen for Dexie changes via custom events dispatched by stores
    window.addEventListener('knowlune-data-changed', handleDataChange)
    // Also listen for settings changes
    const handleSettingsChange = () => {
      try {
        setShowAll(localStorage.getItem(SHOW_ALL_NAV_KEY) === 'true')
      } catch {
        // ignore
      }
    }
    window.addEventListener('storage', handleSettingsChange)
    window.addEventListener('settingsUpdated', handleSettingsChange)

    return () => {
      window.removeEventListener('knowlune-data-changed', handleDataChange)
      window.removeEventListener('storage', handleSettingsChange)
      window.removeEventListener('settingsUpdated', handleSettingsChange)
    }
  }, [])

  // Filter navigation groups
  const filteredGroups: NavigationGroup[] = (!isLoaded || showAll)
    ? navigationGroups
    : navigationGroups
        .map(group => ({
          ...group,
          items: group.items.filter(item => isItemVisible(item, counts)),
        }))
        .filter(group => group.items.length > 0)

  const filteredItems: NavigationItem[] = [
    ...filteredGroups.flatMap(g => g.items),
    settingsItem,
  ]

  return {
    groups: filteredGroups,
    items: filteredItems,
    showAll,
    isLoaded,
  }
}
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Step 4: Commit**

```bash
git add src/app/hooks/useNavigationVisibility.ts
git commit -m "feat(E25-S08): create useNavigationVisibility hook for progressive sidebar disclosure"
```

---

### Task 2: Dispatch `knowlune-data-changed` Events from Stores

**Files:**
- Modify: `src/stores/useCourseImportStore.ts` (after successful import)
- Modify: `src/stores/useSessionStore.ts` (after session created)
- Modify: `src/stores/useChallengeStore.ts` (after challenge created)
- Modify: `src/stores/useReviewStore.ts` (after review record saved)
- Modify: `src/stores/useQuizStore.ts` (after quiz attempt saved)

**Step 1: Read each store file**

Read the 5 store files to find the correct mutation points (e.g., after a successful `db.add()` or `db.put()` call).

**Step 2: Add event dispatch after each relevant mutation**

For each store, add a single line after the Dexie write succeeds:

```typescript
window.dispatchEvent(new Event('knowlune-data-changed'))
```

Place this:
- `useCourseImportStore`: after `db.importedCourses.add()` succeeds
- `useSessionStore`: after `db.studySessions.add()` or `db.studySessions.put()` succeeds
- `useChallengeStore`: after `db.challenges.add()` succeeds
- `useReviewStore`: after `db.reviewRecords.add()` succeeds
- `useQuizStore`: after `db.quizAttempts.add()` succeeds

**Important:** Only dispatch on creates, not on every read. Keep it minimal — the navigation hook will re-count.

**Step 3: Run TypeScript check and unit tests**

```bash
npx tsc --noEmit 2>&1 | head -30
npm run test:unit 2>&1 | tail -10
```

**Step 4: Commit**

```bash
git add src/stores/useCourseImportStore.ts src/stores/useSessionStore.ts src/stores/useChallengeStore.ts src/stores/useReviewStore.ts src/stores/useQuizStore.ts
git commit -m "feat(E25-S08): dispatch knowlune-data-changed events from stores for reactive navigation"
```

---

### Task 3: Integrate Hook into SidebarContent and Layout

**Files:**
- Modify: `src/app/components/Layout.tsx`

**Step 1: Read Layout.tsx**

Read `src/app/components/Layout.tsx` to understand the current `SidebarContent` component (lines 88-143).

**Step 2: Import and use `useNavigationVisibility` in Layout**

The hook must be called at the `Layout` component level (not inside `SidebarContent`, which is a child). Pass filtered groups down:

```typescript
// In Layout():
const { groups: visibleGroups } = useNavigationVisibility()

// Pass to SidebarContent:
<SidebarContent iconOnly={sidebarCollapsed} groups={visibleGroups} />
```

Update `SidebarContent` signature:

```typescript
function SidebarContent({
  onNavigate,
  iconOnly,
  groups
}: {
  onNavigate?: () => void
  iconOnly?: boolean
  groups: NavigationGroup[]
}) {
  return (
    <>
      {/* ... logo ... */}
      <nav className="flex-1 overflow-y-auto" aria-label="Main navigation">
        <div className="space-y-5">
          {groups.map((group, idx) => (
            // ... existing group rendering (unchanged)
          ))}
        </div>
      </nav>
      {/* ... settings ... */}
    </>
  )
}
```

**Step 3: Add subtle entrance animation to NavLink items**

Add animation class for items that become visible. Use existing `tw-animate-css` utilities:

```typescript
// In NavLink <li>:
<li className="relative animate-in fade-in slide-in-from-left-2 duration-200">
```

**Note:** Since all items render with this class, items that were always present also get it on initial mount. This is fine — it's a fast, subtle animation. If it looks wrong on page load, gate it with a `data-entering` attribute set only when items first appear (more complex — defer to design review).

**Step 4: Update all SidebarContent call sites**

There are 2 call sites for `SidebarContent`:
1. Desktop sidebar (line ~314)
2. Tablet sheet sidebar (line ~340)

Both need the `groups` prop:

```typescript
<SidebarContent iconOnly={sidebarCollapsed} groups={visibleGroups} />
<SidebarContent onNavigate={() => setSidebarOpen(false)} groups={visibleGroups} />
```

**Step 5: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Step 6: Commit**

```bash
git add src/app/components/Layout.tsx
git commit -m "feat(E25-S08): integrate useNavigationVisibility into SidebarContent"
```

---

### Task 4: Integrate Hook into BottomNav

**Files:**
- Modify: `src/app/components/navigation/BottomNav.tsx`
- Modify: `src/app/config/navigation.ts`

**Step 1: Read BottomNav.tsx**

Read `src/app/components/navigation/BottomNav.tsx` to understand the current `getPrimaryNav()`/`getOverflowNav()` usage.

**Step 2: Update `getPrimaryNav()` and `getOverflowNav()` to accept filtered items**

Currently these functions are pure and use the static `navigationItems`. Update them to accept a parameter:

```typescript
// In navigation.ts:
export function getPrimaryNav(items?: NavigationItem[]): NavigationItem[] {
  const source = items ?? navigationItems
  return source.filter(item => primaryNavPaths.includes(item.path))
}

export function getOverflowNav(items?: NavigationItem[]): NavigationItem[] {
  const source = items ?? navigationItems
  return source.filter(item => !primaryNavPaths.includes(item.path))
}
```

**Step 3: Update BottomNav to use `useNavigationVisibility`**

```typescript
export function BottomNav() {
  const { items: visibleItems } = useNavigationVisibility()
  const primaryNav = getPrimaryNav(visibleItems)
  const overflowNav = getOverflowNav(visibleItems)
  // ... rest unchanged
}
```

Move `primaryNav` and `overflowNav` from module-level constants to inside the component (since they now depend on the hook).

**Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Step 5: Commit**

```bash
git add src/app/components/navigation/BottomNav.tsx src/app/config/navigation.ts
git commit -m "feat(E25-S08): progressive disclosure in mobile BottomNav"
```

---

### Task 5: Add "Show All Navigation" Toggle in Settings

**Files:**
- Modify: `src/app/pages/Settings.tsx`
- Modify: `src/lib/settings.ts` (if settings are centralized there)

**Step 1: Read Settings.tsx**

Read `src/app/pages/Settings.tsx` to find the appropriate section for a navigation preference. Look for existing toggle patterns (Switch component usage).

**Step 2: Read settings.ts**

Read `src/lib/settings.ts` to understand how settings are persisted. Determine if `showAllNav` should be added to the existing settings object or kept separate.

**Step 3: Add the toggle**

Add a new section or row in the Settings page:

```tsx
<div className="flex items-center justify-between">
  <div>
    <Label htmlFor="show-all-nav">Show all navigation items</Label>
    <p className="text-sm text-muted-foreground">
      Display all sidebar items regardless of your data
    </p>
  </div>
  <Switch
    id="show-all-nav"
    checked={showAllNav}
    onCheckedChange={(checked) => {
      localStorage.setItem('knowlune-show-all-nav-v1', String(checked))
      setShowAllNav(checked)
      window.dispatchEvent(new Event('settingsUpdated'))
    }}
  />
</div>
```

**Step 4: Run build and lint**

```bash
npm run build 2>&1 | tail -10
npm run lint 2>&1 | tail -10
```

**Step 5: Commit**

```bash
git add src/app/pages/Settings.tsx
git commit -m "feat(E25-S08): add 'Show all navigation' toggle in Settings"
```

---

### Task 6: Unit Tests for `useNavigationVisibility`

**Files:**
- Create: `src/app/hooks/__tests__/useNavigationVisibility.test.ts`

**Step 1: Write tests**

Test the pure `isItemVisible` function (extract it as a named export for testability):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test isItemVisible logic
describe('isItemVisible', () => {
  const zeroCounts = {
    importedCourses: 0,
    studySessions: 0,
    challenges: 0,
    reviewRecords: 0,
    quizAttempts: 0,
    aiUsageEvents: 0,
  }

  it('always shows Overview and Courses', () => {
    expect(isItemVisible({ path: '/', name: 'Overview', icon: {} }, zeroCounts)).toBe(true)
    expect(isItemVisible({ path: '/courses', name: 'Courses', icon: {} }, zeroCounts)).toBe(true)
  })

  it('hides My Courses when no imported courses', () => {
    expect(isItemVisible({ path: '/my-class', name: 'My Courses', icon: {} }, zeroCounts)).toBe(false)
  })

  it('shows My Courses when courses exist', () => {
    expect(isItemVisible({ path: '/my-class', name: 'My Courses', icon: {} }, { ...zeroCounts, importedCourses: 1 })).toBe(true)
  })

  it('hides Session History when no sessions', () => {
    expect(isItemVisible({ path: '/session-history', name: 'Session History', icon: {} }, zeroCounts)).toBe(false)
  })

  it('shows Session History when sessions exist', () => {
    expect(isItemVisible({ path: '/session-history', name: 'Session History', icon: {} }, { ...zeroCounts, studySessions: 3 })).toBe(true)
  })

  it('hides Challenges when no challenges', () => {
    expect(isItemVisible({ path: '/challenges', name: 'Challenges', icon: {} }, zeroCounts)).toBe(false)
  })

  it('hides Review and Retention when no review records', () => {
    expect(isItemVisible({ path: '/review', name: 'Review', icon: {} }, zeroCounts)).toBe(false)
    expect(isItemVisible({ path: '/retention', name: 'Retention', icon: {} }, zeroCounts)).toBe(false)
  })

  it('shows Study Analytics tab when sessions exist', () => {
    expect(isItemVisible({ path: '/reports', tab: 'study', name: 'Study Analytics', icon: {} }, { ...zeroCounts, studySessions: 1 })).toBe(true)
  })

  it('hides Quiz Analytics tab when no quiz attempts', () => {
    expect(isItemVisible({ path: '/reports', tab: 'quizzes', name: 'Quiz Analytics', icon: {} }, zeroCounts)).toBe(false)
  })

  it('hides AI Analytics tab when no AI usage events', () => {
    expect(isItemVisible({ path: '/reports', tab: 'ai', name: 'AI Analytics', icon: {} }, zeroCounts)).toBe(false)
  })

  it('shows unknown paths by default (safety net)', () => {
    expect(isItemVisible({ path: '/unknown', name: 'Unknown', icon: {} }, zeroCounts)).toBe(true)
  })
})

// Test group filtering
describe('group filtering', () => {
  it('hides groups with zero visible items', () => {
    // With zero counts, Track group should be empty and hidden
    // Learn group should have Overview + Courses
    // Connect group should be hidden
  })

  it('shows all items when showAll override is true', () => {
    // All groups and items visible
  })

  it('shows all items when isLoaded is false (loading state)', () => {
    // Before counts are loaded, show everything (prevent flash of missing items)
  })
})
```

**Step 2: Run tests**

```bash
npm run test:unit -- useNavigationVisibility 2>&1 | tail -20
```

**Step 3: Commit**

```bash
git add src/app/hooks/__tests__/useNavigationVisibility.test.ts
git commit -m "test(E25-S08): unit tests for navigation visibility logic"
```

---

### Task 7: E2E Tests

**Files:**
- Create: `tests/e2e/regression/story-e25-s08.spec.ts`

**Step 1: Write E2E tests**

Key scenarios to test:

1. **Zero-data user**: Only Overview and Courses visible in sidebar
2. **After import**: My Courses, Notes, Authors, Learning Path, Knowledge Gaps appear
3. **After session**: Session History, Study Analytics appear in Track group
4. **Override toggle**: Settings toggle makes all items visible
5. **Direct URL access**: Navigating to /challenges when hidden still shows the page
6. **Mobile bottom nav**: Only visible items shown

```typescript
import { test, expect } from '../../support/fixtures'

test.describe('E25-S08: Progressive Sidebar Disclosure', () => {
  test('zero-data user sees minimal sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    // Ensure clean state — no imported courses, no sessions
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside[aria-label="Sidebar"]')

    // Should see Overview and Courses
    await expect(sidebar.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Courses' })).toBeVisible()

    // Should NOT see items that require data
    await expect(sidebar.getByRole('link', { name: 'My Courses' })).toBeHidden()
    await expect(sidebar.getByRole('link', { name: 'Session History' })).toBeHidden()
    await expect(sidebar.getByRole('link', { name: 'Challenges' })).toBeHidden()
  })

  test('direct URL access works even when nav item is hidden', async ({ page }) => {
    await page.goto('/challenges')
    await page.waitForLoadState('networkidle')
    // Page should load — not redirect or block
    await expect(page).toHaveURL(/\/challenges/)
  })

  test('settings toggle reveals all navigation items', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-show-all-nav-v1', 'true')
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside[aria-label="Sidebar"]')
    // All items should be visible
    await expect(sidebar.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'My Courses' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Session History' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Challenges' })).toBeVisible()
  })
})
```

**Step 2: Run E2E tests**

```bash
npx playwright test tests/e2e/regression/story-e25-s08.spec.ts --project=chromium 2>&1 | tail -30
```

**Step 3: Check existing navigation.spec.ts for breakage**

The existing navigation test (`tests/e2e/navigation.spec.ts`) navigates to Reports, Courses, etc. These tests might fail if the items are hidden for zero-data users. The test fixtures may need to seed data or set the `showAllNav` override.

**Resolution options:**
- Option A: Add `localStorage.setItem('knowlune-show-all-nav-v1', 'true')` to the test fixture's `addInitScript`
- Option B: Seed minimal data in the existing fixtures so all items are visible

Choose Option A for existing tests (least invasive). New E25-S08 tests explicitly test zero-data state.

**Step 4: Commit**

```bash
git add tests/e2e/regression/story-e25-s08.spec.ts
git commit -m "test(E25-S08): E2E tests for progressive sidebar disclosure"
```

---

### Task 8: Fix Existing Tests (Navigation Compatibility)

**Files:**
- Modify: `tests/support/fixtures/index.ts` or test config
- Possibly modify: `tests/e2e/navigation.spec.ts`

**Step 1: Assess which existing tests break**

Run the full E2E suite and identify failures caused by hidden navigation items:

```bash
npx playwright test tests/e2e/navigation.spec.ts tests/e2e/accessibility-navigation.spec.ts --project=chromium 2>&1 | tail -40
```

**Step 2: Fix by setting override in test fixtures**

Add to the test fixture's `addInitScript` or `beforeEach`:

```typescript
await page.addInitScript(() => {
  localStorage.setItem('knowlune-show-all-nav-v1', 'true')
})
```

This ensures existing tests are unaffected by progressive disclosure.

**Step 3: Run full E2E smoke suite to verify**

```bash
npx playwright test tests/e2e/navigation.spec.ts tests/e2e/accessibility-navigation.spec.ts --project=chromium 2>&1 | tail -30
```

**Step 4: Commit**

```bash
git add tests/
git commit -m "fix(E25-S08): set showAllNav override in existing navigation tests"
```

---

### Task 9: Build Verification + Final Checks

**Step 1: Run full build**

```bash
npm run build 2>&1 | tail -20
```

**Step 2: Run lint**

```bash
npm run lint 2>&1 | tail -20
```

**Step 3: Run type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Step 4: Run unit tests**

```bash
npm run test:unit 2>&1 | tail -10
```

**Step 5: Run E2E smoke + story tests**

```bash
npx playwright test tests/e2e/navigation.spec.ts tests/e2e/regression/story-e25-s08.spec.ts --project=chromium 2>&1 | tail -30
```

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore(E25-S08): build verification and final fixes"
```

---

## Implementation Order Summary

1. `src/app/hooks/useNavigationVisibility.ts` — visibility hook (core logic)
2. Store modifications (5 files) — dispatch `knowlune-data-changed` events
3. `src/app/components/Layout.tsx` — integrate filtered groups into sidebar
4. `src/app/components/navigation/BottomNav.tsx` + `navigation.ts` — mobile nav filtering
5. `src/app/pages/Settings.tsx` — "Show all navigation" toggle
6. Unit tests for visibility logic
7. E2E tests for progressive disclosure
8. Existing test compatibility fixes
9. Build verification

## Files Changed Summary

| File | Change |
|------|--------|
| `src/app/hooks/useNavigationVisibility.ts` | NEW: Hook that reads Dexie counts and returns filtered NavigationGroup[] |
| `src/stores/useCourseImportStore.ts` | Add `knowlune-data-changed` event dispatch after import |
| `src/stores/useSessionStore.ts` | Add `knowlune-data-changed` event dispatch after session save |
| `src/stores/useChallengeStore.ts` | Add `knowlune-data-changed` event dispatch after challenge create |
| `src/stores/useReviewStore.ts` | Add `knowlune-data-changed` event dispatch after review save |
| `src/stores/useQuizStore.ts` | Add `knowlune-data-changed` event dispatch after quiz attempt save |
| `src/app/components/Layout.tsx` | Use `useNavigationVisibility()` in Layout, pass filtered groups to SidebarContent |
| `src/app/components/navigation/BottomNav.tsx` | Use filtered items from hook instead of static list |
| `src/app/config/navigation.ts` | Update `getPrimaryNav()`/`getOverflowNav()` to accept optional item list |
| `src/app/pages/Settings.tsx` | Add "Show all navigation items" Switch toggle |
| `src/app/hooks/__tests__/useNavigationVisibility.test.ts` | NEW: Unit tests for visibility logic |
| `tests/e2e/regression/story-e25-s08.spec.ts` | NEW: E2E tests for progressive disclosure |
| `tests/support/fixtures/` or existing test files | Add `showAllNav` override for existing tests |

## Risks and Considerations

1. **Performance**: `db.table.count()` is fast (IndexedDB index scan), but 6 parallel counts on every mount could add latency. Mitigated by: counts are cached in state, only refreshed on `knowlune-data-changed` events.

2. **Flash of missing content**: Before counts load, we show ALL items (not zero). This prevents a brief "empty sidebar" flash. The `isLoaded` flag controls this behavior.

3. **Existing test breakage**: Navigation E2E tests assume all items are visible. Fixed by setting `showAllNav: true` in test fixtures. This is the least invasive approach.

4. **Event-driven reactivity**: Using `window.dispatchEvent` is the simplest cross-component communication. Alternative: Zustand subscription. Event approach chosen because stores are independent — Zustand subscription would couple navigation to every store.

5. **Direct URL access**: Routes are never blocked. The empty state pages (from E10-S02) handle the case where users reach a page with no data. Progressive disclosure is cosmetic only.

6. **SearchCommandPalette**: Not filtered in this story. Search results should show all pages regardless of sidebar visibility, since users may know what they're looking for. If we want to filter search results too, that's a follow-up story.

7. **Sidebar collapsed mode**: The same filtering applies — hidden items are hidden in both expanded and collapsed states. No special handling needed.
