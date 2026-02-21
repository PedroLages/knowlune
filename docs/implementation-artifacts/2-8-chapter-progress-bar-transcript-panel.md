---
story_id: E02-S08
story_name: "Chapter Progress Bar & Transcript Panel"
status: done
started: 2026-02-21
completed: 2026-02-21
reviewed: true
review_started: 2026-02-21
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review]
---

# Story 2.8: Chapter Progress Bar & Transcript Panel

## Story

As a learner,
I want chapter markers on the progress bar and a synchronized transcript panel,
so that I can quickly navigate to specific topics and follow along with spoken content.

## Acceptance Criteria

**AC1 — Chapter markers on progress bar:**
Given a video resource with `metadata.chapters` data,
When the lesson player loads,
Then chapter marker lines appear on the progress bar at the correct percentage positions, and hovering a marker shows a tooltip with the chapter title and timestamp.

**AC2 — Backward compatibility (no chapters):**
Given a video resource without `metadata.chapters`,
When the lesson player loads,
Then the progress bar renders identically to the current implementation with no chapter markers.

**AC3 — Transcript tab with synchronized cues:**
Given a video resource with `metadata.captions[0].src` pointing to a `.vtt` file,
When the lesson player loads,
Then a "Transcript" tab is visible in the sidebar; clicking it shows a scrollable list of cues that auto-scrolls to highlight the currently active cue as the video plays, and clicking a cue seeks the video to that cue's start time.

**AC4 — Transcript tab hidden when no captions:**
Given a video resource without `metadata.captions`,
When the lesson player loads,
Then no "Transcript" tab is shown in the sidebar.

## Tasks / Subtasks

- [ ] Task 1: Add Chapter and TranscriptCue types to types.ts (AC: 1, 3)
  - [ ] 1.1 Add `Chapter { time: number; title: string }` interface
  - [ ] 1.2 Add `TranscriptCue { startTime: number; endTime: number; text: string }` interface
  - [ ] 1.3 Extend `Resource.metadata` with `chapters?: Chapter[]`

- [ ] Task 2: Create ChapterProgressBar component (AC: 1, 2)
  - [ ] 2.1 Build visual track with fill bar and hover-expand behaviour
  - [ ] 2.2 Add chapter marker lines at correct percentage positions
  - [ ] 2.3 Add Radix Tooltip on each chapter marker
  - [ ] 2.4 Move bookmark marker buttons here from VideoPlayer
  - [ ] 2.5 Add hidden `<input type="range">` overlay for keyboard a11y
  - [ ] 2.6 Wire `onSeek` callback on mouse click

- [ ] Task 3: Integrate ChapterProgressBar into VideoPlayer (AC: 1, 2)
  - [ ] 3.1 Add `chapters?: Chapter[]` prop to VideoPlayerProps
  - [ ] 3.2 Replace Slider-based progress bar with `<ChapterProgressBar>`

- [ ] Task 4: Create TranscriptPanel component (AC: 3, 4)
  - [ ] 4.1 Implement inline VTT fetch + parser (no library)
  - [ ] 4.2 Render scrollable cue list with active cue highlighting
  - [ ] 4.3 Auto-scroll active cue into view via useRef
  - [ ] 4.4 Wire click-to-seek callback
  - [ ] 4.5 Handle fetch error state

- [ ] Task 5: Integrate Transcript tab into LessonPlayer (AC: 3, 4)
  - [ ] 5.1 Add `videoCurrentTime` state updated on every `onTimeUpdate`
  - [ ] 5.2 Add conditional Transcript TabsTrigger + TabsContent
  - [ ] 5.3 Pass `chapters` to VideoPlayer

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

**2026-02-21** — Report: `docs/reviews/design/design-review-2026-02-21-e02-s08.md`

All 4 ACs pass functionally. Blockers:
- **B1 (Blocker)**: Chapter marker touch targets 16×28px on mobile — need `min-w-[44px] min-h-[44px]` on ChapterProgressBar marker buttons (same fix as bookmark markers in the same file)

High priority:
- **H1**: Inline `style={{ height: '400px' }}` in LessonPlayer:414 — replace with `h-[400px]`
- **H2**: Array index used as React key in ChapterProgressBar and TranscriptPanel — use `chapter.time` / `cue.startTime`

