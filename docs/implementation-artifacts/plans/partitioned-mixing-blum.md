# Implementation Plan: E04-S03 Automatic Study Session Logging

## Context

**Why**: Users need automatic tracking of study sessions to understand their learning habits without manual effort. This builds on Stories E04-S01 (completion status) and E04-S02 (course progress) by adding time-based metrics — a critical foundation for future features like study streaks (Epic 5) and analytics dashboards (Epic 8).

**What**: Implement automatic session logging that captures when learners start/end study sessions, detects idle time (5min threshold), recovers orphaned sessions from browser crashes, and displays aggregate study time metrics on the Overview dashboard.

**Outcome**: Learners see total study time across all courses, sessions are resilient to browser crashes, and idle periods are excluded from duration calculations — providing accurate, low-friction study metrics.

---

## Data Schema

### 1. StudySession Type

**File**: `src/data/types.ts`

Add after `Screenshot` interface (~line 172):

```typescript
export interface StudySession {
  id: string                      // UUID
  courseId: string                // Parent course
  contentItemId: string           // Lesson/video/PDF ID
  startTime: string               // ISO 8601 timestamp
  endTime?: string                // ISO 8601 (undefined = active/orphaned)
  duration: number                // Active seconds (excludes idle time)
  idleTime: number                // Idle seconds detected
  videosWatched: string[]         // Video IDs watched during session
  lastActivity: string            // ISO 8601 of last interaction
  sessionType: 'video' | 'pdf' | 'mixed'
}
```

**Why `endTime` optional**: Enables orphan detection (sessions with start but no end indicate crash/force-close).

### 2. Dexie Schema Upgrade

**File**: `src/db/schema.ts`

Upgrade to version 6 (after v5 definition):

```typescript
db.version(6).stores({
  importedCourses: 'id, name, importedAt, status, *tags',
  importedVideos: 'id, courseId, filename',
  importedPdfs: 'id, courseId, filename',
  progress: '[courseId+videoId], courseId, videoId',
  bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
  screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
})
```

Update TypeScript declaration (~line 12):

```typescript
studySessions: EntityTable<StudySession, 'id'>  // Add this line
```

**Index strategy**: Compound `[courseId+contentItemId]` for lesson-specific queries, single indexes for aggregates.

---

## Zustand Session Store

### Create `src/stores/useSessionStore.ts`

Follow `useNoteStore.ts` pattern (optimistic updates + rollback):

**State**:
- `activeSession: StudySession | null` — Currently running session
- `sessions: StudySession[]` — All sessions (for stats)
- `isLoading`, `error`

**Key Actions**:

```typescript
startSession(courseId, contentItemId, sessionType): Promise<void>
  - Check if already active for this content
  - End any existing active session first
  - Create new session with crypto.randomUUID()
  - Optimistic update → persist to Dexie with persistWithRetry()

updateLastActivity(timestamp?: string): void
  - Update activeSession.lastActivity (called on user interactions)

pauseSession(): Promise<void>
  - Calculate active time since lastActivity
  - Add to duration (excludes idle time)
  - Persist to Dexie (debounced)

resumeSession(): void
  - Reset lastActivity to now (when user returns from idle)

endSession(): Promise<void>
  - Calculate final duration
  - Set endTime
  - Optimistic clear activeSession → persist final state

loadSessionStats(courseId?: string): Promise<void>
  - Load all sessions (or filtered by course) for stats

recoverOrphanedSessions(): Promise<void>
  - Find sessions where endTime is undefined
  - Close each with lastActivity timestamp
  - Calculate duration from startTime to lastActivity

getTotalStudyTime(courseId?: string): number
  - Sum all session durations (filters by course if provided)
```

**Pattern**: Matches existing stores with optimistic updates, rollback on failure, wrapped in `persistWithRetry()`.

---

## Session Lifecycle Integration

### Modify `src/app/pages/LessonPlayer.tsx`

**1. Import session store**:

```typescript
import { useSessionStore } from '@/stores/useSessionStore'
```

**2. Extract store actions** (after media query hooks ~line 71):

```typescript
const {
  activeSession,
  startSession,
  updateLastActivity,
  pauseSession,
  resumeSession,
  endSession,
} = useSessionStore()
```

