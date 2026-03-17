## Test Coverage Review: E11-S06 — Per-Course Study Reminders

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/6 ACs tested (**83%**)

**COVERAGE GATE:** PASS (>=80%) — Story meets the minimum threshold. One gap remains that warrants attention.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Configure reminder with day/time selection | None | `tests/e2e/story-e11-s06.spec.ts:94` | Covered |
| 2 | Browser notification delivery with course deep-link | None | None | **Gap** |
| 3 | Independence from streak reminders | None | `tests/e2e/story-e11-s06.spec.ts:136` | Partial |
| 4 | Notification permission prompt and graceful handling | None | `tests/e2e/story-e11-s06.spec.ts:171`, `:196` | Covered |
| 5 | Edit and disable reminders | None | `tests/e2e/story-e11-s06.spec.ts:224` | Covered |
| 6 | Multi-course reminder overview | None | `tests/e2e/story-e11-s06.spec.ts:273` | Covered |

**Coverage**: 5/6 ACs with at least one test | 1 gap (AC2) | 1 partial (AC3)

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC2: "Browser notification delivery with course deep-link" has zero test coverage. The file header at `tests/e2e/story-e11-s06.spec.ts:1-10` explicitly omits AC2 from its verifies list. The implementation in `src/lib/courseReminders.ts:102-113` shows `sendCourseReminder` constructs a `Notification` with `data: { url: '/courses/${reminder.courseId}' }` — the deep-link payload is never asserted anywhere. The scheduling logic in `src/app/hooks/useCourseReminders.ts:33-42` that drives the 60-second interval loop is also untested.

  Suggested test: `courseReminders.unit.test.ts` in `src/lib/__tests__/` with these cases:
  - `sendCourseReminder` constructs a `Notification` with title containing the course name, `tag` set to `levelup-course-reminder-{courseId}`, and `data.url` equal to `/courses/{courseId}`
  - `sendCourseReminder` does nothing when `getNotificationPermission()` returns `'denied'`
  - `shouldFireReminder` fires within the 0–1 minute window and not outside it (boundary at minute=0, minute=1, minute=2)
  - `hasNotifiedCourseToday`/`markNotifiedCourseToday` round-trip using the correct localStorage key prefix `course-reminder-last-{courseId}`

#### High Priority

- **`tests/e2e/story-e11-s06.spec.ts:136-169` (confidence: 82)** — AC3 independence test only verifies that both UI sections render separately and that the streak section's switch is checked. It does not verify that the scheduling hooks for streak reminders (`useStudyReminders`) and course reminders (`useCourseReminders`) are distinct — i.e., that disabling or toggling one does not suppress the other. The test is a visual co-existence check, not a behavioral independence check. The core independence claim (each reminder fires independently at its configured time, neither suppresses the other) is only present in the implementation via separate hooks (`src/app/hooks/useCourseReminders.ts` and the pre-existing `useStudyReminders`) but has no corresponding assertion.

  Fix: Add a unit test in `src/lib/__tests__/courseReminders.unit.test.ts` that seeds both a streak reminder state (in `localStorage['study-reminders']`) and a `CourseReminder`, then asserts that `shouldFireReminder` for the course reminder evaluates independently of the streak reminder flag.

- **`tests/e2e/story-e11-s06.spec.ts:196-222` (confidence: 78)** — The AC4 "saves config regardless of permission denial" test title claims to verify that the reminder is saved when permission is denied (AC4 states: "the reminder configuration is saved regardless of permission status"). However, the test only verifies that the denied-guidance banner and "Continue without notifications" button are visible after a denied permission request. It does not proceed to actually fill out and save the reminder form, nor assert that the saved reminder appears in the list. The AC's core claim — persistence independent of permission — goes unasserted.

  Fix: After clicking "Continue without notifications" at line 221, complete the form flow (select course, select days, fill time, save), then assert the reminder appears in the list. This would fully prove AC4's "saved regardless of permission status" guarantee.

- **`tests/e2e/story-e11-s06.spec.ts:94-134` (confidence: 72)** — AC1 verification checks that course name, day abbreviations (`/mon.*wed.*fri/i`), and time text appear in the section, but never asserts persistence. After saving, there is no page reload followed by a re-check that the reminder survives. Without this, the test only covers in-memory display, not the Dexie persistence layer.

  Fix: After the save assertion block, add `await page.reload()` and re-assert the same three text assertions. This confirms the reminder was written to IndexedDB via `saveCourseReminder`.

#### Medium

- **`tests/e2e/story-e11-s06.spec.ts:19-32` (confidence: 68)** — The `createImportedCourse` helper is an inline factory function that duplicates the pattern of `tests/support/fixtures/factories/imported-course-factory.ts` (which exports `createImportedCourse`). The existing factory should be used instead. The inline version uses string template literals for the name (`Test Course ${id}`) which can generate confusing names in failures. No `CourseReminder` factory exists at all in `tests/support/fixtures/factories/` — the reminder seeds are built inline with bare object literals at lines 228-237 and 275-296.

  Fix: Create `tests/support/fixtures/factories/course-reminder-factory.ts` exporting `createCourseReminder(overrides)`, returning a well-typed `CourseReminder` with realistic defaults. Replace the inline helpers at lines 52-57 and the two seed call-sites.

