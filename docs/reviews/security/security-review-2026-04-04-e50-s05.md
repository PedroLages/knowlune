## Security Review: E50-S05 — Schedule Editor + Course Integration (2026-04-04)

**Reviewer**: Security Review Agent
**Date**: 2026-04-04
**Story**: E50-S05

### Scope

Changed files: StudyScheduleEditor.tsx, DayPicker.tsx, TimePicker.tsx, CourseHeader.tsx, CalendarSettingsSection.tsx, FeedPreview.tsx

### Findings

#### Blockers

None.

#### High

None.

#### Medium

None.

#### Info / Low

- **[TimePicker.tsx:31-35 — Locale injection]**: `new Intl.DateTimeFormat(undefined, ...)` uses the browser's locale for display. This is intentional and correct. No injection vector — the output is display-only and not persisted or passed to any API.

- **[StudyScheduleEditor.tsx:154 — Timezone capture]**: `Intl.DateTimeFormat().resolvedOptions().timeZone` captures the user's timezone and stores it in IndexedDB via `addSchedule`/`updateSchedule`. This is user-local data and is not transmitted to any external service. No privacy concern in the current architecture.

- **[StudyScheduleEditor.tsx:37 — FREE_STUDY sentinel]**: `'__free__'` sentinel value stored in component state (not persisted). No injection risk.

### Phase Coverage

- Phase 1 (Input validation): Title trimming ✓, day validation ✓. No server-side concerns (client-only).
- Phase 2 (Authentication/Authorization): Calendar feed is auth-gated. Schedule operations go to Dexie (client-only). No auth bypass risk.
- Phase 3 (Data storage): All data stored in IndexedDB via existing `useStudyScheduleStore`. No new storage patterns.
- Phase 5 (XSS): Course names rendered as text (not innerHTML). No XSS vector.
- Phase 8 (Secrets scan): No secrets in diff. Timezone string is not sensitive.

### Verdict

**PASS** — No security issues found. Clean implementation.
