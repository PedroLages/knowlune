# E11-S06: Per-Course Study Reminders — Implementation Plan

## Context

LevelUp already has global streak reminders (Story 5.5) using localStorage + browser Notification API. This story adds **per-course** reminders — learners can set specific days and times for each course independently. The existing notification infrastructure is production-ready; we extend it with course-scoped scheduling stored in Dexie (IndexedDB).

**FR:** FR100 | **Complexity:** Medium | **Dependencies:** Story 5.5 (done), Epic 1 (done)

---

## Implementation Steps

### Step 1: Define types and Dexie schema v15

**Files:**
- `src/data/types.ts` — add `CourseReminder` interface
- `src/db/schema.ts` — add `courseReminders` table in v15

```typescript
// types.ts
interface CourseReminder {
  id: string              // UUID
  courseId: string         // FK to ImportedCourse.id
  courseName: string      // Denormalized for notification display
  days: string[]          // ['monday', 'wednesday', 'friday']
  time: string            // "HH:MM" format
  enabled: boolean
  createdAt: string       // ISO 8601
  updatedAt: string       // ISO 8601
}
```

Schema v15: `courseReminders: 'id, courseId'`

**Commit:** `feat(E11-S06): add CourseReminder type and Dexie v15 schema`

---

### Step 2: Create course reminder lib (`src/lib/courseReminders.ts`)

CRUD operations against Dexie + scheduling logic + notification sending.

**Key functions:**
- `getCourseReminders(): Promise<CourseReminder[]>`
- `getCourseRemindersByCourse(courseId): Promise<CourseReminder[]>`
- `saveCourseReminder(reminder): Promise<void>` — upsert + dispatch `'course-reminders-updated'` event
- `deleteCourseReminder(id): Promise<void>`
- `toggleCourseReminder(id, enabled): Promise<void>`
- `sendCourseReminder(reminder): void` — `new Notification('Time to study [courseName]!', { body, icon, tag: 'levelup-course-reminder-${courseId}' })`
- `shouldFireReminder(reminder, now): boolean` — check if current day/time matches reminder schedule
- `hasNotifiedCourseToday(courseId): boolean` — dedup via localStorage key `course-reminder-last-${courseId}`

**Reuse from `src/lib/studyReminders.ts`:**
- `getNotificationPermission()`
- `requestNotificationPermission()`
- `todayString()` pattern for dedup

**Commit:** `feat(E11-S06): course reminder CRUD and scheduling logic`

---

### Step 3: Create scheduler hook (`src/app/hooks/useCourseReminders.ts`)

Follows `useStudyReminders.ts` pattern — interval-based checking mounted in Layout.tsx.

- Single 60-second interval that iterates all enabled reminders
- For each: check if `shouldFireReminder()` and `!hasNotifiedCourseToday(courseId)`
- If match: `sendCourseReminder()` with course name + deep-link (`/courses/${courseId}`)
- Listen to `'course-reminders-updated'` event to reload reminders list
- Independent from streak reminders (separate hook, separate interval)

**Mount in:** `src/app/components/Layout.tsx` (after existing `useStudyReminders()`)

**Commit:** `feat(E11-S06): course reminder scheduler hook`

---

### Step 4: Build DaySelector component (`src/app/components/figma/DaySelector.tsx`)

Reusable pill-toggle day-of-week selector.

- 7 pill buttons (Mon–Sun) in flex row with `gap-2`
- Props: `selectedDays: string[]`, `onChange: (days: string[]) => void`
- Each pill: `role="checkbox"`, `aria-checked`, min 44x44px touch target
- Selected: `bg-brand text-brand-foreground`, Unselected: `bg-background border-border text-muted-foreground`
- Wrapped in `role="group" aria-label="Days of the week"`

**Commit:** `feat(E11-S06): DaySelector pill-toggle component`

---

### Step 5: Build CourseReminderRow component (`src/app/components/figma/CourseReminderRow.tsx`)

Individual reminder row with inline edit capability.

- Display mode: course name, schedule summary (Mon, Wed, Fri · 09:00), enable Switch, Edit button
- Edit mode: DaySelector + time input + Save/Cancel buttons
- `data-testid="course-reminder-{courseId}"`
- Enable/disable Switch with `aria-label="Enable {courseName} reminder"`

