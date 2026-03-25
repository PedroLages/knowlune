# Plan: E21-S06 — Smart Dashboard Reordering

## Context

Epic 21 (Engagement & Adaptive Experience) adds personalization features. E21-S06 makes the Overview dashboard dynamically reorder its sections based on user behavior, with manual drag-and-drop override, pin-to-top, and reset-to-default. This is a Phase 4 "Adaptive Intelligence" feature.

**Dependencies:**
- E21-S05 (User Engagement Preference Controls) is listed as a dependency but is still backlog. This plan is self-contained — it introduces its own preference store. If E21-S05 lands first, the store could be merged later.
- dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) is already installed and used in `AILearningPath.tsx`.

## Architecture Decisions

### Decision 1: localStorage (not IndexedDB) for section order
**Rationale:** Section order is lightweight UI state (~200 bytes). Follows the pattern of `useOnboardingStore` and `useSuggestionStore` — both use Zustand `persist()` with localStorage. IndexedDB is overkill for a simple ordered array + pin set.

### Decision 2: Interaction tracking in localStorage (not IndexedDB)
**Rationale:** We only need aggregate counts per section (7 sections × ~50 bytes = 350 bytes). A rolling 30-day window of per-section stats fits easily in localStorage. No need for a Dexie schema migration.

### Decision 3: Section IDs as string enum (not numbers)
**Rationale:** Readable in localStorage, debuggable, self-documenting. Matches how the codebase identifies features (e.g., `'streak'`, `'recommended'`, `'stats'`).

### Decision 4: Intersection Observer for view tracking
**Rationale:** More accurate than scroll position math. Native browser API, zero dependencies. Records when sections are actually visible to the user.

### Decision 5: Follow AILearningPath.tsx dnd-kit pattern
**Rationale:** Consistency. AILearningPath already uses `DndContext` + `SortableContext` + `useSortable` with `PointerSensor` + `KeyboardSensor`. Reuse the same pattern for dashboard sections.

## Dashboard Section IDs

Current Overview.tsx has these sections in fixed order:

| Order | Section ID | Component(s) | Pinnable? |
|-------|-----------|---------------|-----------|
| 0 | `hero` | Greeting + ContinueLearning | Always first (locked) |
| 1 | `recommended` | RecommendedNext | Yes |
| 2 | `stats` | StatsCard grid + AchievementBanner | Yes |
| 3 | `engagement` | StudyStreakCalendar + StudyGoalsWidget + RecentActivity | Yes |
| 4 | `history` | StudyHistoryCalendar | Yes |
| 5 | `schedule` | StudyScheduleWidget | Yes |
| 6 | `insights` | ProgressChart + QuickActions | Yes |
| 7 | `library` | CourseCard gallery | Yes |

**Note:** `hero` is always pinned first and excluded from reordering. The import empty state renders conditionally inside the `library` section — no separate section ID needed.

## Implementation Steps

### Step 1: Define types and constants

**New file**: `src/lib/dashboardSections.ts`

```typescript
export const DASHBOARD_SECTIONS = [
  'hero',
  'recommended',
  'stats',
  'engagement',
  'history',
  'schedule',
  'insights',
  'library',
] as const

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]

export const DEFAULT_ORDER: DashboardSectionId[] = [...DASHBOARD_SECTIONS]

export const SECTION_LABELS: Record<DashboardSectionId, string> = {
  hero: 'Welcome',
  recommended: 'Recommended Next',
  stats: 'Metrics',
  engagement: 'Study Streak',
  history: 'Study History',
  schedule: 'Suggested Study Time',
  insights: 'Insights & Actions',
  library: 'Your Library',
}

// hero is always first, never reorderable
export const LOCKED_SECTIONS: DashboardSectionId[] = ['hero']
```

**AC coverage:** Foundation for AC1-6.

---

### Step 2: Create `useDashboardOrderStore`

**New file**: `src/stores/useDashboardOrderStore.ts`

