# E27-S01: Add Analytics Tabs To Reports Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Reports page tabs URL-aware via `useSearchParams`, add a third "Quiz Analytics" tab, and move quiz-specific analytics (retake frequency) from the Study tab into the new Quiz tab.

**Architecture:** Minimal changes to `Reports.tsx` (controlled Tabs + useSearchParams), one new component (`QuizAnalyticsTab.tsx`), and E2E test updates. The navigation config and sidebar links are already done (E27-S03).

**Tech Stack:** React Router v7 (`useSearchParams`), shadcn/ui `Tabs`, Recharts, Dexie (IndexedDB), Zustand store

**Dependency context:** E27-S03 (sidebar links to `/reports?tab=study|quizzes|ai`) is already merged. This story completes the circuit by making `Reports.tsx` actually respond to the `?tab=` query parameter.

---

### Task 1: Make Reports Tabs URL-Aware

**Files:**
- Modify: `src/app/pages/Reports.tsx`

**Step 1: Read the file to understand current tab structure**

Read `src/app/pages/Reports.tsx` (full file, ~440 lines). Note:
- Line 188: `<Tabs defaultValue="study" className="mb-6">` — currently uncontrolled
- Lines 191–197: Two TabsTriggers (study, ai)
- Lines 200–201: AI tab content
- Lines 204–435: Study tab content

**Step 2: Add useSearchParams import and hook**

Add to the existing `react-router` imports (if any) or add new import:

```typescript
import { useSearchParams } from 'react-router'
```

Inside the component, before the memoized data section:

```typescript
const [searchParams, setSearchParams] = useSearchParams()
const VALID_TABS = ['study', 'quizzes', 'ai'] as const
const rawTab = searchParams.get('tab')
const activeTab = VALID_TABS.includes(rawTab as (typeof VALID_TABS)[number])
  ? (rawTab as string)
  : 'study'
```

**Step 3: Convert Tabs to controlled mode**

Replace:
```tsx
<Tabs defaultValue="study" className="mb-6">
```

With:
```tsx
<Tabs
  value={activeTab}
  onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
  className="mb-6"
>
```

Note: `replace: true` avoids polluting browser history on every tab click — the user can still use back button to leave the Reports page, but switching between tabs doesn't create history entries. This is the standard UX pattern (same as Notes.tsx).

**Step 4: Verify existing tabs still work**

Run the dev server and manually verify:
- `/reports` → Study tab active
- `/reports?tab=study` → Study tab active
- `/reports?tab=ai` → AI tab active
- `/reports?tab=invalid` → Falls back to Study

**Step 5: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Step 6: Commit**

```bash
git add src/app/pages/Reports.tsx
git commit -m "feat(E27-S01): make Reports tabs URL-aware via useSearchParams"
```

---

### Task 2: Create QuizAnalyticsTab Component

**Files:**
- Create: `src/app/components/reports/QuizAnalyticsTab.tsx`

**Step 1: Check what already exists in reports/ directory**

```bash
ls src/app/components/reports/
```

Expected: `AIAnalyticsTab.tsx`, `CategoryRadar.tsx`, `SkillsRadar.tsx`, `WeeklyGoalRing.tsx`, `RecentActivityTimeline.tsx`

**Step 2: Read AIAnalyticsTab.tsx for component pattern**

Read `src/app/components/reports/AIAnalyticsTab.tsx` to follow the same pattern:
- Async data loading with useEffect + ignore flag
- Loading skeleton
- Empty state
- Stat cards + detail section

**Step 3: Create QuizAnalyticsTab.tsx**

Follow the AIAnalyticsTab pattern. The component should:

1. **Load data** via `useEffect`:
   - Call `calculateRetakeFrequency()` from `@/lib/analytics`
   - Query `db.quizAttempts.count()` for total attempts
   - Query `db.quizzes.count()` for total quizzes
   - Calculate average score from all attempts

2. **State shape**:
   ```typescript
   interface QuizAnalyticsData {
     totalQuizzes: number
     totalAttempts: number
     averageScore: number
     retakeData: RetakeFrequencyResult
   }
   ```

3. **Loading state**: Show skeleton cards while data loads

4. **Empty state**: When `totalAttempts === 0`, show:
   ```tsx
   <EmptyState
     icon={ClipboardList}
     title="No quizzes taken yet"
     description="Complete a quiz to see your performance analytics here"
     actionLabel="Browse Courses"
     actionHref="/courses"
   />
   ```

5. **Content layout** (when data exists):
   - **Row 1: Stat cards** (3-column grid):
     - Total Quizzes Taken (count)
     - Average Score (percentage)
     - Average Retakes (from retakeData)
   - **Row 2: Retake Frequency detail card** (moved from Study tab):
     - Same card content as currently in Reports.tsx lines 398–422
     - Shows interpretation text

**Step 4: Import icons from lucide-react**

Use icons consistent with existing patterns:
- `ClipboardList` — matches navigation icon for Quiz Analytics
- `Target` — for average score
- `RotateCcw` — for retake frequency (same as current)

**Step 5: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Step 6: Commit**