**3. Start session on mount** (new useEffect after focus management ~line 245):

```typescript
// AC1: Start session when content loads
useEffect(() => {
  if (!courseId || !lessonId) return

  const sessionType = videoResource ? 'video' : primaryPdf ? 'pdf' : 'mixed'
  startSession(courseId, lessonId, sessionType)

  // Cleanup: end session on unmount
  return () => {
    endSession()
  }
}, [courseId, lessonId, startSession, endSession, videoResource, primaryPdf])
```

**4. Add visibility listeners** (new useEffect):

```typescript
// AC2: End session on navigation away / tab hidden
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      endSession()
    }
  }

  const handleBeforeUnload = () => {
    endSession()
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('pagehide', handleBeforeUnload)

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('beforeunload', handleBeforeUnload)
    window.removeEventListener('pagehide', handleBeforeUnload)
  }
}, [endSession])
```

---

## Idle Detection System

### Create `src/app/hooks/useIdleDetection.ts`

Custom hook for 5-minute idle detection:

```typescript
import { useEffect, useRef } from 'react'

const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

interface UseIdleDetectionOptions {
  onIdle: () => void
  onActive: () => void
  onActivity: () => void  // Every user interaction
}

export function useIdleDetection({ onIdle, onActive, onActivity }: UseIdleDetectionOptions) {
  const isIdleRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // If was idle, mark as active
      if (isIdleRef.current) {
        isIdleRef.current = false
        onActive()
      }

      onActivity()

      // Start new 5min timeout
      timeoutRef.current = setTimeout(() => {
        if (!isIdleRef.current) {
          isIdleRef.current = true
          onIdle()
        }
      }, IDLE_TIMEOUT_MS)
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']

    events.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true })
    })

    resetTimer()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      events.forEach(event => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [onIdle, onActive, onActivity])
}
```

### Wire up in LessonPlayer

**Import**:

```typescript
import { useIdleDetection } from '@/app/hooks/useIdleDetection'
```

**Add hook** (after session store hooks):

```typescript
useIdleDetection({
  onIdle: () => pauseSession(),
  onActive: () => resumeSession(),
  onActivity: () => updateLastActivity(),
})
```

**Why passive listeners**: Performance optimization — doesn't block scroll/touch events.

---

## Orphan Recovery

### Modify `src/app/App.tsx`

**Import**:

```typescript
import { useEffect } from 'react'
import { useSessionStore } from '@/stores/useSessionStore'
```

**Add recovery** (inside App component):

```typescript
const { recoverOrphanedSessions } = useSessionStore()

// AC5: Recover orphaned sessions on app init
useEffect(() => {
  recoverOrphanedSessions()
}, [recoverOrphanedSessions])
```

**Runs once on app mount**, before routes render. Silent operation.

---

## UI Display — Total Study Time

### Modify `src/app/pages/Overview.tsx`

**1. Import**:

```typescript
import { useSessionStore } from '@/stores/useSessionStore'
import { Clock } from 'lucide-react'
```

**2. Load session stats** (after existing hooks ~line 52):

```typescript
const { loadSessionStats, getTotalStudyTime } = useSessionStore()

useEffect(() => {
  loadSessionStats()
}, [loadSessionStats])

const totalStudyTimeSeconds = getTotalStudyTime()
const totalStudyTimeHours = Math.round((totalStudyTimeSeconds / 3600) * 10) / 10
```

**3. Add stat card** (modify statsCards array ~line 68):

```typescript
const statsCards = [
  {
    label: 'Courses Started',
    value: inProgress.length + completed.length,
    icon: BookOpen,
  },
  {
    label: 'Lessons Completed',
    value: completedLessons,
    icon: CheckCircle,
    trend: lessonsChange >= 0 ? ('up' as const) : ('down' as const),
    trendValue: `${Math.abs(lessonsChange)} this week`,
    sparkline: lessonSparkline,
  },
  {
    label: 'Total Study Time',
    value: `${totalStudyTimeHours}h`,
    icon: Clock,
  },
  // ... rest of cards
]
```

**Placement**: 3rd card (high visibility, dynamic metric).

---

## Implementation Sequence

