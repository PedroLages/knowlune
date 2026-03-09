# Implementation Plan: E07-S04 — At-Risk Course Detection & Completion Estimates

## Context

LevelUp's momentum system (Story E07-S01) already tracks course engagement with hot/warm/cold indicators. However, users lack visibility into:
1. **Neglected courses** that are falling behind (14+ days without study)
2. **Completion time estimates** to plan their study schedule realistically

This story adds two critical metrics to help learners stay on track:
- **At-Risk Detection**: Visual warnings when courses have 14+ days inactivity AND momentum < 20
- **Completion Estimates**: Predicted sessions/days needed to finish, based on personal study pace

These features integrate seamlessly with the existing momentum system and require NO new database tables — all data comes from existing `studySessions` and course progress in IndexedDB/localStorage.

## Dependencies Status

✅ **All prerequisite stories completed:**
- E07-S01: Momentum Score Calculation (provides score < 20 threshold)
- E07-S02: Recommended Next Dashboard (course card rendering patterns)
- E07-S03: Next Course Suggestion (sorting patterns)
- E07-S05: Smart Study Schedule (30-day average pace calculation patterns)

## Implementation Approach

### 1. Create At-Risk Detection Logic (`src/lib/atRisk.ts`)

**New module** with pure calculation functions following the momentum.ts pattern:

```typescript
export interface AtRiskStatus {
  isAtRisk: boolean
  daysSinceLastSession: number
  momentumScore: number
}

export function calculateAtRiskStatus(
  sessions: StudySession[],
  momentumScore: MomentumScore
): AtRiskStatus {
  // Logic:
  // 1. Find most recent session startTime
  // 2. Calculate days since last session
  // 3. At-risk if: daysSinceLast >= 14 AND momentumScore.score < 20
  // 4. Return { isAtRisk, daysSinceLastSession, momentumScore }
}
```

**Why this approach:**
- Reuses existing session data (no DB changes)
- Follows momentum.ts pattern (pure calculation, batch-efficient)
- Accepts pre-loaded sessions array from parent

### 2. Create Completion Estimate Logic (`src/lib/completionEstimate.ts`)

**New module** for time-to-completion predictions:

```typescript
export interface CompletionEstimate {
  sessionsNeeded: number
  estimatedDays: number
  averageSessionMinutes: number
  remainingMinutes: number
}

export function calculateCompletionEstimate(
  sessions: StudySession[],
  remainingContentMinutes: number
): CompletionEstimate {
  // Logic:
  // 1. Filter sessions to last 30 days (pattern from momentum.ts)
  // 2. Calculate average session duration: sum(durations) / count
  // 3. If no sessions, use default: 30 minutes per session (AC4)
  // 4. sessionsNeeded = remainingMinutes / avgSessionMinutes
  // 5. estimatedDays = sessionsNeeded (assumes 1 session/day)
  // 6. Return all metrics for flexible display
}
```

**Why this approach:**
- 30-day window matches momentum calculation (consistency)
- Default 30 min/session handles new users (AC4)
- Returns rich data for UI flexibility (show sessions OR days)

### 3. Create At-Risk Badge Component (`src/app/components/figma/AtRiskBadge.tsx`)

**Mirror MomentumBadge.tsx structure:**

```typescript
interface AtRiskBadgeProps {
  daysSinceLastSession: number
  className?: string
}

export function AtRiskBadge({ daysSinceLastSession, className }: AtRiskBadgeProps) {
  // Pattern from MomentumBadge:
  // - Use AlertTriangle icon from lucide-react
  // - Badge from shadcn/ui with custom styling
  // - Tooltip showing "No activity for {days} days"
  // - data-testid="at-risk-badge"
}
```

**Styling** (distinct from momentum colors per AC1):
- Background: `bg-orange-50 dark:bg-orange-900/30`
- Text: `text-orange-700 dark:text-orange-300`
- Border: Optional `border-orange-200`
- Icon: `AlertTriangle` (warning icon, distinct from flame/sun/snowflake)

