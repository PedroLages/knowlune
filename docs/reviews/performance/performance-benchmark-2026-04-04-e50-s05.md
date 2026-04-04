## Performance Benchmark: E50-S05 — Schedule Editor + Course Integration (2026-04-04)

**Date**: 2026-04-04
**Story**: E50-S05

### Bundle Size

| Metric | Baseline | Current | Delta |
|--------|----------|---------|-------|
| Total JS (raw) | 8,522,159 bytes | 7,643,737 bytes | -878KB (-10.3%) |

The current bundle is smaller than baseline — no regression. The 3 new components (StudyScheduleEditor ~324 lines, DayPicker ~53 lines, TimePicker ~84 lines) add minimal weight, as they reuse existing shadcn/ui primitives already in the bundle.

### Page Metrics (Settings Route — Primary Affected Route)

| Metric | Value | Rating |
|--------|-------|--------|
| TTFB | 3.32ms | excellent |
| FCP | 223.66ms | good |
| LCP | 616.22ms | good |

### Page Metrics (Courses Route)

| Metric | Value | Rating |
|--------|-------|--------|
| TTFB | ~4ms | excellent |
| FCP | ~280ms | good |

### Console Errors

4 pre-existing errors (AI embedding model load failure — requires internet). 0 new errors introduced by this story.

### Verdict

**PASS** — No performance regressions. Bundle is smaller than baseline. Page metrics are all in "good" range.
