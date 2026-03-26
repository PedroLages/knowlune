# E27-S02: Route Redirects For Legacy Paths — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Reports page URL-aware (controlled by `?tab=` query params) and add `<Navigate>` redirects for path-based legacy analytics URLs (`/reports/study`, `/reports/quizzes`, `/reports/ai`).

**Architecture:** Two changes — (1) Reports.tsx reads/writes `?tab=` via `useSearchParams` (replacing `defaultValue` with controlled `value`), (2) `routes.tsx` gains three `<Navigate>` redirect entries for path-based legacy URLs.

**Tech Stack:** React Router v7 (`useSearchParams`, `Navigate`), TypeScript, Vitest + Testing Library, Playwright

**Dependencies:** None. E27-S01 (add quizzes tab content) can be done in any order — the `quizzes` redirect works even before the tab exists (falls back to `study` default).

---

### Task 1: Make Reports.tsx URL-Aware

**Files:**
- Modify: `src/app/pages/Reports.tsx`

**Step 1: Read the file to understand the current tab implementation**

Read `src/app/pages/Reports.tsx` — focus on:
- Line 188: `<Tabs defaultValue="study">` — currently uncontrolled
- Lines 191-197: `TabsTrigger` values (`study`, `ai`)
- No `useSearchParams` import currently exists

**Step 2: Add useSearchParams import and state derivation**

Add to the imports (line 1 area):
```typescript
import { useSearchParams } from 'react-router'
```

After the existing `useEffect` blocks (around line 98), add:
```typescript
const [searchParams, setSearchParams] = useSearchParams()
const VALID_TABS = ['study', 'ai'] as const
type ReportsTab = (typeof VALID_TABS)[number]
const DEFAULT_TAB: ReportsTab = 'study'
const rawTab = searchParams.get('tab')
const activeTab: ReportsTab = VALID_TABS.includes(rawTab as ReportsTab)
  ? (rawTab as ReportsTab)
  : DEFAULT_TAB
```

**Design decision — why `as const` array instead of a Set:**
The valid tabs list is small (2-3 items) and known at compile time. An array with `includes()` is simpler and provides type narrowing via the `VALID_TABS[number]` union type. When E27-S01 adds the `quizzes` tab, it just appends to this array.

**Step 3: Wire Tabs to URL state**

Change line 188 from:
```tsx
<Tabs defaultValue="study" className="mb-6">
```
To:
```tsx
<Tabs
  value={activeTab}
  onValueChange={(val) => setSearchParams({ tab: val }, { replace: true })}
  className="mb-6"
>
```

**Why `replace: true`:** Tab switches should replace the history entry, not push. This prevents the user from having to click Back N times to exit the Reports page (one per tab they visited). This matches the `Notes.tsx` pattern.

**Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

**Step 5: Manual smoke test**

```bash
npm run dev
# Navigate to /reports → should show Study Analytics (default)
# Navigate to /reports?tab=ai → should show AI Analytics
# Click Study Analytics tab → URL updates to /reports?tab=study
# Navigate to /reports?tab=garbage → should fall back to study
```

**Step 6: Commit**

```bash
git add src/app/pages/Reports.tsx
git commit -m "feat(E27-S02): make Reports tabs URL-aware via useSearchParams"
```

---

### Task 2: Add Path-Based Redirect Routes

**Files:**
- Modify: `src/app/routes.tsx`

**Step 1: Read the file to understand the current route structure**

Read `src/app/routes.tsx` — focus on:
- Lines 173-175: `/library` → `/notes?tab=bookmarks` (pattern to follow)
- Lines 209-216: `/instructors` → `/authors` (another pattern)
- Line 233-240: `/reports` route (where we insert the redirect entries)

**Step 2: Add redirect routes after the existing `/reports` route**

After the `/reports` route entry (around line 240), add:

```typescript
// Legacy path-based redirects → query-param tabs (E27-S02)
{
  path: 'reports/study',
  element: <Navigate to="/reports?tab=study" replace />,
},
{
  path: 'reports/quizzes',
  element: <Navigate to="/reports?tab=quizzes" replace />,
},
{
  path: 'reports/ai',
  element: <Navigate to="/reports?tab=ai" replace />,
},
```

