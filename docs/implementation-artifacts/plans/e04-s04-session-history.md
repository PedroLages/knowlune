# E04-S04: View Study Session History — Implementation Plan

## Context

Story E04-S04 adds a page where users can view their study session history with filtering, sorting, and expandable details. This builds on E04-S03 (Automatic Study Session Logging) which is now merged and provides the `StudySession` type, `useSessionStore`, and `studySessions` Dexie table.

**Critical data mismatch**: The ATDD tests (written before E04-S03 was implemented) seed sessions with `courseTitle`, `contentSummary`, `contentItems[]`, and millisecond timestamps. The real `StudySession` type uses ISO string timestamps, `courseId`, `contentItemId`, `videosWatched[]`, and has no denormalized title/summary fields. **The ATDD tests must be updated first** to match the real schema.

---

## Task 0: Update ATDD Tests to Match Real Schema

**Why**: Tests seed data that doesn't match the actual `StudySession` interface. Tests need to seed real `StudySession` objects plus `importedCourses`/`importedVideos` for name resolution.

**File**: `tests/e2e/story-e04-s04.spec.ts`

Changes:
- Update session seed data to use ISO string timestamps (`startTime: '2026-03-01T10:00:00.000Z'`)
- Replace `courseTitle` → rely on `courseId` + seeded `importedCourses`
- Replace `contentSummary` → derive from `videosWatched` + seeded `importedVideos`
- Replace `contentItems` → derive from `videosWatched` with timestamps
- Add `importedCourses` and `importedVideos` seeding in `beforeEach` or per-test
- Keep test expectations the same (they test what the page displays, not raw data)

---

## Task 1: Create SessionHistory Page + Route

**Files to create/modify**:
- `src/app/pages/SessionHistory.tsx` (new)
- `src/app/routes.tsx` (add route)
- `src/app/config/navigation.ts` (add sidebar item)

**Route**: `/session-history` (lazy-loaded, following existing pattern)

**Sidebar**: Add "Session History" with `History` icon right before "Reports" in `navigationItems` array. This groups it with the analytics/reflection cluster.

**Page structure** (following Courses.tsx pattern):
```
<div>
  <h1>Study Session History</h1>
  <FilterBar />        -- course select + date range inputs
  <SessionList />      -- or EmptyState
</div>
```

**Empty state** (AC 4): Use existing `EmptyState` component at `src/app/components/EmptyState.tsx`
- icon: `History` (from lucide-react)
- title: "No Study Sessions Yet"
- description: "Start learning to see your study history here"
- actionLabel: "Browse Courses"
- actionHref: "/courses"

---

## Task 2: Load & Display Sessions (AC 1)

**Data loading approach**:
1. Load sessions from `db.studySessions` (completed sessions only — where `endTime` exists)
2. Load courses from `db.importedCourses` to create a `courseId → name` lookup map
3. Load videos from `db.importedVideos` to resolve `videosWatched` → video titles
4. Sort by `startTime` descending (reverse chronological)

**Session entry display** (`data-testid="session-entry"`):
- Date (formatted from `startTime`)
- Duration (formatted as "Xh Ym" from `duration` seconds)
- Course title (resolved from `courseId` via course lookup)
- Content summary (derived from `videosWatched` → video titles, comma-separated)

**Duration formatter**: Create a `formatDuration(seconds: number): string` utility that returns "1h 30m", "45m", etc.

---

## Task 3: Course Filter (AC 2)

**Implementation**: Native `<select>` element (tests use `page.getByLabel('Filter by course').selectOption()`)
- Label: "Filter by course"
- Options: "All Courses" (default) + unique courses from loaded sessions
- Clear filter button: `<button>Clear filter</button>` (visible when filter is active)
- Filter persists in component state

---

## Task 4: Date Range Filter (AC 3)

**Implementation**: Two native `<input type="date">` elements (tests use `.getByLabel('Start date').fill()`)
- Labels: "Start date" and "End date"
- Filter by comparing session `startTime` against date range
- Works simultaneously with course filter

---

## Task 5: Pagination for Large Lists (AC 5)

**Implementation**: Simple "Show more" pagination (no external virtualization library needed)
- Initial display: 20 sessions
- "Show more" button loads 20 more
- All 100+ sessions renderable by scrolling and clicking "Show more"
- Tests just verify first and last entries are visible after scrolling

**Rationale**: Avoids adding a virtualization dependency. 100 DOM nodes is fine for performance. If future stories need 10k+ items, virtualization can be added then.

---

## Task 6: Expandable Session Details (AC 6)

**Implementation**: Clickable session entries that expand inline (Collapsible or custom state toggle)
- On click: toggle expanded state
- Expanded view shows:
  - Exact start time (formatted as "10:00 AM")
  - Exact end time (formatted as "11:30 AM")
  - Individual content items (videos watched) with timestamps
  - "Resume Course" link → `/courses/{courseId}` (or `/imported-courses/{courseId}`)

**Note**: `contentItems` in tests represent videos with their start timestamps. The real data has `videosWatched: string[]` (video IDs). For expanded view, resolve these to video titles.

---

## Key Existing Code to Reuse

| Code | Location | Purpose |
|------|----------|---------|
| `StudySession` type | `src/data/types.ts:173` | Session data model |
| `useSessionStore` | `src/stores/useSessionStore.ts` | `loadSessionStats()` for loading sessions |
| `db.studySessions` | `src/db/schema.ts` | Dexie table (v6) |
| `db.importedCourses` | `src/db/schema.ts` | Course name lookup |
| `db.importedVideos` | `src/db/schema.ts` | Video title lookup |
| `EmptyState` | `src/app/components/EmptyState.tsx` | Empty state display |
| Route pattern | `src/app/routes.tsx` | Lazy loading pattern |
| Page styling | `src/app/pages/Courses.tsx` | Card/filter layout patterns |
| Sidebar nav | `src/app/components/Layout.tsx` | Navigation item pattern |

---

## Implementation Order

1. **Update ATDD tests** to use real `StudySession` schema + seed courses/videos
2. **Create `SessionHistory.tsx`** page with empty state
3. **Add route** in `routes.tsx`
4. **Add sidebar link** in `Layout.tsx` (if applicable — check if Reports or a sub-nav is better)
5. **Implement session loading + display** (AC 1)
6. **Add course filter** (AC 2)
7. **Add date range filter** (AC 3)
8. **Add pagination** (AC 5)
9. **Add expandable details** (AC 6)
10. **Verify all ATDD tests pass**

Granular commits after each task.

---

## Verification

1. Run ATDD tests: `npx playwright test tests/e2e/story-e04-s04.spec.ts --project=chromium`
2. Visual check at http://localhost:5173/session-history
3. Build check: `npm run build`