```bash
git add src/app/components/reports/QuizAnalyticsTab.tsx
git commit -m "feat(E27-S01): create QuizAnalyticsTab component with aggregate quiz stats"
```

---

### Task 3: Wire Quiz Tab Into Reports Page

**Files:**
- Modify: `src/app/pages/Reports.tsx`

**Step 1: Add Quiz Analytics tab trigger and content**

After the existing AI Analytics TabsTrigger (line 195), add:
```tsx
<TabsTrigger value="quizzes" className="h-9">
  Quiz Analytics
</TabsTrigger>
```

After the existing AI TabsContent (line 202), add:
```tsx
<TabsContent value="quizzes" className="mt-6">
  <QuizAnalyticsTab />
</TabsContent>
```

**Step 2: Import QuizAnalyticsTab**

```typescript
import { QuizAnalyticsTab } from '@/app/components/reports/QuizAnalyticsTab'
```

**Step 3: Remove retake frequency from Study tab**

Remove from the Study tab's TabsContent:
- The retake frequency card (lines 397–422, the `<motion.div variants={fadeUp}>` containing `data-testid="quiz-retake-card"`)
- The `retakeData` state and `useEffect` (lines 70–74, 88–98)
- The `RetakeFrequencyResult` import (line 28 — but only if no longer used in Reports.tsx)
- Remove `calculateRetakeFrequency` and `interpretRetakeFrequency` imports from Reports.tsx (moved to QuizAnalyticsTab)
- Update the `hasActivity` check (line 165–169) — remove `retakeData.totalAttempts > 0` since retake data is now in the Quiz tab

**Step 4: Verify the retake frequency data is loaded in QuizAnalyticsTab**

The `calculateRetakeFrequency` and `interpretRetakeFrequency` functions should now only be imported in `QuizAnalyticsTab.tsx`.

**Step 5: Run build + lint + typecheck**

```bash
npm run build 2>&1 | tail -20
npm run lint 2>&1 | tail -20
npx tsc --noEmit 2>&1 | head -30
```

**Step 6: Commit**

```bash
git add src/app/pages/Reports.tsx
git commit -m "feat(E27-S01): add Quiz Analytics tab trigger, move retake card to Quiz tab"
```

---

### Task 4: E2E Tests

**Files:**
- Create: `tests/e2e/regression/story-e27-s01.spec.ts`
- Modify: `tests/e2e/reports-redesign.spec.ts` (update for 3-tab model)

**Step 1: Write E27-S01 E2E tests**

```typescript
/**
 * E27-S01: Add Analytics Tabs To Reports Page
 *
 * Tests URL-aware tab switching, Quiz Analytics tab content,
 * and fallback behavior for invalid tab params.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'

test.describe('E27-S01: URL-aware Reports tabs', () => {
  test('defaults to Study tab when no ?tab param', async ({ page }) => {
    await navigateAndWait(page, '/reports')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute('data-state', 'active')
    await expect(page.getByRole('tab', { name: 'Quiz Analytics' })).toHaveAttribute('data-state', 'inactive')
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute('data-state', 'inactive')
  })

  test('?tab=study activates Study tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=study')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute('data-state', 'active')
  })

  test('?tab=quizzes activates Quiz tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=quizzes')
    await expect(page.getByRole('tab', { name: 'Quiz Analytics' })).toHaveAttribute('data-state', 'active')
  })

  test('?tab=ai activates AI tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=ai')
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute('data-state', 'active')
  })

  test('?tab=invalid falls back to Study tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=invalid')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute('data-state', 'active')
  })

  test('clicking tab updates URL', async ({ page }) => {
    await navigateAndWait(page, '/reports')
    await page.getByRole('tab', { name: 'Quiz Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=quizzes/)
    await page.getByRole('tab', { name: 'AI Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=ai/)
  })

  test('Quiz Analytics shows empty state when no quiz data', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=quizzes')
    await expect(page.getByText('No quizzes taken yet')).toBeVisible()
  })
})
```

**Step 2: Seed quiz data tests (if needed)**

For testing the Quiz tab WITH data, use the quiz factory to seed IndexedDB:
```typescript
test('Quiz Analytics shows retake frequency when data exists', async ({ page }) => {
  // Seed quiz data via IDB helper (follow existing seeding pattern from other specs)
  // ...
  await navigateAndWait(page, '/reports?tab=quizzes')
  await expect(page.getByText('attempts per quiz')).toBeVisible()
})
```

Check existing E2E test seeding patterns in the codebase before implementing data-seeded tests.

**Step 3: Update reports-redesign.spec.ts**

The existing test at line 100–123 tests switching between 2 tabs. Update to include the Quiz tab:

```typescript
test('should switch between all three tabs', async ({ page }) => {
  await goToReports(page)

  // Click Quiz Analytics tab
  const quizTab = page.getByRole('tab', { name: 'Quiz Analytics' })
  await quizTab.click()
  await expect(quizTab).toHaveAttribute('data-state', 'active')

  // Click AI Analytics tab
  const aiTab = page.getByRole('tab', { name: 'AI Analytics' })
  await aiTab.click()
  await expect(aiTab).toHaveAttribute('data-state', 'active')

  // Switch back to Study
  const studyTab = page.getByRole('tab', { name: 'Study Analytics' })
  await studyTab.click()
  await expect(studyTab).toHaveAttribute('data-state', 'active')
  await expect(page.getByText('Weekly Study Goal')).toBeVisible()
})
```

Also update the empty state test if it references tab structure.

**Step 4: Run E2E tests**

```bash
npx playwright test tests/e2e/regression/story-e27-s01.spec.ts --project=chromium 2>&1 | tail -30
npx playwright test tests/e2e/reports-redesign.spec.ts --project=chromium 2>&1 | tail -30
```

**Step 5: Run E27-S03 tests to verify they pass (integration test)**

```bash
npx playwright test tests/e2e/regression/story-e27-s03.spec.ts --project=chromium 2>&1 | tail -30
```

These should now pass fully since Reports.tsx is URL-aware.

**Step 6: Commit**

```bash
git add tests/e2e/regression/story-e27-s01.spec.ts tests/e2e/reports-redesign.spec.ts
git commit -m "test(E27-S01): E2E tests for URL-aware tabs and Quiz Analytics tab"
```

---

### Task 5: Build Verification + Accessibility Check

**Step 1: Run full build**

```bash
npm run build 2>&1 | tail -20
```

**Step 2: Run lint**

```bash
npm run lint 2>&1 | tail -20
```

**Step 3: Run all unit tests**

```bash
npm run test:unit 2>&1 | tail -10
```

**Step 4: Run full E2E suite (smoke + regression)**

```bash
npx playwright test tests/e2e/navigation.spec.ts tests/e2e/reports-redesign.spec.ts tests/e2e/regression/story-e27-s01.spec.ts tests/e2e/regression/story-e27-s03.spec.ts --project=chromium 2>&1 | tail -30
```

**Step 5: Manual accessibility check**

- Verify tab panel has proper `role="tabpanel"` (shadcn does this automatically)
- Verify `aria-selected="true"` on active tab
- Verify keyboard navigation between tabs (Left/Right arrow)
- Verify screen reader announces tab name on switch

**Step 6: Final commit if any fixes needed**

---

## Implementation Order Summary

1. `src/app/pages/Reports.tsx` — add `useSearchParams`, controlled Tabs, tab validation
2. `src/app/components/reports/QuizAnalyticsTab.tsx` — NEW: aggregate quiz stats component
3. `src/app/pages/Reports.tsx` — add Quiz tab trigger/content, remove retake card from Study tab
4. `tests/e2e/regression/story-e27-s01.spec.ts` — NEW: E2E tests
5. `tests/e2e/reports-redesign.spec.ts` — update for 3-tab model

## Files Changed Summary

| File | Change |
|------|--------|
| `src/app/pages/Reports.tsx` | Add `useSearchParams`; controlled Tabs; add Quiz tab trigger+content; remove retake card from Study tab |
| `src/app/components/reports/QuizAnalyticsTab.tsx` | NEW: Quiz Analytics tab with aggregate stats, retake frequency, empty state |
| `tests/e2e/regression/story-e27-s01.spec.ts` | NEW: 7+ E2E tests for URL tabs and Quiz content |
| `tests/e2e/reports-redesign.spec.ts` | Update tab switching test for 3 tabs |

## Risks and Considerations

1. **`replace: true` in setSearchParams**: Using `replace` avoids history spam when clicking between tabs. Alternative is `push` (creates history entries per tab click). Standard UX is `replace` — match Notes.tsx pattern.

2. **Retake frequency migration**: Moving the retake card from Study to Quiz tab changes what users see on the default view. This is intentional (consolidation) but note that existing E2E tests checking for retake content on `/reports` will break and need updating.

3. **Empty state guard**: The `hasActivity` check in Reports.tsx (line 165) gates the entire tab UI. After removing `retakeData.totalAttempts > 0` from this check, a user who has ONLY taken quizzes (no study sessions) would still see the empty state. Consider whether `hasActivity` should also check quiz data — or whether the Quiz tab should have its own independent empty state handling (preferred, since the tab-level empty state handles this).

4. **Quiz data loading**: QuizAnalyticsTab loads data async. Use the ignore-flag pattern (`let ignore = false; return () => { ignore = true }`) consistent with AIAnalyticsTab and existing Reports.tsx effects.

5. **Data-seeded E2E tests**: Testing the Quiz tab with actual quiz data requires IndexedDB seeding. Use the `quiz-factory.ts` helpers and existing seeding patterns. If seeding is complex, start with empty-state tests only and add data-seeded tests as a follow-up.

## Complexity Estimate

**Small-Medium** (~3-4 hours):
- Task 1 (URL-aware tabs): ~30 min
- Task 2 (QuizAnalyticsTab): ~60 min
- Task 3 (Wire into Reports): ~30 min
- Task 4 (E2E tests): ~60 min
- Task 5 (Build verification): ~30 min