**Why these specific paths:** Even though no code currently links to `/reports/study`, `/reports/ai`, or `/reports/quizzes`, they are natural URL patterns users might try or that could exist in bookmarks. The redirect ensures any path-based attempt lands on the correct tab. This is defensive routing — the cost is 3 lines of config, the benefit is zero 404s for reasonable URL attempts.

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/routes.tsx
git commit -m "feat(E27-S02): add Navigate redirects for /reports/study, /reports/quizzes, /reports/ai"
```

---

### Task 3: Unit Tests for URL-Controlled Tabs

**Files:**
- Modify: `src/app/pages/__tests__/Reports.test.tsx`

**Step 1: Read the existing test file**

Read `src/app/pages/__tests__/Reports.test.tsx` — key observations:
- Currently renders `<Reports />` WITHOUT router context
- Adding `useSearchParams` to Reports will crash without `MemoryRouter`
- Must wrap all renders in `<MemoryRouter initialEntries={[...]}>`

**Step 2: Add MemoryRouter wrapper to existing tests**

Import `MemoryRouter` from `react-router`:
```typescript
import { MemoryRouter } from 'react-router'
```

Create a helper function:
```typescript
function renderReports(initialEntry = '/reports') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Reports />
    </MemoryRouter>
  )
}
```

Update ALL existing `render(<Reports />)` calls to `renderReports()`. This ensures existing tests continue to pass with the new router requirement.

**Step 3: Add new URL-aware tab tests**

```typescript
describe('URL-controlled tabs', () => {
  it('activates Study Analytics tab on ?tab=study', () => {
    renderReports('/reports?tab=study')
    const studyTab = screen.getByRole('tab', { name: 'Study Analytics' })
    expect(studyTab).toHaveAttribute('data-state', 'active')
  })

  it('activates AI Analytics tab on ?tab=ai', () => {
    renderReports('/reports?tab=ai')
    const aiTab = screen.getByRole('tab', { name: 'AI Analytics' })
    expect(aiTab).toHaveAttribute('data-state', 'active')
  })

  it('defaults to Study Analytics tab on bare /reports', () => {
    renderReports('/reports')
    const studyTab = screen.getByRole('tab', { name: 'Study Analytics' })
    expect(studyTab).toHaveAttribute('data-state', 'active')
  })

  it('falls back to Study Analytics on unknown ?tab=garbage', () => {
    renderReports('/reports?tab=garbage')
    const studyTab = screen.getByRole('tab', { name: 'Study Analytics' })
    expect(studyTab).toHaveAttribute('data-state', 'active')
  })
})
```

**Note:** Testing `onValueChange` (tab click → URL update) is harder in unit tests because `setSearchParams` requires real router context. The E2E tests in Task 4 cover this interaction thoroughly.

**Step 4: Run unit tests**

```bash
npm run test:unit -- Reports 2>&1 | tail -30
```
Expected: all tests pass (existing + new).

**Step 5: Confirm no regressions in full unit suite**

```bash
npm run test:unit 2>&1 | tail -10
```
Expected: same pass count or higher.

**Step 6: Commit**

```bash
git add src/app/pages/__tests__/Reports.test.tsx
git commit -m "test(E27-S02): unit tests for URL-controlled Reports tabs with MemoryRouter"
```

---

### Task 4: E2E Tests for Redirects and URL Behavior

**Files:**
- Create: `tests/e2e/regression/story-e27-s02.spec.ts`

**Step 1: Write the E2E test file**

```typescript
/**
 * E27-S02: Route Redirects For Legacy Paths
 *
 * Tests that:
 * - Path-based URLs redirect to query-param equivalents
 * - Reports tabs are controlled by URL ?tab= parameter
 * - Tab clicks update the URL
 * - Unknown tab values fall back to study (default)
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'

test.describe('E27-S02: Route redirects for legacy paths', () => {
  // ── AC3: Path-based redirects ──

  test('/reports/study redirects to /reports?tab=study', async ({ page }) => {
    await navigateAndWait(page, '/reports/study')
    await expect(page).toHaveURL(/\/reports\?tab=study/)
    await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible()
  })

  test('/reports/ai redirects to /reports?tab=ai', async ({ page }) => {
    await navigateAndWait(page, '/reports/ai')
    await expect(page).toHaveURL(/\/reports\?tab=ai/)
  })

  test('/reports/quizzes redirects to /reports?tab=quizzes', async ({ page }) => {
    await navigateAndWait(page, '/reports/quizzes')
    // quizzes tab may not exist yet (E27-S01) — redirect still works,
    // page falls back to default study tab
    await expect(page).toHaveURL(/\/reports\?tab=quizzes/)
  })

  // ── AC1: URL-controlled tabs ──

  test('?tab=study activates Study Analytics tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=study')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('?tab=ai activates AI Analytics tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=ai')
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  // ── AC4: Default tab fallback ──

  test('bare /reports defaults to Study Analytics tab', async ({ page }) => {
    await navigateAndWait(page, '/reports')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('unknown ?tab=garbage falls back to Study Analytics', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=garbage')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  // ── AC2: Tab click updates URL ──

  test('clicking AI Analytics tab updates URL to ?tab=ai', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=study')
    await page.getByRole('tab', { name: 'AI Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=ai/)
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('clicking Study Analytics tab updates URL to ?tab=study', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=ai')
    await page.getByRole('tab', { name: 'Study Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=study/)
  })
})
```

**Step 2: Run the E2E tests**

```bash
npx playwright test tests/e2e/regression/story-e27-s02.spec.ts --project=chromium 2>&1 | tail -30
```
Expected: all pass.

**Step 3: Run existing reports tests to confirm no regressions**

```bash
npx playwright test tests/e2e/reports-redesign.spec.ts tests/e2e/navigation.spec.ts --project=chromium 2>&1 | tail -30
```
Expected: all pass. The `goToReports` helper navigates to `/reports` which will still show Study Analytics by default.

**Step 4: Commit**

```bash
git add tests/e2e/regression/story-e27-s02.spec.ts
git commit -m "test(E27-S02): E2E tests for path redirects and URL-controlled tabs"
```

---

### Task 5: Build Verification + Final Commit

**Step 1: Run full build**

```bash
npm run build 2>&1 | tail -20
```
Expected: BUILD SUCCESSFUL.

**Step 2: Run lint**

```bash
npm run lint 2>&1 | tail -20
```
Expected: 0 errors.

**Step 3: Run all unit tests**

```bash
npm run test:unit 2>&1 | tail -10
```
Expected: all passing.

**Step 4: Run E2E smoke suite**

```bash
npx playwright test tests/e2e/navigation.spec.ts tests/e2e/reports-redesign.spec.ts --project=chromium 2>&1 | tail -30
```
Expected: all pass.

**Step 5: Run E27-S03 regression tests (dependent story)**

```bash
npx playwright test tests/e2e/regression/story-e27-s03.spec.ts --project=chromium 2>&1 | tail -30
```
Expected: all pass (sidebar links still work with URL-aware tabs).

**Step 6: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore(E27-S02): build verification and cleanup"
```

---

## Implementation Order Summary

1. `src/app/pages/Reports.tsx` — add `useSearchParams`, controlled `Tabs` value, `onValueChange` URL sync
2. `src/app/routes.tsx` — add 3 `<Navigate>` redirect routes
3. `src/app/pages/__tests__/Reports.test.tsx` — wrap in `MemoryRouter`, add URL-aware tab tests
4. `tests/e2e/regression/story-e27-s02.spec.ts` — E2E for redirects, URL control, tab clicks
5. Build/lint/test verification

## Files Changed Summary

| File | Change |
|------|--------|
| `src/app/pages/Reports.tsx` | Add `useSearchParams`; change `<Tabs defaultValue>` to controlled `value`; add `onValueChange` URL sync |
| `src/app/routes.tsx` | Add 3 `<Navigate>` redirect entries: `/reports/study`, `/reports/quizzes`, `/reports/ai` |
| `src/app/pages/__tests__/Reports.test.tsx` | Wrap renders in `<MemoryRouter>`; add 4 URL-aware tab tests |
| `tests/e2e/regression/story-e27-s02.spec.ts` | NEW: 9 E2E tests for redirects and URL tab behavior |

## Risks and Considerations

- **Existing unit tests break without MemoryRouter**: Adding `useSearchParams` to Reports requires router context. All existing `render(<Reports />)` calls must be wrapped in `<MemoryRouter>` or they'll crash. Task 3 handles this explicitly.
- **E27-S01 dependency**: The `quizzes` tab doesn't exist yet. The redirect for `/reports/quizzes` will land on `/reports?tab=quizzes`, which falls back to `study` because `quizzes` isn't in `VALID_TABS`. When E27-S01 adds the tab, it simply adds `'quizzes'` to the `VALID_TABS` array.
- **Tab click URL update uses `replace`**: This prevents back-button pollution. The user clicks Back once to leave Reports entirely, not once per tab they visited. This matches the UX pattern in Notes.tsx.
- **Empty state bypass**: When `!hasActivity`, no tabs render. The `useSearchParams` logic still runs but has no visible effect since the `<Tabs>` component isn't in the DOM. This is harmless.
- **E2E test for `?tab=quizzes`**: The redirect test asserts the URL changes but does NOT assert which tab is active (since the quizzes tab doesn't exist yet). Once E27-S01 ships, this test can be enhanced.
- **Existing E2E tests**: `reports-redesign.spec.ts` and `navigation.spec.ts` navigate to `/reports` and expect Study Analytics to be the default tab. This continues to work because bare `/reports` defaults to `study`.