Medium:
- **M1**: Sample VTT/chapter data timestamps exceed video duration (2:24) — cues reference up to 6:00
- **M2**: `captionSrc` hardcoded to first track only — acceptable for this story, mark with TODO comment

## Code Review Feedback

**2026-02-21** — Report: `docs/reviews/code/code-review-2026-02-21-e02-s08.md`

Blockers:
- **B1**: Uncommitted changes (course data, VTT file, E2E test fixes) break AC coverage on the committed branch — commit all changes together
- **B2**: `captions` prop not passed from LessonPlayer to VideoPlayer — subtitle rendering is silently broken; add `captions={videoResource.metadata?.captions}` to VideoPlayer invocation in LessonPlayer

High priority:
- **H1**: Inline `style={{ height: '400px' }}` violates Tailwind-only convention — use `h-[400px]`
- **H2**: `setVideoCurrentTime` fires on every `onTimeUpdate` (~4×/sec) causing full LessonPlayer re-render — throttle to 1s intervals
- **H3**: `scrollIntoView({ behavior: 'smooth' })` does not respect `prefers-reduced-motion` — check `window.matchMedia` before using smooth
- **H4**: Zero unit tests for ChapterProgressBar and TranscriptPanel — add tests for `parseVTT()`, `parseTime()`, `formatTime()`

Medium:
- **M1**: `formatTime()` duplicated across ChapterProgressBar and VideoPlayer — extract to `src/lib/time.ts`
- **M2**: Chapter marker buttons are 16px wide with no touch target minimum (WCAG 2.5.5)
- **M3**: VTT parser does not strip styling tags (`<b>`, `<i>`, `<c>`) — renders as literal text
- **M4**: `cue === activeCue` uses reference equality — use index comparison instead
- **M5**: "Loading transcript..." shown permanently if VTT parses to zero cues — add `loaded` state flag

## Challenges and Lessons Learned

- **Commit related files together.** Course data, VTT fixture, and E2E tests all landed in separate commits. The code-review blocker (B1) caught that the committed branch had broken E2E tests because the data they depended on was uncommitted. When adding test fixtures and sample data that E2E tests rely on, commit them in the same atomic commit as the tests.

- **Wire every prop, not just the new one.** The `captions` prop already existed on `VideoPlayer` for subtitle rendering, but `LessonPlayer` only passed the new `chapters` prop. The transcript panel worked, but video subtitle toggling was silently broken. When a parent passes props to a child, check that all props on the child's interface are accounted for — not just the ones the current story added.

- **Touch targets need explicit sizing regardless of z-layering.** The chapter marker z-layering (markers at z-20, range input at z-10) is a clever pattern — but it made it easy to forget that the marker `<button>` itself needed a 44x44px tap area. Bookmark markers in the same file already had `min-w-[44px] min-h-[44px]`; chapter markers did not. When extracting a component that contains interactive elements, audit every `<button>` for WCAG 2.5.5 compliance even if you're adapting an existing pattern.

- **`setVideoCurrentTime` on every `timeupdate` is expensive.** The `onTimeUpdate` handler fires ~4×/second during playback. Storing that value in React state causes the entire LessonPlayer tree to re-render at the same rate. Throttle to once per second (the granularity cues actually change) using a ref, or move the time-sensitive state down to only the components that need it (TranscriptPanel in this case).

- **`scrollIntoView({ behavior: 'smooth' })` bypasses CSS reduced-motion.** The global `prefers-reduced-motion` media query in CSS only governs CSS animations and transitions — it does not affect the JavaScript `scrollIntoView` API. Any JS-triggered smooth scroll needs an explicit `window.matchMedia('(prefers-reduced-motion: reduce)').matches` check before using `behavior: 'smooth'`. This recurs across stories (noted in S05/S06 reviews); worth adding a shared utility.

- **Inline `style={{}}` attributes accumulate invisibly.** Both code and design reviewers flagged `style={{ height: '400px' }}`. The project convention (Tailwind utilities only) is easy to violate under time pressure. The fix is always a one-word swap (`h-[400px]`) — but the violation creates inconsistency that future agents will inherit. Default to Tailwind arbitrary values from the start.

## Implementation Plan

See [plan](/Users/pedro/.claude/plans/lovely-cooking-pillow.md) for implementation approach.
