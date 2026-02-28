---
story_id: E03-S03
story_name: "Timestamp Notes and Video Navigation"
status: done
started: 2026-02-26
completed: 2026-02-27
reviewed: true
review_started: 2026-02-27
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 3.3: Timestamp Notes and Video Navigation

## Story

As a learner,
I want to insert the current video timestamp into my notes and click timestamps to jump to that moment,
So that I can link my knowledge to exact video moments for future recall.

## Acceptance Criteria

**Given** the user is watching a video and taking notes
**When** the user presses Alt+T (or clicks the timestamp button in the toolbar)
**Then** the current video timestamp is inserted into the note as a clickable link in format `[MM:SS](video://lessonId#t=seconds)`
**And** the insertion happens at the cursor position

**Given** a note contains a timestamp link like `[2:34](video://lesson-01#t=154)`
**When** the user clicks the link in preview mode
**Then** the video player seeks to exactly 2 minutes 34 seconds (154 seconds)
**And** the seek completes within 1 second

**Given** the user views notes for a video
**When** timestamps are present
**Then** they render as clickable blue-600 links with a clock icon
**And** hovering shows a tooltip with the formatted time

## Tasks / Subtasks

- [x] Task 1: Pass `currentVideoTime` to NoteEditor instances in LessonPlayer (AC: #1)
- [x] Task 2: Update timestamp insertion format to `[MM:SS](video://lessonId#t=seconds)` (AC: #1)
- [x] Task 3: Update video link parser for new `video://lessonId#t=seconds` format (AC: #2)
- [x] Task 4: Add Clock icon to rendered timestamp links (AC: #3)
- [x] Task 5: Add tooltip on timestamp link hover (AC: #3)
- [x] Task 6: Add Alt+T keyboard shortcut on textarea (AC: #1)
- [x] Task 7: Install and configure rehype-sanitize for video protocol (AC: #2)
- [x] Task 8: Add Alt+T to VideoShortcutsOverlay (AC: #1)

## Implementation Notes

- Custom react-markdown renderer for `video://` protocol links
- Alt+T keyboard shortcut handler reads current time from LessonPlayer's `currentVideoTime` state
- Custom rehype-sanitize schema to allow `video` protocol in href
- The `video://` renderer pattern is reused by Story 3.9 for `screenshot://` protocol
- Backward compatibility: also support legacy `video://seconds` format from existing notes

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

**2026-02-27 — 2 High Priority findings, 0 Blockers**
- H1: `hover:text-brand-hover` doesn't resolve to blue in Tailwind v4 — use `hover:text-blue-700`
- H2: Touch targets (Add Timestamp button, Edit/Preview tabs) below 44px WCAG minimum on mobile
- Full report: `docs/reviews/design/design-review-2026-02-27-e03-s03.md`

## Code Review Feedback

**2026-02-27 — 1 Blocker, 3 High, 3 Medium**
- B1: `urlTransform` fix for `video://` protocol is UNCOMMITTED — committed branch renders broken links
- H1: `handleNoteChange` drops tags param — silent data loss
- H2: `createVideoLinkComponent` recreated every render — memoize with useMemo
- H3: Alt+T shortcut scope mismatch (only works in textarea, listed as global in overlay)
- Full report: `docs/reviews/code/code-review-2026-02-27-e03-s03.md`
- Test coverage: `docs/reviews/code/code-review-testing-2026-02-27-e03-s03.md`

## Implementation Plan

See [plan](../../.claude/plans/spicy-fluttering-crescent.md) for implementation approach.

## Challenges and Lessons Learned

- **Uncommitted blocker (recurring)**: `urlTransform` override for `video://` protocol existed only in the working tree — committed branch broke AC2 and AC3. This is the third story where blocker-level fixes were left unstaged. Always verify `git diff` before `/review-story`.
- **react-markdown strips custom protocols**: `defaultUrlTransform` silently empties non-standard protocol URLs. Override with `urlTransform={(url) => url.startsWith('video://') ? url : defaultUrlTransform(url)}`.
- **rehype-sanitize blocks custom protocols too**: Even with `urlTransform`, `rehype-sanitize` strips `video://` hrefs. Extend `defaultSchema.attributes.a` with `protocols: { href: [...existing, 'video'] }`.
- **Duplicate utility (4th copy)**: `formatTimestamp` was copy-pasted into NoteEditor, VideoPlayer, ChapterProgressBar, and bookmarks.ts. Extracted to `@/lib/time.ts`. Watch for this pattern in future stories.
- **E2E seek test beyond video duration**: Test used `t=154` but the sample video is ~144 seconds — browser clamps `currentTime` to duration. Always use timestamps within the known video length.
- **Component recreation in JSX props**: `components={{ a: createFn(callback) }}` inside JSX creates a new component reference every render, causing unmount/remount of all child elements. Memoize with `useMemo`.