### Phase 1: Foundation (30min)
1. Add `StudySession` type to `types.ts`
2. Upgrade Dexie schema to v6
3. Create `useSessionStore.ts` with basic CRUD
4. Test in browser DevTools (manually create/read sessions)

### Phase 2: Session Lifecycle (45min)
5. Create `useIdleDetection.ts` hook
6. Integrate session start/end in `LessonPlayer.tsx`
7. Add visibility/beforeunload listeners
8. Test session creation/closure manually

### Phase 3: Idle Detection (30min)
9. Wire up idle detection to pause/resume
10. Test 5-minute idle (reduce timeout for testing)
11. Verify duration excludes idle time

### Phase 4: Orphan Recovery (20min)
12. Add recovery to `App.tsx`
13. Test by creating orphaned session manually
14. Verify auto-close on app reload

### Phase 5: UI Display (30min)
15. Load stats in `Overview.tsx`
16. Add "Total Study Time" card
17. Format hours display
18. Verify updates after completing lessons

### Phase 6: Testing (45min)
19. Run E2E tests (`tests/e2e/story-e04-s03.spec.ts`)
20. Fix test failures
21. Manual QA (Chrome, Firefox, Safari)
22. Test mobile viewport (idle + visibility)

**Total**: ~3.5 hours

---

## Verification Steps

### Manual Testing:
1. Navigate to lesson → verify session created in DevTools (Application > IndexedDB > ElearningDB > studySessions)
2. Wait 5min idle → verify session paused (check duration in store)
3. Move mouse → verify session resumed
4. Navigate away → verify session closed with endTime
5. Force-quit browser → reopen → verify orphan closed
6. Check Overview → verify "Total Study Time" card displays hours

### E2E Tests:
```bash
npm run test:e2e -- story-e04-s03.spec.ts
```

Expected: All 5 AC tests pass (AC1-AC5).

### Edge Cases:
- Multiple tabs same lesson (expected: creates 2 sessions — out of scope for coordination)
- Mobile Safari backgrounded (expected: visibility listener ends session)
- IndexedDB quota exceeded (expected: `persistWithRetry` fails, error logged)

---

## Critical Files

| File | Purpose |
|------|---------|
| `src/data/types.ts` | StudySession interface |
| `src/db/schema.ts` | Dexie v6 upgrade |
| `src/stores/useSessionStore.ts` | Core session logic |
| `src/app/pages/LessonPlayer.tsx` | Lifecycle integration |
| `src/app/hooks/useIdleDetection.ts` | Idle timer |
| `src/app/App.tsx` | Orphan recovery |
| `src/app/pages/Overview.tsx` | UI display |
| `tests/e2e/story-e04-s03.spec.ts` | E2E tests (already created) |

---

## Design Rationale

**Why single active session?** One learning context at a time — prevents data fragmentation, matches user mental model.

**Why track `lastActivity` separately?** Browser crashes don't fire `beforeunload` — need last interaction timestamp for accurate orphan recovery.

**Why 5min idle threshold?** Balances false positives (too short) vs inflated metrics (too long). Matches typical "stepped away" behavior.

**Why not extend studyLog.ts?** `studyLog` tracks discrete events (lesson complete). Sessions are stateful entities with duration. Separate concerns.

**Performance impact**: Passive listeners + debounced writes (only on pause/end). Indexed Dexie queries O(log n). Stats load once on mount.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Browser crashes (no beforeunload) | Orphan recovery on next load (AC5) |
| Multiple tabs duplicate sessions | Out of scope (future: BroadcastChannel API) |
| Mobile background pauses timers | visibilitychange listener ends session |
| Video tracking (AC2 nested component) | Pass video ID via prop or lift session to VideoPlayer |

---

## Acceptance Criteria Coverage

- ✅ **AC1**: `startSession()` on LessonPlayer mount → persists to Dexie
- ✅ **AC2**: `endSession()` on navigation/visibility → records endTime + duration
- ✅ **AC3**: `useIdleDetection` pauses after 5min → resumes on activity → excludes idle time
- ✅ **AC4**: `getTotalStudyTime()` aggregates all sessions → displays on Overview
- ✅ **AC5**: `recoverOrphanedSessions()` on App init → closes with lastActivity timestamp

All 5 ACs addressed with concrete implementations.