**Why this approach:**
- Reuses shadcn Badge + Tooltip patterns from MomentumBadge
- Visual distinction via orange warning color (distinct from hot=orange-500, warm=yellow, cold=gray)
- Accessible with aria-label and testid

### 4. Create Completion Time Display Component (`src/app/components/figma/CompletionEstimate.tsx`)

**Simple text component** with Clock icon:

```typescript
interface CompletionEstimateProps {
  sessionsNeeded: number
  estimatedDays: number
  className?: string
}

export function CompletionEstimate({ sessionsNeeded, estimatedDays, className }: CompletionEstimateProps) {
  // Display format:
  // "Est. ~{sessionsNeeded} sessions" (if < 10 sessions)
  // "Est. ~{estimatedDays} days" (if >= 10 sessions)
  // Use Clock icon from lucide-react
  // data-testid="completion-estimate"
}
```

**Why this approach:**
- Simple text display, no complex UI needed
- Clock icon matches existing duration displays
- Adaptive format (sessions vs days) for readability

### 5. Enhance Courses.tsx Data Loading

**Add calculations** alongside existing momentum calculation:

```typescript
useEffect(() => {
  const loadCourseMetrics = async () => {
    const sessions = await db.studySessions.toArray()
    const sessionsByCourse = new Map<string, StudySession[]>()

    // Group sessions by courseId (existing pattern)
    for (const s of sessions) {
      const arr = sessionsByCourse.get(s.courseId) ?? []
      arr.push(s)
      sessionsByCourse.set(s.courseId, arr)
    }

    // Calculate metrics for each course
    const momentumMap = new Map<string, MomentumScore>()
    const atRiskMap = new Map<string, AtRiskStatus>()
    const estimateMap = new Map<string, CompletionEstimate>()

    for (const course of allCourses) {
      const courseSessions = sessionsByCourse.get(course.id) ?? []

      // Momentum (existing)
      const momentum = calculateMomentumScore({...})
      momentumMap.set(course.id, momentum)

      // At-risk detection (NEW)
      const atRisk = calculateAtRiskStatus(courseSessions, momentum)
      atRiskMap.set(course.id, atRisk)

      // Completion estimate (NEW)
      const remaining = getRemainingContentMinutes(course)
      const estimate = calculateCompletionEstimate(courseSessions, remaining)
      estimateMap.set(course.id, estimate)
    }

    setMomentumMap(momentumMap)
    setAtRiskMap(atRiskMap)
    setEstimateMap(estimateMap)
  }

  loadCourseMetrics()
}, [allCourses])
```

**Helper function** for remaining content:

```typescript
function getRemainingContentMinutes(course: Course): number {
  const progress = getProgress(course.id)
  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
  const remainingLessons = totalLessons - progress.completedLessons.length

  // Estimate 15 min per lesson (existing pattern from progress.ts)
  return remainingLessons * 15
}
```

**Why this approach:**
- Single batch load of sessions (efficient)
- Reuses existing grouping pattern
- All calculations happen together (no multiple loops)
- State updates trigger re-render

### 6. Update CourseCard Component Props & Rendering

**Extend props interface:**

```typescript
interface CourseCardProps {
  // ... existing props
  momentumScore?: MomentumScore
  atRiskStatus?: AtRiskStatus  // NEW
  completionEstimate?: CompletionEstimate  // NEW
}
```

**Add rendering logic** (library variant only):

```typescript
// Inside CourseCard.tsx render, after thumbnail section:

{variant === 'library' && (
  <>
    {/* Existing: Category badge (top-left) */}
    {/* Existing: Momentum badge (top-right) */}

    {/* NEW: At-risk badge (below momentum, or bottom-left) */}
    {atRiskStatus?.isAtRisk && (
      <AtRiskBadge
        daysSinceLastSession={atRiskStatus.daysSinceLastSession}
        className="absolute bottom-2 left-2"
      />
    )}
  </>
)}

{/* In card body section, after lesson count: */}
{completionEstimate && (
  <CompletionEstimate
    sessionsNeeded={completionEstimate.sessionsNeeded}
    estimatedDays={completionEstimate.estimatedDays}
    className="mt-1"
  />
)}
```