- **`src/db/__tests__/schema.test.ts:47-71` (confidence: 65)** — The schema test at line 49 verifies that `courseReminders` appears in the table list and that `db.verno` equals 15, which confirms the migration ran. However, there are no CRUD tests for the `courseReminders` table itself — no add, no query by `courseId`, no delete test equivalent to those written for `importedCourses` (lines 74-131) and `challenges` (lines 208-262). Given that `getCourseRemindersByCourse` in `src/lib/courseReminders.ts:30-32` uses a `where('courseId')` index, that index path is never exercised in any unit test.

  Fix: Add a `describe('courseReminders table')` block in `src/db/__tests__/schema.test.ts` with: add/retrieve by id, query by `courseId` index, update `enabled` field, delete by id.

- **`tests/e2e/story-e11-s06.spec.ts:82-92` (confidence: 60)** — The `beforeEach` navigates to `/`, sets localStorage, seeds courses, and reloads. However, it does not clear the `courseReminders` IndexedDB store between tests. Tests that seed their own reminders (AC5 at line 226-237, AC6 at line 275-296) could contaminate subsequent tests if run out of order, because `seedIndexedDBStore` uses `store.put()` (upsert) without first clearing. The AC1 test also runs after `beforeEach` and would see any leftover reminders from a failed prior test.

  Fix: Add `await clearIndexedDBStore(page, 'ElearningDB', 'courseReminders')` inside `beforeEach` after the existing `seedTwoCourses` call. The `clearIndexedDBStore` helper is already defined at `tests/support/helpers/indexeddb-seed.ts:164`.

#### Nits

- **Nit** `tests/e2e/story-e11-s06.spec.ts:62-79` (confidence: 55): `mockNotificationPermission` uses `Object.defineProperty` to replace the entire `Notification` global with a plain object. This means if the component under test calls `new Notification(...)` (as `sendCourseReminder` does), it will throw because the mock is not constructable. For AC2 tests this would be a silent blocker. Consider using a constructable mock class pattern (as done in `src/lib/__tests__/studyReminders.test.ts:138-151`) if a notification delivery test is added.

- **Nit** `tests/e2e/story-e11-s06.spec.ts:184` (confidence: 55): The assertion `await expect(permissionPrompt).toContainText(/notifications.*required/i)` matches against the implementation text "Notifications required for reminders" (`CourseReminderSettings.tsx:179`). The regex requires the word "required" to follow "notifications" — that is correct today. If the copy is ever edited to "Enable notifications for reminders to work," the regex will silently fail. Consider a more stable assertion such as checking for the `data-testid="course-reminder-permission-prompt"` visibility (already asserted on line 183) and the presence of the "Enable Notifications" button (line 187), making line 184 redundant. If retained, document what exact phrase it is guarding.

- **Nit** `tests/e2e/story-e11-s06.spec.ts:265-270` (confidence: 50): After editing and saving the reminder in AC5, the test verifies the updated time `14:30` is visible in the row, but does not verify that Monday was actually removed from the day summary. The day-deselect interaction (line 259 clicking Monday to toggle it off) is exercised but never asserted. Add `await expect(reminderRow).not.toContainText(/mon/i)` after the save assertion.

---

### Edge Cases to Consider

1. **`shouldFireReminder` boundary at minute boundary** (`src/lib/courseReminders.ts:72`): The window is `diff >= 0 && diff <= 1` (0 or 1 minute past target). At `diff === 2` the reminder does not fire. There is no unit test for the exact boundary values (0, 1, 2 minute diff). The 1-minute tolerance could cause a reminder to fire twice if the 60-second interval fires at 0 minutes and again at 1 minute past the target.

2. **Empty `days` array guard in `handleSaveNew`** (`CourseReminderSettings.tsx:121`): The button is disabled when `selectedDays.length === 0` but the guard `if (!selectedCourseId || selectedDays.length === 0) return` also exists. No test verifies that attempting to save with zero days selected silently no-ops rather than creating a malformed reminder in IndexedDB.

3. **`availableCourses` dedup filter** (`CourseReminderSettings.tsx:151`): Courses that already have a reminder are filtered out of the "Add Reminder" course select. No test verifies this behavior — specifically, after adding a reminder for Course A, Course A should not reappear as an option for a second reminder.

4. **`course-reminders-updated` event bus** (`src/lib/courseReminders.ts:36, 47`): The `saveCourseReminder` and `deleteCourseReminder` functions dispatch a custom window event. The `useCourseReminders` hook (`src/app/hooks/useCourseReminders.ts:57-59`) re-loads and re-schedules on each event. There is no test verifying that the scheduler is restarted after a CRUD update, or that an event dispatched from one component is received by the hook.

5. **Scheduler not started when `remindersRef` is empty** (`src/app/hooks/useCourseReminders.ts:31`): `startScheduler` returns early if `remindersRef.current.length === 0`. After the first reminder is added (and the `course-reminders-updated` event fires), the scheduler should start. This state transition (no-op scheduler → active scheduler) is untested.

6. **`getNotificationPermission` returning `'unsupported'`** (`src/lib/courseReminders.ts:103`): `sendCourseReminder` checks `!== 'granted'` — unsupported environments return early correctly. But `useCourseReminders.ts:30` also checks `!== 'granted'` and would correctly skip scheduling. The `CourseReminderSettings` component initialises `permission` state via `getNotificationPermission()` (line 30) but has no rendered fallback for `'unsupported'`. The UI neither shows a prompt nor an error banner in that case.

---

ACs: 5 covered / 6 total | Findings: 9 | Blockers: 1 | High: 3 | Medium: 3 | Nits: 3