**State shape:**
```typescript
interface SectionInteraction {
  views: number        // total times section was visible
  totalDuration: number // total seconds section was in viewport
  lastViewed: string   // ISO timestamp
}

interface DashboardOrderState {
  // Persisted state
  sectionOrder: DashboardSectionId[]     // current display order
  pinnedSections: DashboardSectionId[]   // pinned to top (after hero)
  interactions: Record<DashboardSectionId, SectionInteraction>
  isCustomized: boolean                   // true if user manually reordered or pinned
  autoReorderEnabled: boolean             // user can disable auto-reorder

  // Actions
  recordView: (sectionId: DashboardSectionId, durationSeconds: number) => void
  reorder: (fromIndex: number, toIndex: number) => void
  pinSection: (sectionId: DashboardSectionId) => void
  unpinSection: (sectionId: DashboardSectionId) => void
  resetToDefault: () => void
  computeAutoOrder: () => void
}
```

**Persistence:** Zustand `persist()` middleware with `localStorage` key `levelup-dashboard-order`.

**Relevance scoring algorithm** (for `computeAutoOrder`):
```
score(section) = frequency × log(1 + totalDuration) × recencyBonus
  where recencyBonus = 1 / (1 + daysSinceLastView / 7)
```

- Runs on page load if `autoReorderEnabled && !isCustomized`
- Only activates after 7+ days of interaction data (AC2)
- Pinned sections are placed first (after hero), then auto-ordered sections

**AC coverage:** AC1 (tracking), AC2 (auto-reorder), AC3 (manual reorder via `reorder()`), AC4 (pin), AC5 (reset).

---

### Step 3: Extract dashboard sections into sortable components

**Modified file**: `src/app/pages/Overview.tsx`

Refactor from inline JSX to a section registry pattern:

```typescript
const SECTION_COMPONENTS: Record<DashboardSectionId, React.FC<SectionProps>> = {
  hero: HeroSection,
  recommended: RecommendedSection,
  stats: MetricsSection,
  engagement: EngagementSection,
  history: HistorySection,
  schedule: ScheduleSection,
  insights: InsightsSection,
  library: LibrarySection,
}
```

Each section component:
- Receives `sectionId`, `isPinned`, `isLocked` props
- Wraps content in a `<DashboardSection>` wrapper that handles:
  - Intersection Observer for view tracking
  - Drag handle rendering
  - Context menu trigger
  - Section header with label + pin indicator

**New file**: `src/app/components/DashboardSection.tsx`

This wrapper component:
- Uses `useSortable()` from dnd-kit for drag behavior
- Uses `useRef` + `IntersectionObserver` to track visibility
- Calls `recordView()` on the store when section leaves viewport (records duration)
- Renders drag handle (GripVertical icon) on hover/focus
- Renders pin icon if `isPinned`

**AC coverage:** AC1 (intersection observer tracking), AC2 (dynamic rendering from ordered array), AC3 (sortable wrapper), AC6 (keyboard via dnd-kit).

---

### Step 4: Wire up DndContext in Overview.tsx

**Modified file**: `src/app/pages/Overview.tsx`

Follow the `AILearningPath.tsx` pattern:

```typescript
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
)
```

- Hero section renders OUTSIDE the DndContext (locked first)
- Remaining sections render inside `SortableContext` with `verticalListSortingStrategy`
- `onDragEnd` calls `store.reorder(oldIndex, newIndex)` and sets `isCustomized = true`
- Announce reorder via `aria-live="polite"` region

**AC coverage:** AC3 (drag-and-drop), AC6 (keyboard + aria-live).

---

### Step 5: Add section context menu

**New file**: `src/app/components/DashboardSectionMenu.tsx`

Uses shadcn/ui `ContextMenu` component (already in the project):

Menu items:
- **Pin to top** / **Unpin** (toggle based on current state)
- **Move up** / **Move down** (keyboard-friendly alternatives)
- **Reset all to default** (only when `isCustomized`)

Trigger: Right-click on section header area.

**AC coverage:** AC4 (pin to top), AC5 (reset to default).

---

### Step 6: Add "Reset to Default" button

**Modified file**: `src/app/pages/Overview.tsx`

- Render a subtle "Reset layout" link-button above the first sortable section
- Only visible when `isCustomized === true`
- Calls `store.resetToDefault()`
- Uses `text-muted-foreground hover:text-foreground` styling (non-intrusive)

**AC coverage:** AC5 (reset to default).

---

### Step 7: Auto-reorder on page load

**Modified file**: `src/app/pages/Overview.tsx`

```typescript
useEffect(() => {
  if (autoReorderEnabled && !isCustomized) {
    computeAutoOrder()
  }
}, []) // runs once on mount
```