**Why this approach:**
- Library variant only (overview/progress don't need these badges)
- Absolute positioning for at-risk badge (distinct from momentum)
- Completion estimate flows naturally in card body with other metadata

### 7. Update ATDD Tests

**Tests already created** at `tests/e2e/story-e07-s04.spec.ts` covering:
- AC1: At-risk badge displayed (14+ days, momentum < 20)
- AC2: Badge removed when conditions change
- AC3: Completion time estimate displayed
- AC4: Default 30-min pace for new users
- AC5: Both indicators visible without overlap
- AC6: At-risk courses at bottom when sorted

**Implementation needs** to satisfy these tests:
- Add `data-testid="at-risk-badge"` to AtRiskBadge
- Add `data-testid="completion-estimate"` to CompletionEstimate
- Ensure CSS positioning prevents overlap (AC5)
- Momentum sort already works (AC6) — at-risk courses naturally sink (score < 20)

## Critical Files

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/atRisk.ts` | CREATE | At-risk detection logic |
| `src/lib/completionEstimate.ts` | CREATE | Completion time calculation |
| `src/app/components/figma/AtRiskBadge.tsx` | CREATE | At-risk badge UI component |
| `src/app/components/figma/CompletionEstimate.tsx` | CREATE | Completion time display |
| `src/app/pages/Courses.tsx` | MODIFY | Add metrics calculation to useEffect |
| `src/app/components/figma/CourseCard.tsx` | MODIFY | Add new props and render badges/estimate |
| `tests/e2e/story-e07-s04.spec.ts` | EXISTS | ATDD tests (already created) |

## Reusable Patterns & Utilities

**Momentum calculation pattern** (`src/lib/momentum.ts`):
- Pure function accepting sessions array
- 30-day filtering: `thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000`
- Days since last: `(now - latestMs) / (1000 * 60 * 60 * 24)`

**Badge pattern** (`src/app/components/figma/MomentumBadge.tsx`):
- shadcn Badge + Tooltip wrapper
- Custom colors via CSS classes
- aria-label for accessibility
- data-testid for E2E tests

**Session grouping** (`src/app/pages/Courses.tsx`, existing):
- Map sessions by courseId in single loop
- Batch calculations to avoid N+1 queries

**Date utilities** (`src/lib/dateUtils.ts`):
- `toLocalDateString()` for YYYY-MM-DD format
- Follow ISO 8601 patterns

## Design Tokens

**Colors** (from `src/styles/theme.css`):
- At-risk warning: `bg-orange-50 text-orange-700` (light) / `bg-orange-900/30 text-orange-300` (dark)
- Distinct from momentum: hot=orange-500, warm=yellow-500, cold=gray-400

**Icons** (lucide-react):
- At-risk: `AlertTriangle` (warning icon)
- Completion: `Clock` (matches existing duration displays)

**Typography**:
- Badge text: `text-xs font-medium`
- Estimate text: `text-sm text-gray-500`

**Spacing**:
- Badge padding: `px-1.5 py-0.5`
- Badge placement: `absolute bottom-2 left-2` (distinct from top-right momentum)
- Estimate margin: `mt-1` (flows with card body)

## Verification Plan

### 1. Build & Lint
```bash
npm run build
npm run lint
```

### 2. E2E Tests
```bash
npx playwright test tests/e2e/story-e07-s04.spec.ts --project=chromium
```

**Expected results:**
- ✅ AC1: At-risk badge visible for 15-day old sessions
- ✅ AC2: Badge removed after recent session added
- ✅ AC3: Completion estimate displayed with remaining time
- ✅ AC4: Default 30 min/session used for new users
- ✅ AC5: No visual overlap between badges/estimate
- ✅ AC6: At-risk courses sort to bottom by momentum

### 3. Visual Verification (Manual)
1. Import courses and create old sessions (14+ days ago) via IndexedDB DevTools
2. Navigate to `/courses`
3. Verify:
   - Orange "At Risk" badge appears on neglected courses
   - Completion time estimate shows (e.g., "Est. ~3 sessions")
   - Both indicators visible without overlap
   - Momentum sort places at-risk courses at bottom

### 4. Edge Cases
- **New user** (no sessions): Completion estimate shows default 30 min/session
- **Completed course** (100%): No completion estimate shown (0 remaining)
- **Recent session added**: At-risk badge disappears if momentum recalcs to 20+

## Implementation Notes

### Granular Commits Strategy
Make save-point commits after each task:
1. `feat(at-risk): add at-risk detection logic`
2. `feat(completion): add completion estimate calculation`
3. `feat(ui): add AtRiskBadge component`
4. `feat(ui): add CompletionEstimate component`
5. `feat(courses): integrate metrics into Courses page`
6. `feat(course-card): display at-risk and estimate badges`
7. `test(e07-s04): verify all acceptance criteria pass`

### No Database Changes
All data comes from existing sources:
- Study sessions: `db.studySessions` (IndexedDB)
- Course progress: `getProgress(courseId)` (localStorage)
- Course metadata: Static `Course` objects

### Reactivity
Momentum system already dispatches `study-log-updated` event. At-risk and estimate calculations will trigger automatically on:
- Page reload
- Course progress update
- Study session recorded

## Trade-offs & Decisions

**Decision 1: Separate calculation modules vs single file**
- ✅ **Chosen**: Separate files (`atRisk.ts`, `completionEstimate.ts`)
- **Why**: Each has distinct concerns; easier to test and maintain separately
- **Alternative**: Single `courseMetrics.ts` — would work but less modular

**Decision 2: Badge placement (absolute vs flex layout)**
- ✅ **Chosen**: Absolute positioning for at-risk badge (bottom-left)
- **Why**: Ensures no overlap with momentum (top-right) per AC5
- **Alternative**: Flex layout — harder to guarantee no overlap

**Decision 3: Default session duration**
- ✅ **Chosen**: 30 minutes (per AC4 specification)
- **Why**: Matches existing pattern from E07-S05 (Smart Study Schedule)
- **Alternative**: 45 min — arbitrary, not aligned with story AC

**Decision 4: Display format (sessions vs days)**
- ✅ **Chosen**: Adaptive — sessions if < 10, days if >= 10
- **Why**: Short estimates feel concrete ("3 sessions"), long ones need scale ("12 days")
- **Alternative**: Always show sessions — "30 sessions" feels less actionable

## Constraints & Assumptions

**Constraints:**
- Must not overlap momentum badge (AC5)
- Must use 30-day rolling window (consistency with momentum)
- Must handle new users (AC4 default pace)
- Must trigger removal when momentum recalcs (AC2)

**Assumptions:**
- Users study ~1 session per day (estimatedDays = sessionsNeeded)
- 15 min/lesson is reasonable estimate (existing pattern)
- At-risk threshold (14 days, momentum < 20) is fixed (no user config)

## Questions & Clarifications

**Q1:** Should completion estimate show for 100% complete courses?
**A:** No — AC3 specifies "remaining uncompleted content". If 0 remaining, hide estimate.

**Q2:** What if a course has 0 lessons (imported course with only PDFs)?
**A:** Treat as 0 remaining minutes → no estimate shown.

**Q3:** Should at-risk badge show on overview/progress variants?
**A:** No — focus on library variant where sorting/filtering happens.

## Timeline Estimate

**Simple implementation** — 4 focused tasks:
1. **Task 1**: At-risk detection logic (~30 min)
2. **Task 2**: Completion estimate logic (~30 min)
3. **Task 3**: UI components (badges) (~45 min)
4. **Task 4**: Integration (Courses.tsx + CourseCard.tsx) (~45 min)

**Total:** ~2.5 hours of focused development + testing.

**Confidence:** High — all dependencies done, patterns established, tests already written.