**Commit:** `feat(E11-S06): CourseReminderRow with inline edit`

---

### Step 6: Build CourseReminderSettings card (`src/app/components/figma/CourseReminderSettings.tsx`)

Main card component for Settings page. `data-testid="course-reminders-section"`

**Sections:**
1. **Permission banner** (conditional) — if `'default'`: info banner with "Enable Notifications" CTA. If `'denied'`: warning banner with browser settings guidance + "Continue without" link
2. **Reminder list** — maps `CourseReminderRow` for each reminder
3. **Empty state** — CalendarClock icon + "No course reminders yet" + Add button
4. **Add reminder form** — course Select (from imported courses via Dexie) + DaySelector + time input + Save/Cancel

**Permission flow:**
- On "Add Reminder" click: if permission is `'default'`, show permission prompt first
- If granted → show form. If denied → show guidance + "Continue without notifications" → show form anyway (AC4: save config regardless)
- Reuse `requestNotificationPermission()` from `src/lib/studyReminders.ts`

**Commit:** `feat(E11-S06): CourseReminderSettings card component`

---

### Step 7: Integrate into Settings page

**File:** `src/app/pages/Settings.tsx`

- Import `CourseReminderSettings`
- Insert `<CourseReminderSettings />` after `<ReminderSettings />` (line 555) and before `<AIConfigurationSettings />`

**Commit:** `feat(E11-S06): integrate course reminders into Settings page`

---

### Step 8: Wire up E2E tests and verify

- Run existing ATDD tests (`tests/e2e/story-e11-s06.spec.ts`) to verify they pass
- Adjust test selectors/assertions if implementation diverges from ATDD assumptions
- Verify notification permission mocking works correctly

**Commit:** `test(E11-S06): fix ATDD tests for final implementation`

---

## Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Storage | Dexie (not localStorage) | Multiple reminders per course = structured data, not a single JSON blob |
| Scheduling | Single 60s interval checking all reminders | Simpler than N timers; matches existing pattern |
| Dedup | localStorage per-course date keys | Same pattern as streak reminders; prevents multi-tab dupes |
| Deep-link | `/courses/${courseId}` in notification data | Direct navigation to course detail page |
| UX tone | "Time to study [Course]!" | Supportive, not guilt-tripping (per UX spec) |
| Permission handling | Save config even if denied | AC4 explicitly requires this |

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/courseReminders.ts` | CRUD + scheduling + notification logic |
| `src/app/hooks/useCourseReminders.ts` | Scheduler hook for Layout.tsx |
| `src/app/components/figma/DaySelector.tsx` | Reusable day-of-week pill selector |
| `src/app/components/figma/CourseReminderRow.tsx` | Individual reminder row with inline edit |
| `src/app/components/figma/CourseReminderSettings.tsx` | Main card for Settings page |

## Files to Modify

| File | Change |
|------|--------|
| `src/data/types.ts` | Add `CourseReminder` interface |
| `src/db/schema.ts` | Add v15 with `courseReminders` table |
| `src/app/components/Layout.tsx` | Mount `useCourseReminders()` hook |
| `src/app/pages/Settings.tsx` | Import + render `<CourseReminderSettings />` |

## Reuse Existing Code

| What | From | Usage |
|------|------|-------|
| `getNotificationPermission()` | `src/lib/studyReminders.ts` | Permission checking |
| `requestNotificationPermission()` | `src/lib/studyReminders.ts` | Permission requesting |
| `todayString()` | `src/lib/studyReminders.ts` | Dedup date key generation |
| `Switch` component | `src/app/components/ui/switch` | Enable/disable toggles |
| `Card/CardHeader/CardContent` | `src/app/components/ui/card` | Settings card layout |
| `Select` component | `src/app/components/ui/select` | Course selection dropdown |
| `db` (Dexie instance) | `src/db/` | IndexedDB operations |

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations (design tokens, no hardcoded colors)
3. `npx playwright test tests/e2e/story-e11-s06.spec.ts --project=chromium` — ATDD tests pass
4. Manual: Settings → Course Reminders → add reminder → verify notification fires at configured time
5. Manual: Verify streak reminders still fire independently (AC3)
