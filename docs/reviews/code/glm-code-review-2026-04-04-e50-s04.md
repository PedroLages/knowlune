## External Code Review: E50-S04 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-04
**Story**: E50-S04

### Findings

#### Blockers

- **[src/app/components/figma/CalendarSettingsSection.tsx:28-37] (confidence: 90)**: Stale closure on `isLoaded` — the `isLoaded` value is captured once at mount time. If `isLoaded` is initially `false` but becomes `true` after `loadFeedToken()` resolves (e.g., because `loadFeedToken` itself triggers a state update), `loadSchedules()` will be called redundantly. The `ignore` flag prevents the *unmount* race, but the stale read means the guard `!isLoaded` is unreliable. Fix: Move the `isLoaded` check into the async body by reading it from a ref, or restructure so `loadSchedules` is called unconditionally on mount and `loadFeedToken` is a separate effect, or just call both unconditionally and let the store deduplicate.

#### High Priority

- **[src/app/components/figma/CalendarSettingsSection.tsx:72-74] (confidence: 75)**: Unhandled promise rejection — `handleToggle` is async and passed directly to `onCheckedChange`. If `generateFeedToken()` or `disableFeed()` throws, the error is silently swallowed (no `.catch()` or `toast.error()`). The switch will visually flip but the underlying state may be inconsistent. Fix: Wrap in try/catch with `toast.error()` on failure, or add `.catch()` at the call site.

- **[src/app/components/figma/CalendarSettingsSection.tsx:84-86] (confidence: 75)**: Same issue for `handleRegenerate` — async callback passed to `onClick` on `AlertDialogAction` with no error handling. If `regenerateFeedToken()` throws, the dialog closes with no feedback and the old token may be in an undefined state. Fix: Add try/catch with user-facing error toast.

- **[src/app/components/figma/FeedPreview.tsx:84-86] (confidence: 85)**: Using array index as React `key` on a list that is sorted and can change when `schedules` changes. If events shift positions between renders, React will mismatch DOM nodes, causing incorrect visual updates. Fix: Use a stable key composed from `schedule.title + day + startTime`.

#### Medium

- **[src/app/components/figma/FeedPreview.tsx:53-54] (confidence: 65)**: `parseInt(schedule.startTime.replace(':', ''), 10)` is fragile — for times like `09:05`, `replace(':', '')` → `"0905"` → `parseInt` → `905`, which works as a tiebreaker, but `NaN` from malformed data silently corrupts sorting. Fix: Parse hours and minutes explicitly and compute a numeric sort key as `h * 60 + m`, or add a NaN guard.

- **[src/app/components/figma/StudyScheduleSummary.tsx:41-44] (confidence: 70)**: `formatTimeRange` uses `% 24` for wrapping, meaning a 23:00 start with 120min duration silently wraps to `01:00` without any cross-day indication. This is potentially confusing for users. The `% 24` also masks data integrity issues. Fix: Either display a warning for cross-midnight blocks, or indicate the next day in the output.

#### Nits

---
Issues found: 6 | Blockers: 1 | High: 3 | Medium: 2 | Nits: 0