The `computeAutoOrder` action in the store:
1. Checks if interactions span 7+ days
2. Calculates relevance score per section
3. Sorts non-locked, non-pinned sections by score descending
4. Updates `sectionOrder`

**AC coverage:** AC2 (auto-reorder after 7 days).

---

### Step 8: E2E tests

**New file**: `tests/e2e/story-e21-s06.spec.ts`

#### Test 8.1: Auto-reorder with seeded data (AC2)
- Seed `levelup-dashboard-order` localStorage with 7+ days of interaction data where `insights` has highest score
- Navigate to Overview
- Assert `insights` section appears before `history` section

#### Test 8.2: Drag-and-drop reorder (AC3)
- Navigate to Overview
- Drag `library` section upward
- Assert new order persists after reload

#### Test 8.3: Pin to top (AC4)
- Right-click on `schedule` section header
- Click "Pin to top"
- Assert `schedule` appears right after hero
- Assert pin indicator visible

#### Test 8.4: Reset to default (AC5)
- Seed customized order
- Navigate to Overview
- Click "Reset layout"
- Assert default order restored

#### Test 8.5: Keyboard reorder (AC6)
- Tab to drag handle
- Press Space, then ArrowUp
- Assert section moves up
- Verify aria-live announcement

#### Test 8.6: Interaction tracking (AC1)
- Navigate to Overview, scroll to `history` section
- Wait for it to be visible
- Check localStorage for recorded interaction

---

### Step 9: Unit tests

**New file**: `src/stores/__tests__/useDashboardOrderStore.test.ts`

- Test relevance scoring algorithm with mock data
- Test reorder logic (move section from index 3 to index 1)
- Test pin/unpin (pin adds to front after locked sections)
- Test reset clears all customization and interaction data
- Test auto-reorder only triggers after 7 days of data
- Test locked sections cannot be reordered

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/dashboardSections.ts` | Create | Section IDs, default order, labels |
| `src/stores/useDashboardOrderStore.ts` | Create | Zustand store with persist middleware |
| `src/app/components/DashboardSection.tsx` | Create | Sortable section wrapper with observer |
| `src/app/components/DashboardSectionMenu.tsx` | Create | Context menu (pin/unpin/move/reset) |
| `src/app/pages/Overview.tsx` | Modify | Refactor to dynamic section rendering |
| `src/stores/__tests__/useDashboardOrderStore.test.ts` | Create | Unit tests for store logic |
| `tests/e2e/story-e21-s06.spec.ts` | Create | E2E acceptance tests |

## What NOT to Change

- Dexie schema (`src/db/schema.ts`) — no migration needed
- Individual section component internals — only wrap them
- Existing E2E tests for Overview — section order changes shouldn't break them (they use text selectors, not position)
- Mobile layout — drag handles hidden; touch-and-hold deferred to future enhancement

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| dnd-kit performance with large sections | Use `verticalListSortingStrategy` (optimized for vertical lists) + `layoutId` animation |
| Intersection Observer memory leaks | Disconnect observer in useEffect cleanup |
| localStorage quota | Data is tiny (~600 bytes); use try/catch like `useOnboardingStore` |
| Breaking existing Overview E2E tests | Tests use text/role selectors, not DOM position; section content unchanged |
| Auto-reorder confusing users | Only after 7 days; clear "Reset layout" escape hatch; `isCustomized` flag |

## Build Sequence

1. **Step 1-2** (Foundation): Types + store — no UI changes, unit testable immediately
2. **Step 3** (Refactor): Extract sections — visual no-op, same rendering
3. **Step 4-6** (Features): DndContext + context menu + reset button
4. **Step 7** (Auto-reorder): Wire up the scoring algorithm
5. **Step 8-9** (Tests): E2E + unit tests
6. **Commit after each step group for reviewability**

## Verification

1. `npm run build` — passes
2. `npm run lint` — passes (no hardcoded colors)
3. `npm run test:unit` — passes (new store tests)
4. `npx playwright test tests/e2e/story-e21-s06.spec.ts --project=chromium` — E2E passes
5. `npx playwright test tests/e2e/overview.spec.ts --project=chromium` — existing tests unbroken
6. Visual check: sections reorderable via drag, pin icon shows, reset works
7. Keyboard check: Tab to handle → Space → ArrowUp → Space confirms reorder
