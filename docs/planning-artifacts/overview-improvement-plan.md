# Overview Dashboard Architecture

**Status:** Implemented

**Last updated:** 2026-07-18

**Route:** `/overview`

## Product contract

The Overview page helps a learner identify and start the next meaningful learning action within
five seconds. The information hierarchy is intentionally stable:

1. Learning Focus and Today
2. Learning Pulse KPIs
3. Progress
4. Consistency
5. Conditional Learning Insights
6. Library preview

The route composes feature components over `useOverviewDashboardModel`; it does not calculate
reporting data or query IndexedDB directly. Optional chart-heavy sections and the customizer are
loaded only when rendered.

## Learner states

States are evaluated in the following order with local-calendar boundaries and an injected `now`
value in the pure aggregation layer:

| State       | Rule                                                                             | Dashboard behavior                                        |
| ----------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `new`       | No imported courses                                                              | One import activation panel; no duplicate empty analytics |
| `returning` | A completed session exists and latest activity is more than 14 calendar days old | Restart-focused Resume action and 30-day trend            |
| `early`     | Imported content and fewer than 3 completed sessions                             | Focus, Today, truthful KPIs, and Library only             |
| `active`    | At least 3 completed sessions and activity within 14 calendar days               | Complete dashboard                                        |

Unfinished sessions and sessions with non-positive duration are excluded from historical totals.
`StudySession.duration` is the source for active time because it already excludes idle time.

## Live data truth table

| UI output                     | IndexedDB/store source                                                             | Rule                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Learning Focus                | `importedCourses`, `importedVideos`, `importedPdfs`, `progress`, `contentProgress` | Prefer active/in-progress courses and most recently updated lesson            |
| Today                         | `studySchedules`, `flashcards`, knowledge-map calculations                         | Next enabled local schedule, due FSRS cards, strongest current recommendation |
| Seven-day minutes/days/streak | completed `studySessions`                                                          | Latest 7 complete calendar days vs preceding 7; local-day streak              |
| Study trend                   | completed `studySessions`                                                          | Active seconds bucketed into 7/30 local calendar days                         |
| Course progress               | course content plus `progress` and `contentProgress`                               | Completed real items divided by total imported items                          |
| Heatmap                       | completed `studySessions`                                                          | 84 local days ending today, intensity from active minutes                     |
| Recent activity               | completed sessions and completed `quizAttempts`                                    | Six newest truthful completions                                               |
| Assessment                    | `quizzes`, completed `quizAttempts`                                                | Last six scores, real all-time average, topics below 80%                      |
| Mastery/retention             | current knowledge map and FSRS state                                               | Current model only; no invented history                                       |
| Reading                       | PDF/mixed sessions, imported PDFs, PDF progress                                    | Last-30-day minutes, reached pages, latest progressed PDF                     |
| Library                       | `importedCourses` plus derived progress                                            | Up to four standardized course cards                                          |

Missing optional data hides an insight or renders concise honest guidance. No sample or generated
analytics values are used. This release adds no Dexie schema, Supabase API, or analytics-event table.

## Loading, failure, and resume behavior

`useOverviewDashboardModel` uses one `useLiveQuery` read over batched Dexie queries. It exposes
`loading`, `ready`, and `error` states plus a retry operation. Query-driven skeletons replace the old
timer. A failed read shows visible feedback and emits one error toast per failure.

Resume resolves `getLastWatchedLesson` using `VideoProgress.updatedAt`; watch/completion data is only
a legacy fallback. If no watched lesson exists, the first imported lesson is used. A not-started
course becomes active before navigation. Resolution failures fall back to the course overview with
non-blocking feedback.

## Stable preferences

Preferences are versioned under `knowlune-dashboard-preferences-v2`:

```ts
interface DashboardPreferencesV2 {
  version: 2
  preset: 'focus' | 'balanced' | 'analytics' | 'custom'
  order: Array<'focus' | 'pulse' | 'progress' | 'consistency' | 'insights' | 'library'>
  hidden: Array<'focus' | 'pulse' | 'progress' | 'consistency' | 'insights' | 'library'>
}
```

Balanced is the default. Selecting a preset stores a stable product-defined order; manual move or
visibility changes produce `custom`. Reset always restores Balanced. The legacy
`dashboard-section-order` value is mapped once into the six new groups. Both it and obsolete
`dashboard-section-stats` are then removed. Viewport or interaction tracking never reorders content.

## Responsive and accessibility contract

- Content is centered at `max-width: 1360px`, with 16/24/32px effective horizontal padding.
- Desktop uses a 12-column grid, tablet uses paired sections, and mobile uses one column.
- The persistent sidebar begins at 1280px; narrower screens use compact navigation behavior.
- The page has no document-level horizontal overflow from 320px through 1920px.
- Charts include a visible summary and screen-reader table.
- The 12-week heatmap is an accessible grid with one roving tab stop, arrow/Home/End navigation,
  and a live selected-day detail.
- Interactive targets preserve 44px sizing, visible focus, heading order, reduced-motion behavior,
  token-only colors, and non-color labels.

## Verification

Pure functions cover learner-state thresholds, timezone boundaries, daily bucketing, comparisons,
streaks, resume ordering, due reviews, progress, assessment, reading, corrupt data, and preference
migration. Component tests cover loading, failures, conditional sections, and heatmap navigation.
Playwright covers all learner states, direct resume, presets and migration, 7/30-day range, heatmap
keyboard behavior, axe serious/critical checks, and 390/1024/1440/1920 viewport overflow.
