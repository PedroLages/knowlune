## Design Review: E50-S05 — Schedule Editor + Course Integration (2026-04-04)

**Reviewer**: Design Review Agent (Playwright MCP)
**Date**: 2026-04-04
**Story**: E50-S05 — Schedule Editor + Course Integration
**Routes tested**: /settings (Calendar Integration section), /courses/:id (course detail)

### Summary

The Schedule Editor implementation is well-structured. The CalendarSettingsSection correctly gates the "Add Study Block" button behind `feedEnabled`. The Sheet component, DayPicker, and TimePicker all follow Knowlune design token conventions.

**Critical finding**: The "Schedule study time" button was added to `CourseHeader.tsx`, but `CourseHeader` is only used inside `UnifiedCourseDetail.tsx`, which is **not actively routed** in the app. The active course page (`CourseOverview` at `/courses/:courseId`) does not have the schedule integration. AC3 ("open editor from a course detail page") is unreachable in the live app.

### Findings

#### Blockers

- **[CourseHeader.tsx / AC3 integration — UNREACHABLE]**: The "Schedule study time" button (data-testid="schedule-study-time-button") was added to `CourseHeader.tsx`, but `CourseHeader` is only used in `UnifiedCourseDetail.tsx`. `UnifiedCourseDetail` is not routed — `routes.tsx:251` maps `/courses/:courseId` to `CourseOverview`, which does not include `CourseHeader` or `StudyScheduleEditor`. AC3 is not testable or reachable by users. The implementation needs to be integrated into `CourseOverview` instead.

#### High Priority

None.

#### Medium

- **[Settings > Calendar Integration]**: The Calendar Integration section requires sign-in to enable. The "Add Study Block" button is only visible when `feedEnabled=true`, which requires a feed token (auth-gated). Users without accounts cannot test the full schedule editor flow from Settings. Consider whether the schedule editor should be accessible without the feed feature, or at minimum display a clear message to unauthenticated users.

#### Low / Nit

- **[DayPicker]**: The abbreviated labels "T", "T", "S", "S" for Tuesday/Thursday and Saturday/Sunday are visually ambiguous. While accessible (aria-labels are correct), a tooltip showing the full day name on hover would improve discoverability.

### Performance Metrics

- FCP: 223ms (good)
- TTFB: 3ms (excellent)
- No console errors from this story's code (4 pre-existing AI model errors unrelated to schedule editor)

### Verdict

**BLOCKED** — AC3 (course detail integration) is not reachable in the live app. The "Schedule study time" button was added to `CourseHeader` which is not routed. Must be integrated into `CourseOverview` or the currently active course detail page.
