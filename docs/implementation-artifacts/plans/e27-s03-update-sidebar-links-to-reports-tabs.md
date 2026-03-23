# E27-S03: Update Sidebar Links To Reports Tabs — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single "Reports" sidebar item with three tab-specific items (Study Analytics, Quiz Analytics, AI Analytics) and update `NavLink` active state detection to match `?tab=` query params.

**Architecture:** Extend `NavigationItem` with an optional `tab` field. Update the `NavLink` component in `Layout.tsx` to generate `?tab=` URLs and detect active state using both pathname and search params. Update `navigation.ts` config and `SearchCommandPalette`.

**Tech Stack:** React Router v7 (`useLocation`), TypeScript, `src/app/config/navigation.ts`, `src/app/components/Layout.tsx`

**Dependency warning:** E27-S01 must be merged before this story is reviewed end-to-end. The navigation config and active logic changes here are independently testable (unit tests via mocked router), but clicking the links will only activate the correct tab once E27-S01 makes `Reports.tsx` URL-aware.

---

### Task 1: Extend NavigationItem Interface

**Files:**
- Modify: `src/app/config/navigation.ts`

**Step 1: Read the file to understand the current interface**

Read `src/app/config/navigation.ts` (full, it's only 83 lines).

**Step 2: Add `tab` field to NavigationItem**

```typescript
export interface NavigationItem {
  name: string
  path: string
  icon: LucideIcon
  tab?: string  // optional: when set, link navigates to path?tab=tab and is active only when search matches
}
```

**Step 3: Import icons for the new entries**

The new icons needed: `ClipboardList` (Quiz Analytics) and `BrainCircuit` (AI Analytics). Check Lucide React availability. If `BrainCircuit` is unavailable, use `Bot` or `Cpu`. `BarChart3` already imported for Study Analytics (keep existing icon).

Replace the current Reports item with three tab-specific items in the "Track" group:

```typescript
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
```

**Step 4: Run TypeScript check to verify no errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors on navigation.ts.

**Step 5: Commit**

```bash
git add src/app/config/navigation.ts
git commit -m "feat(E27-S03): extend NavigationItem with tab field, split Reports into 3 tab links"
```

---

### Task 2: Update NavLink Active State and Link Generation

**Files:**
- Modify: `src/app/components/Layout.tsx` (lines 37–56)

**Step 1: Read the NavLink component**

Read `src/app/components/Layout.tsx` lines 28–86 to understand the current `isActive` and `<Link to={item.path}>` logic.

**Step 2: Update `isActive` detection**

Current (line 38–39):
```typescript
const isActive =
  item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
```

New logic — tab items match exact pathname + search; default tab (`study`) also activates on bare `/reports`:
```typescript
const isActive = (() => {
  if (item.tab) {
    const searchMatch = location.search === `?tab=${item.tab}`
    const isDefaultTab = item.tab === 'study' && location.search === '' && location.pathname === item.path
    return location.pathname === item.path && (searchMatch || isDefaultTab)
  }
  return item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
})()
```

**Step 3: Update `<Link to={item.path}>` to include tab param**

Current (line 43):
```typescript
<Link
  to={item.path}
  ...
```

New:
```typescript
<Link
  to={item.tab ? `${item.path}?tab=${item.tab}` : item.path}
  ...
```

**Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

**Step 5: Run unit tests to confirm nothing broken**

```bash
npm run test:unit -- --reporter=verbose 2>&1 | tail -20
```
Expected: all tests pass (or same failures as before — do not introduce new failures).

**Step 6: Commit**

```bash
git add src/app/components/Layout.tsx
git commit -m "feat(E27-S03): tab-aware NavLink active state and ?tab= link generation"
```

---

### Task 3: Update SearchCommandPalette

**Files:**
- Modify: `src/app/components/figma/SearchCommandPalette.tsx`

**Step 1: Read the SearchCommandPalette file**

Read `src/app/components/figma/SearchCommandPalette.tsx` and find the `/reports` entry (around line 81–86).

**Step 2: Replace the single Reports entry with three tab entries**

Find the existing entry (approximate):
```typescript
{
  id: 'page-reports',
  name: 'Reports',
  path: '/reports',
  keywords: ['reports', 'analytics', 'stats'],
},
```

Replace with three entries:
```typescript
{
  id: 'page-reports-study',
  name: 'Study Analytics',
  path: '/reports?tab=study',
  keywords: ['reports', 'study', 'analytics', 'stats', 'lessons', 'completion'],
},
{
  id: 'page-reports-quizzes',
  name: 'Quiz Analytics',
  path: '/reports?tab=quizzes',
  keywords: ['reports', 'quiz', 'analytics', 'quizzes', 'performance', 'score'],
},
{
  id: 'page-reports-ai',
  name: 'AI Analytics',
  path: '/reports?tab=ai',
  keywords: ['reports', 'ai', 'analytics', 'artificial intelligence', 'insights'],
},
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Step 4: Commit**

```bash
git add src/app/components/figma/SearchCommandPalette.tsx
git commit -m "feat(E27-S03): update SearchCommandPalette with tab-specific Reports entries"
```

---

### Task 4: Unit Tests for NavLink Active Logic

**Files:**
- Create: `src/app/components/__tests__/NavLink.test.tsx`

**Note:** Check if a test file for Layout or NavLink already exists:
```bash
find src -name "*Layout*" -o -name "*NavLink*" | grep test
```

**Step 1: Write failing tests**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

// We need to test the NavLink component in isolation.
// Since NavLink is inside Layout.tsx, we need to either:
// a) Extract NavLink to its own file, OR
// b) Test it through a wrapper that renders NavLink with known props

// The simplest approach: test the isActive logic directly as a pure function.
// Extract the isActive calculation to a testable util.

import { getIsActive } from '@/app/config/navigation'

describe('getIsActive', () => {
  it('activates study tab when pathname is /reports and search is ?tab=study', () => {
    expect(getIsActive({ path: '/reports', tab: 'study' }, '/reports', '?tab=study')).toBe(true)
  })

  it('does not activate quiz tab when on study tab', () => {
    expect(getIsActive({ path: '/reports', tab: 'quizzes' }, '/reports', '?tab=study')).toBe(false)
  })

  it('activates study tab when on bare /reports (default tab)', () => {
    expect(getIsActive({ path: '/reports', tab: 'study' }, '/reports', '')).toBe(true)
  })

  it('does not activate quiz tab on bare /reports', () => {
    expect(getIsActive({ path: '/reports', tab: 'quizzes' }, '/reports', '')).toBe(false)
  })

  it('activates AI tab when on /reports?tab=ai', () => {
    expect(getIsActive({ path: '/reports', tab: 'ai' }, '/reports', '?tab=ai')).toBe(true)
  })

  it('activates Overview on exact root match', () => {
    expect(getIsActive({ path: '/' }, '/', '')).toBe(true)
  })

  it('activates Courses on /courses path (startsWith match)', () => {
    expect(getIsActive({ path: '/courses' }, '/courses/123', '')).toBe(true)
  })

  it('does not activate Challenges when on /reports', () => {
    expect(getIsActive({ path: '/challenges' }, '/reports', '?tab=study')).toBe(false)
  })
})
```

**Alternative approach:** If extracting `getIsActive` to `navigation.ts` is awkward, test the NavLink rendered output instead using `MemoryRouter` with an initial entry for each URL scenario. The render approach is more thorough but requires extracting `NavLink` to its own file.

**Implementation choice:** Extract `getIsActive` as an exported pure function in `navigation.ts` for easy testability. Add to `navigation.ts`:

```typescript
/** Pure function to calculate whether a navigation item is active given current location. */
export function getIsActive(
  item: Pick<NavigationItem, 'path' | 'tab'>,
  pathname: string,
  search: string
): boolean {
  if (item.tab) {
    const searchMatch = search === `?tab=${item.tab}`
    const isDefaultTab = item.tab === 'study' && search === '' && pathname === item.path
    return pathname === item.path && (searchMatch || isDefaultTab)
  }
  return item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)
}
```

Then use `getIsActive` in `NavLink`:
```typescript
const isActive = getIsActive(item, location.pathname, location.search)
```

**Step 2: Run tests to verify they fail first**

```bash
npm run test:unit -- NavLink 2>&1 | tail -20
```
Expected: FAIL (function doesn't exist yet)

**Step 3: Export `getIsActive` from navigation.ts**

Add the function above to `src/app/config/navigation.ts`.

**Step 4: Update NavLink to use `getIsActive`**

In `Layout.tsx`, replace the inline `isActive` calculation with:
```typescript
const isActive = getIsActive(item, location.pathname, location.search)
```
Import `getIsActive` from `@/app/config/navigation`.

**Step 5: Run tests to verify they pass**

```bash
npm run test:unit -- NavLink 2>&1 | tail -20
```
Expected: PASS — all 8 tests green.

**Step 6: Run all unit tests to confirm no regressions**

```bash
npm run test:unit 2>&1 | tail -10
```
Expected: same pass count as before (no new failures).

**Step 7: Commit**

```bash
git add src/app/config/navigation.ts src/app/components/__tests__/NavLink.test.tsx src/app/components/Layout.tsx
git commit -m "test(E27-S03): unit tests for tab-aware NavLink active logic via getIsActive"
```

---

### Task 5: E2E Tests

**Files:**
- Create: `tests/e2e/regression/story-e27-s03.spec.ts`

**Important:** These E2E tests require E27-S01 (URL-aware tabs in Reports.tsx) to pass fully. Write them now so they're ready, but they may fail until E27-S01 is merged. Mark the failing dependency clearly in a skip comment.

**Step 1: Write the E2E test file**

```typescript
/**
 * E27-S03: Update Sidebar Links To Reports Tabs
 *
 * Tests that sidebar links navigate to specific Reports tabs
 * and that the active state highlights correctly per tab.
 *
 * NOTE: These tests require E27-S01 (URL-aware tabs in Reports.tsx) to pass.
 * Until E27-S01 is merged, the tab activation assertions will fail.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'

test.describe('E27-S03: Sidebar links to Reports tabs', () => {
  test.beforeEach(async ({ page }) => {
    // Seed sidebar open (desktop viewport)
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-collapsed-v1', 'false')
    })
  })

  test('Study Analytics link navigates to /reports?tab=study', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await navigateAndWait(page, '/')

    const studyLink = page.locator('nav').getByRole('link', { name: 'Study Analytics' })
    await expect(studyLink).toBeVisible()
    await studyLink.click()
    await expect(page).toHaveURL(/\/reports\?tab=study/)
  })

  test('Quiz Analytics link navigates to /reports?tab=quizzes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await navigateAndWait(page, '/')

    const quizLink = page.locator('nav').getByRole('link', { name: 'Quiz Analytics' })
    await expect(quizLink).toBeVisible()
    await quizLink.click()
    await expect(page).toHaveURL(/\/reports\?tab=quizzes/)
  })

  test('AI Analytics link navigates to /reports?tab=ai', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await navigateAndWait(page, '/')

    const aiLink = page.locator('nav').getByRole('link', { name: 'AI Analytics' })
    await expect(aiLink).toBeVisible()
    await aiLink.click()
    await expect(page).toHaveURL(/\/reports\?tab=ai/)
  })

  test('Study Analytics sidebar item is active on /reports?tab=study', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await navigateAndWait(page, '/reports?tab=study')

    const studyLink = page.locator('nav').getByRole('link', { name: 'Study Analytics' })
    await expect(studyLink).toHaveAttribute('aria-current', 'page')
  })

  test('Quiz Analytics sidebar item is active on /reports?tab=quizzes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await navigateAndWait(page, '/reports?tab=quizzes')

    const quizLink = page.locator('nav').getByRole('link', { name: 'Quiz Analytics' })
    await expect(quizLink).toHaveAttribute('aria-current', 'page')
  })

  test('Study Analytics is active on bare /reports (default tab)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await navigateAndWait(page, '/reports')

    const studyLink = page.locator('nav').getByRole('link', { name: 'Study Analytics' })
    await expect(studyLink).toHaveAttribute('aria-current', 'page')

    // Quiz and AI should NOT be active
    const quizLink = page.locator('nav').getByRole('link', { name: 'Quiz Analytics' })
    await expect(quizLink).not.toHaveAttribute('aria-current', 'page')
  })

  test('collapsed sidebar shows correct tooltip names for Reports tab links', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-collapsed-v1', 'true')
    })
    await navigateAndWait(page, '/reports?tab=study')

    // Hover over the study analytics icon to see tooltip
    const studyIcon = page.locator('nav li').filter({ has: page.locator('[aria-current="page"]') }).first()
    await studyIcon.hover()
    await expect(page.getByRole('tooltip', { name: 'Study Analytics' })).toBeVisible()
  })
})
```

**Step 2: Run E2E tests**

```bash
npx playwright test tests/e2e/regression/story-e27-s03.spec.ts --project=chromium 2>&1 | tail -30
```

Expected outcome (before E27-S01):
- Navigation link visibility tests: PASS (sidebar has the new links)
- URL navigation tests: PASS (clicking links goes to correct URL)
- Tab activation tests: May FAIL (Reports.tsx not yet URL-aware) — acceptable until E27-S01 merges
- Sidebar active state tests: PASS (NavLink active logic works correctly)

**Step 3: Fix any test failures that are NOT related to E27-S01 dependency**

If link visibility or URL navigation fails, debug and fix.

**Step 4: Commit**

```bash
git add tests/e2e/regression/story-e27-s03.spec.ts
git commit -m "test(E27-S03): E2E tests for tab-specific sidebar links"
```

---

### Task 6: Build Verification + Final Commit

**Step 1: Run full build**

```bash
npm run build 2>&1 | tail -20
```
Expected: BUILD SUCCESSFUL, no TypeScript errors.

**Step 2: Run lint**

```bash
npm run lint 2>&1 | tail -20
```
Expected: 0 errors, 0 warnings.

**Step 3: Run all unit tests**

```bash
npm run test:unit 2>&1 | tail -10
```
Expected: all passing, coverage above 70%.

**Step 4: Run E2E smoke suite**

```bash
npx playwright test tests/e2e/navigation.spec.ts --project=chromium 2>&1 | tail -20
```
Expected: all pass. If "Reports" navigation test fails (it looks for a "Reports" link), update that test to look for "Study Analytics" (or whichever tab link is the first one shown).

Note: `tests/e2e/navigation.spec.ts:43` looks for `getByRole('link', { name: /reports/i })` — this may fail since the link name changed to "Study Analytics". Update it:
```typescript
// Before:
const coursesLink = page.locator('nav').getByRole('link', { name: /courses/i })
// The test that was checking 'reports' should now check 'study analytics'
const studyAnalyticsLink = page.locator('nav').getByRole('link', { name: /study analytics/i })
```

But check first — the test at line 43 checks Courses link highlighting, not Reports. If there's a separate test for Reports sidebar link, update it.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(E27-S03): complete sidebar tab links with build/lint verification"
```

---

## Implementation Order Summary

1. `src/app/config/navigation.ts` — add `tab?` field + `getIsActive()` + split Reports items
2. `src/app/components/Layout.tsx` — use `getIsActive()` + tab-aware link generation
3. `src/app/components/figma/SearchCommandPalette.tsx` — update Reports entries
4. `src/app/components/__tests__/NavLink.test.tsx` — unit tests for `getIsActive()`
5. `tests/e2e/regression/story-e27-s03.spec.ts` — E2E tests

## Files Changed Summary

| File | Change |
|------|--------|
| `src/app/config/navigation.ts` | Add `tab?` to `NavigationItem`; add `getIsActive()` export; replace 1 Reports item with 3 tab items |
| `src/app/components/Layout.tsx` | Use `getIsActive()` in `NavLink`; tab-aware `<Link to=...>` generation |
| `src/app/components/figma/SearchCommandPalette.tsx` | 1 Reports entry → 3 tab-specific entries |
| `src/app/components/__tests__/NavLink.test.tsx` | NEW: 8 unit tests for `getIsActive()` |
| `tests/e2e/regression/story-e27-s03.spec.ts` | NEW: 6 E2E tests for sidebar tab links |
| `tests/e2e/navigation.spec.ts` | Possibly update "Reports" link assertion to "Study Analytics" |

## Risks and Considerations

- **E27-S01 dependency**: Tab-click activation (Reports.tsx reading `?tab=`) won't work until E27-S01 is merged. All other changes (navigation config, active logic, URL generation) are independently correct.
- **Icon availability**: Verify `ClipboardList` and `BrainCircuit` exist in `lucide-react`. Check with `grep -r "from 'lucide-react'" src/ | head -5` to see how other icons are imported.
- **Mobile BottomNav**: The `getPrimaryNav()` and `getOverflowNav()` functions in `navigation.ts` filter items by path. With three `/reports` items, all three will end up in the overflow nav (none are in `primaryNavPaths`). This is correct behavior — no change needed.
- **Search palette navigation**: The command palette likely uses `navigate(path)` — ensure the path includes `?tab=` for tab-specific entries.
