---
story_id: E50-S01
story_name: "Study Schedule Data Model"
status: done
started: 2026-04-04
completed: 2026-04-04
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 50.01: Study Schedule Data Model

## Story

As a learner,
I want my study schedules stored reliably with full CRUD operations,
So that I can create, edit, and delete recurring study blocks that persist across sessions.

## Acceptance Criteria

**AC1:** Given a fresh database, when the app starts, then Dexie v36 creates the `studySchedules` table without errors.

**AC2:** Given a user calls `addSchedule()` with title, days, and startTime, when the schedule is saved, then a new record is persisted in Dexie with auto-generated id, createdAt, updatedAt, and default durationMinutes=60.

**AC3:** Given an existing schedule, when `updateSchedule()` is called with partial updates, then the record is updated in Dexie and `updatedAt` is refreshed.

**AC4:** Given an existing schedule, when `deleteSchedule()` is called, then the record is removed from Dexie and the store state.

**AC5:** Given schedules exist for multiple days, when `getSchedulesForDay('monday')` is called, then only schedules with 'monday' in their `days` array are returned.

## Tasks / Subtasks

- [x] Task 1: Add `StudySchedule` interface to types (AC: 1, 2)
  - [x] 1.1 Add `StudySchedule` interface after `CourseReminder` (line ~399) in `src/data/types.ts`
  - [x] 1.2 Fields: id (string UUID), courseId? (string), learningPathId? (string), title (string), days (DayOfWeek[]), startTime (string "HH:MM"), durationMinutes (number, default 60), recurrence ('weekly' | 'daily'), reminderMinutes (number, default 15), enabled (boolean), timezone (string IANA), createdAt (string ISO), updatedAt (string ISO). NOTE: `'once'` recurrence removed from Phase 1-2 — one-time events need a `date` field which is deferred to Phase 3 (Edge case review HIGH EC-34)
  - [x] 1.3 Reuse existing `DayOfWeek` type from `src/data/types.ts:381-388`

- [x] Task 2: Add `studySchedules` table to Dexie v36 (AC: 1)
  - [x] 2.1 Add `studySchedules: EntityTable<StudySchedule, 'id'>` to the `ElearningDatabase` type in `src/db/schema.ts` (around line 66)
  - [x] 2.2 Add `StudySchedule` to the import list from `@/data/types` at top of `src/db/schema.ts`
  - [x] 2.3 Add v36 declaration: `database.version(36).stores({ studySchedules: 'id, courseId, learningPathId, enabled' })`
  - [x] 2.4 Do NOT update `src/db/checkpoint.ts` — stays at v27

- [x] Task 3: Create `useStudyScheduleStore` Zustand store (AC: 2, 3, 4, 5)
  - [x] 3.1 Create `src/stores/useStudyScheduleStore.ts` following `useFlashcardStore.ts` pattern
  - [x] 3.2 State: `schedules: StudySchedule[]`, `isLoaded: boolean`
  - [x] 3.3 Implement `loadSchedules()` — reads all from Dexie
  - [x] 3.4 Implement `addSchedule(schedule: Omit<StudySchedule, 'id' | 'createdAt' | 'updatedAt'>)` — generates UUID via `crypto.randomUUID()`, sets timestamps, writes to Dexie
  - [x] 3.5 Implement `updateSchedule(id: string, updates: Partial<StudySchedule>)` — updates Dexie record, refreshes `updatedAt`, updates local state
  - [x] 3.6 Implement `deleteSchedule(id: string)` — removes from Dexie and local state
  - [x] 3.7 Implement `getSchedulesForDay(day: DayOfWeek, enabledOnly?: boolean)` — filtered getter (default: enabled only)
  - [x] 3.8 Implement `getSchedulesForCourse(courseId: string, enabledOnly?: boolean)` — filtered getter (default: enabled only)
  - [x] 3.9 Default `timezone` to `Intl.DateTimeFormat().resolvedOptions().timeZone`

## Implementation Notes

**Architecture decisions:**
- Separate `StudySchedule` from `CourseReminder` — different concerns (calendar scheduling vs notification triggers). `CourseReminder` remains untouched.
- `courseId` is optional to support free-form study blocks not linked to any course.
- `learningPathId` is included for future learning-path-level scheduling (UI deferred to Phase 3+).
- Dexie v36 is incremental — no checkpoint update needed. Dexie auto-creates new tables for fresh installs via the migration chain. (Story was planned at v28; actual landing version is v36 due to other epics shipped concurrently.)

**Key files:**
- `src/data/types.ts` — Add `StudySchedule` interface (after line ~399)
- `src/db/schema.ts` — Add v36 declaration and EntityTable type
- `src/stores/useStudyScheduleStore.ts` — NEW file
- Reference pattern: `src/stores/useFlashcardStore.ts` (full CRUD with add/update/delete)
- Reference pattern: `src/stores/useCourseStore.ts` (simple read-only store)

**Dependencies:**
- None (foundation story)

## Testing Notes

**E2E tests:**
- Verify Dexie v36 migration succeeds on fresh database
- Verify schedule CRUD through store: add → read → update → delete
- Verify `getSchedulesForDay()` filtering returns correct subset

**Unit tests:**
- `addSchedule()` generates UUID and timestamps
- `updateSchedule()` refreshes `updatedAt`
- `deleteSchedule()` removes from state
- `getSchedulesForDay()` filters by day correctly
- `getSchedulesForCourse()` filters by courseId correctly
- Default timezone is set from `Intl.DateTimeFormat`

**Edge cases:**
- Schedule with empty `days` array
- Schedule with all 7 days selected
- Multiple schedules for the same course
- Free-form schedule (no courseId)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- **Dexie version drift**: Story was designed targeting v28 but shipped at v36 due to parallel epics. Always confirm the current schema version in `src/db/schema.ts` before referencing it in story files — the planned version becomes stale quickly in a fast-moving codebase.

- **Timezone default belongs in the store, not the caller**: `addSchedule()` now defaults `timezone` to `Intl.DateTimeFormat().resolvedOptions().timeZone` so callers never need to supply it. This prevents silent omission — Dexie records would have had an empty timezone field if the UI forgot to pass it.

- **Getter enabled-filtering should default to true**: `getSchedulesForDay` and `getSchedulesForCourse` now accept an optional `enabledOnly` parameter (default `true`). Without this, every downstream consumer would have to remember to filter on `s.enabled`, creating duplicated logic and easy-to-miss bugs when disabled schedules leaked into calendar views.
