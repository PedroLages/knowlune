# Code Review Agent Memory

## Patterns Observed

### E01-S03: Organize Courses by Topic
- `normalizeTags()` in store lowercases and deduplicates, but `addImportedCourse()` does NOT normalize tags on import
- `getAllTags()` is a function on the Zustand store (not a selector), so calling it inside components with `state.getAllTags()()` triggers re-renders on every state change
- Test factories exist at `tests/support/fixtures/factories/` -- unit tests should use them instead of inline `makeCourse` functions
- The codebase uses `cn()` from `@/app/components/ui/utils` for class merging but new components use string interpolation instead
- `size-*` Tailwind v4 shorthand (`size-5` instead of `h-5 w-5`) not consistently adopted in new components

### E01-S04: Manage Course Status
- `getAllTags()` re-render issue from S03 persists in both ImportedCourseCard (line 43) and Courses page (line 35/62)
- `updateCourseStatus` and `updateCourseTags` store actions have ZERO dedicated unit tests in useCourseImportStore.test.ts
- StatusFilter has ZERO unit tests (no __tests__/StatusFilter.test.tsx exists)
- ImportedCourseCard tests don't cover status badge rendering, status dropdown, or status change behavior
- AC specifies gray-400 for Paused but implementation uses gray-500 (StatusFilter) and gray-500/gray-400 text (ImportedCourseCard badge)
- String interpolation for className instead of cn() continues in new components (StatusFilter, ImportedCourseCard)
- Courses.test.tsx doesn't test status filtering (AC2), combined topic+status filtering, or default-to-active (AC3)

### E02-S05: Course Structure Navigation
- AutoAdvanceCountdown uses `setInterval` with `remaining` in deps -- creates new interval every second instead of using `setTimeout`
- `prefers-reduced-motion` required by story Task 3.4 but NOT implemented in AutoAdvanceCountdown
- No unit tests for AutoAdvanceCountdown or ModuleAccordion (activeLessonId feature)
- E2E tests do NOT cover auto-advance actually navigating to next lesson after countdown reaches 0 (AC5 gap)
- String interpolation for className (not `cn()`) continues in ModuleAccordion Link elements
- `h-5 w-5` used instead of `size-5` Tailwind v4 shorthand in ModuleAccordion icons
- `defaultValue` on Radix Accordion is uncontrolled -- won't re-expand when navigating between lessons in different modules
- `handleVideoEnded` has `completed` in closure -- rewatching a completed video shows auto-advance but skips celebration (intended?) but also triggers auto-advance even for already-completed lessons

### E02-S09: Mini-Player & Theater Mode
- `useIntersectionObserver` has `options` in useEffect deps -- inline `{ threshold: 0.3 }` causes observer teardown/recreate every render
- Double T-key toggle: wrapper `onKeyDown` AND VideoPlayer window handler both toggle theater when focus is inside VideoPlayer container
- Mini-player click pauses video (click bubbles to `<video onClick={togglePlayPause}>` before wrapper handler) -- AC says click should scroll back, not pause
- `onTheaterModeToggle` passed as inline arrow `() => setIsTheaterMode(prev => !prev)` -- new ref every render, causes VideoPlayer keyboard effect to re-subscribe
- No unit tests for `useIntersectionObserver` hook
- E2E mini-player click test passes accidentally (pause hides mini-player, removing `fixed` class = test assertion passes)
- Import alias: `useIntersectionObserver` import uses relative `'../hooks/useIntersectionObserver'` instead of `@/app/hooks/useIntersectionObserver`

### E02-S06: Video Player UX Fixes & Accessibility
- S05 interval bug fixed (stable interval with no deps on `remaining`)
- S05 uncontrolled Accordion fixed (now uses controlled `value`/`onValueChange`)
- `focus:` used instead of `focus-visible:` on video player container -- shows ring on mouse click too (undesirable)
- Speed menu has NO click-outside-to-close handler -- clicking elsewhere leaves menu open
- Mobile volume popover has NO click-outside-to-close handler either
- `poster` prop added to VideoPlayer but LessonPlayer never passes it
- AutoAdvanceCountdown interval keeps ticking past 0 (remaining goes negative) -- should clearInterval
- No AC4 (reduced motion) E2E test -- relies on global CSS rule but no test verifies it
- `h-16 w-16` / `h-8 w-8` still used on center play button instead of `size-16` / `size-8`
- String interpolation for className persists in ModuleAccordion Link (not using `cn()`)
- `openModules` referenced in useEffect but not in dependency array (lint warning suppressed?)

### E02-S07: Skip Controls, PiP & Shortcuts Help
- Removal of `data-testid="video-player"` breaks 3 existing E2E tests (story-e02-s03, story-2-1-lesson-player)
- `Shift+ArrowLeft/Right` listed in shortcuts overlay but NOT implemented in keyboard handler
- VideoShortcutsOverlay has no ARIA role/aria-modal/focus trap -- accessibility gap for screen readers
- Close button on overlay is `size-9` (36px), below 44px WCAG touch target minimum
- `announceTimeoutRef` not cleaned up on unmount (pre-existing, but more announce calls added)
- E2E tests missing: clicking skip buttons (only tests keyboard J/L), PiP exit flow, Shift+Arrow shortcuts

### E02-S08: Chapter Progress Bar & Transcript Panel
- `captions` prop exists on VideoPlayer but LessonPlayer NEVER passes it -- subtitle rendering broken since captions were added
- `formatTime()` is duplicated in VideoPlayer and ChapterProgressBar (identical), plus variants in bookmarks.ts and NoteEditor.tsx -- needs shared utility
- `setVideoCurrentTime(time)` on every `onTimeUpdate` (~4x/sec) causes full LessonPlayer tree re-render -- needs throttle or ref
- TranscriptPanel `scrollIntoView({ behavior: 'smooth' })` does NOT respect `prefers-reduced-motion` (recurring pattern from S05/S06)
- Inline `style={{ height: '400px' }}` on transcript container in LessonPlayer (violates Tailwind-only convention)
- Chapter markers have no 44x44px min touch target (bookmarks have it, chapters don't)
- VTT parser does not strip VTT styling tags (`<b>`, `<i>`, etc.) from cue text
- TranscriptPanel shows "Loading..." permanently if VTT parses to zero cues (no `loaded` state)
- No unit tests for ChapterProgressBar or TranscriptPanel (VTT parser especially needs coverage)
- E2E tests + course data + VTT file were left uncommitted -- branch was broken without them
- `cn()` correctly used in TranscriptPanel (improvement over previous stories)

### E03-S03: Timestamp Notes and Video Navigation
- BLOCKER: `urlTransform` override for `video://` protocol exists ONLY in working tree -- committed version strips video:// URLs via react-markdown's defaultUrlTransform, breaking AC2/AC3
- `handleNoteChange` in LessonPlayer takes `(value: string)` but NoteEditor's onSave provides `(content, tags)` -- tags silently discarded, never persisted to IndexedDB
- `createVideoLinkComponent(onVideoSeek)` called inside JSX `components` prop -- creates new component function every render, causing unmount/remount of all links
- Alt+T shortcut added to VideoShortcutsOverlay but only works on textarea onKeyDown, NOT on video player (misleading shortcut listing)
- `formatTimestamp` duplicated AGAIN (now in NoteEditor, VideoPlayer, ChapterProgressBar, bookmarks.ts) -- recurring pattern from S08
- `setVideoCurrentTime` re-render cascade (~4x/sec) now affects 4 NoteEditor instances via `currentVideoTime` prop -- recurring from S08
- No unit tests for NoteEditor (parseVideoSeconds, formatTimestamp, insertTimestamp, createVideoLinkComponent)
- `h-3 w-3` / `h-3.5 w-3.5` used instead of `size-3` / `size-3.5` Tailwind v4 shorthand (recurring)

### E03-S02: Side-by-Side Study Layout (Round 2)
- CRITICAL: Blocker fixes (focus trap, Escape handler, ARIA attrs, `!noteFullScreen` guard) exist ONLY as uncommitted working tree changes -- never committed to the branch
- Previous review identified 2 blockers, 4 high, 3 medium, 3 nits; fixes applied locally but shipped commit (1351fd3) only contains review report, not the actual code fixes
- `usePanelRef` from `react-resizable-panels` imported directly (bypasses shadcn/ui wrapper) -- wrapper doesn't re-export hooks
- `style={{ overflow: 'visible' }}` inline style needed because library sets `overflow: hidden`; could use `!overflow-visible` Tailwind important modifier instead
- Notes panel close button uses `h-7 w-7` (28px) -- below 44px WCAG touch target
- AC2 "notes available" indicator E2E test is still a no-op (no notes seeded, no indicator asserted)
- `handleNotesToggle` tab fallback chain: materials > bookmarks > transcript -- lands on non-existent tab for lessons without PDFs, video, or captions
- E2E tests missing: Escape key dismissal on fullscreen overlay, keyboard navigation in fullscreen overlay

### E03-S05: Full-Text Note Search (Round 2)
- BLOCKER (RECURRING): Fixes exist ONLY as uncommitted working tree changes -- committed branch ships broken code. Recurring from E03-S03 and E03-S02.
  - `combineWith: 'AND'` in committed noteSearch.ts breaks fuzzy multi-term search ("custm hooks" returns nothing)
  - `searchParams` object in useEffect deps causes over-firing of seek/panel effects in committed LessonPlayer.tsx
  - `highlightMatches` takes `string` query arg in committed version (recreates RegExp on every call) instead of memoized patterns
  - `buildSearchIndex()` assigned to module-level const in committed version (not wrapped in useMemo)
  - Tags joined with space in committed version -- multi-word tags like "machine learning" corrupt on round-trip
  - OR semantics test and multi-word tag test only exist in uncommitted working tree
- `h-4 w-4` used instead of `size-4` Tailwind v4 shorthand in StickyNote icon (recurring)
- `bg-yellow-200` hardcoded in highlightMatches `<mark>` tag instead of using theme token

### E03-S09: Video Frame Capture in Notes (Round 2)
- BLOCKER (RECURRING): ENTIRE implementation STILL exists only in working tree after round 2 fixes -- committed branch has only story doc, sprint-status, and E2E tests. 5th consecutive story with this pattern.
- Round 1 fixes applied: blob URL leak fixed (CapturedFrame no longer carries thumbnailUrl), global CustomEvent replaced with editor.storage.frameCapture.onSeek, formatFrameTimestamp now delegates to shared formatTimestamp, unit tests added for frame-capture.ts, error state added to FrameCaptureView
- `handleNoteChange` in LessonPlayer STILL calls `saveNote()` fire-and-forget with no `.catch()` (recurring across S03, S04, S06, S09)
- FrameCaptureView `.catch(() => {...})` silently swallows IndexedDB errors (no console.error)
- FrameCaptureView `handleTimestampClick` silently no-ops when onSeek is null (read-only contexts like Notes Dashboard)
- `handleCaptureFrame` in NoteEditor: editor.chain().insertFrameCapture() after await is not wrapped in try/catch
- `forwardRef` used on VideoPlayer (required for React 18, can simplify when upgrading to React 19)
- resizable.tsx uses `bg-brand/60` -- verify `--color-brand` token exists in theme.css

## Recurring Anti-Pattern: Uncommitted Fixes
- E03-S02: Blocker fixes (focus trap, ARIA attrs) existed only in working tree
- E03-S03: `urlTransform` override for video:// protocol existed only in working tree
- E03-S05: 6+ fixes (combineWith, searchParams deps, tag separator, highlight memoization, searchIndex useMemo, tests) exist only in working tree
- E03-S08: ENTIRE implementation (Notes.tsx, NoteCard.tsx, navigation.ts, routes.tsx) exists only in working tree -- committed branch has only the story file, sprint-status, and E2E tests
- E03-S09: ENTIRE implementation exists only in working tree -- committed branch has only story doc, sprint-status, and E2E tests
- Root cause: Review findings are applied locally but never committed before shipping. In S08/S09 cases, implementation itself was never committed.

### E03-S04: Tag-Based Note Organization

- Duplicate `setTags(initialTags)` across two useEffects in NoteEditor -- second one triggers on every `initialTags` reference change, potentially overwriting rapid user tag additions
- AC1 requires "tags can be added by pressing Enter or comma" but TagEditor has NO comma key handler (cmdk handles Enter only)
- Add-tag button in TagEditor is 20x20px (`h-5 w-5`), well below 44px WCAG touch target (recurring sub-44px button pattern)
- `handleNoteChange` and `handleTagsChange` in LessonPlayer call async Dexie operations fire-and-forget with no `.catch()` (recurring silent failure pattern)
- `getAllNoteTags()` does full table scan (`db.notes.toArray()`) instead of using the `*tags` multi-entry index
- TagBadgeList uses string interpolation for className instead of `cn()` (recurring since E01-S03)
- `tagSection` JSX shared between edit and preview tabs -- preview tab shows add/remove controls (arguably should be read-only)
- Tag immediate-save effect doesn't cancel the pending content debounce timer, causing redundant double-writes

### E03-S08: Global Notes Dashboard
- BLOCKER (RECURRING): ENTIRE implementation exists only in working tree -- committed branch ships only story doc, sprint-status, and E2E spec. Notes.tsx (untracked), NoteCard.tsx, navigation.ts, routes.tsx are all uncommitted.
- Tag filter badges use `<Badge>` (renders `<span>`) with `onClick` but NO `tabIndex`, `role="button"`, or `onKeyDown` -- completely inaccessible via keyboard
- `.catch(() => {})` on `getAllNoteTags()` promise silently swallows errors (recurring pattern)
- `courseName` prop added to NoteCard interface but NEVER destructured or rendered in the component
- String interpolation for className instead of `cn()` continues in Notes.tsx (recurring since E01-S03)
- `ReadOnlyContent` component duplicated in Notes.tsx (exists already in NoteCard.tsx)
- `stripHtml` function duplicated in Notes.tsx (exists already in NoteCard.tsx)
- TipTap `useEditor` instantiated per expanded card even for single-card expansion (minor perf concern)

### E03-S06: View Course Notes Collection
- `readOnlyEditor` in NoteCard initialized with `note.content` once -- does NOT update after editing and saving (useEditor `content` is initial-only), shows stale content in expanded view
- `handleDelete` in NoteCard calls `onDelete(note.id)` synchronously (fire-and-forget) then immediately shows `toast.success('Note deleted')` -- if delete fails and store rolls back, user sees "Note deleted" but note reappears
- `handleSave` in NoteCard same pattern -- calls `await saveNote()` but has NO try/catch, so any rejection is unhandled
- NoteCard has nested interactive elements: `<Button>` and `<Link>` inside `<div role="button">` -- WCAG violation, confusing keyboard navigation
- Tiptap `useEditor` created for EVERY NoteCard even when collapsed (never visible) -- wasteful, each creates a ProseMirror instance
- `CourseNotesTab` uses `useNoteStore()` without selector -- subscribes to entire store, re-renders on any state change (recurring from S03/S04)
- `formatTimestamp` duplicated AGAIN in NoteCard (local copy) -- shared utility exists at `@/lib/format.ts` (recurring from S08/S03)
- `h-* w-*` instead of `size-*` throughout both new components (recurring from S05+)
- No unit tests for NoteCard or CourseNotesTab
- Expand/collapse button is 32px (`h-8 w-8`), below 44px WCAG touch target (recurring sub-44px pattern)

### E03-S07: Bookmarks Page (Round 2)

- BLOCKER (RECURRING x6): ALL implementation + test fixes + unit tests exist ONLY in working tree. Committed branch still has zero functional code. 6th consecutive story with this pattern.
- Round 1 fixes applied in working tree: `.catch()` on getAllBookmarks, `role="button"` + keyboard handler, `size-11` delete button, course/lesson title E2E assertions, Dexie `orderBy('createdAt').reverse()`, `size-*` shorthand
- REMAINING: `handleDelete` has `try/finally` but NO `catch` -- `deleteBookmark()` rejection becomes unhandled promise rejection (no error feedback to user)
- REMAINING: `.catch(() => { setIsLoading(false) })` silently swallows getAllBookmarks errors -- no error state, bookmarks just show as empty
- REMAINING: `bg-yellow-100`/`text-yellow-800` hardcoded colors not in theme.css (recurring from S05)
- REMAINING: `w-14 h-9` in timestamp badge uses old h-/w- pattern (dimensions differ so `size-*` does not apply)
- NEW: Nested interactive elements -- `<Button>` inside `<div role="button">` creates confusing keyboard navigation (recurring from E03-S06)
- NEW: `findCourseAndLesson` return type not explicitly declared -- TypeScript infers it but inconsistent with codebase conventions
- Unit tests added for `getAllBookmarks()` (3 tests) -- good coverage of empty, sort order, and cross-course scenarios

### E04-S02: Course Completion Percentage
- BLOCKER (RECURRING x7): ENTIRE implementation (progress.tsx, CourseCard.tsx, CourseDetail.tsx) + E2E test fixes exist ONLY in working tree. Committed branch has only story doc, sprint-status, and original E2E spec.
- `value` prop destructured from Progress component but `normalizedValue` NOT passed back to Radix `<ProgressPrimitive.Root>` as `value` -- Radix sees `value=null`, sets `data-state="indeterminate"` instead of "loading"/"complete"
- Radix `ProgressPrimitive.Root` already sets `role="progressbar"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` internally -- component duplicates all of them (redundant, though no functional harm since spread order means component props override Radix's)
- Library variant completion badge uses hardcoded `bg-green-600 text-white` instead of `bg-success text-success-foreground` theme tokens (inconsistent with overview/progress variants which use theme tokens)
- CourseDetail uses hardcoded `text-green-600` for completion badge (no dark mode adaptation via `--success` token)
- `duration-500 ease-out` animation on progress bar has NO `prefers-reduced-motion` guard (AC2 mentions "animates smoothly" but story notes say "respects motion preferences" -- not actually implemented)
- `w-3 h-3` / `w-4 h-4` / `w-6 h-6` used instead of `size-*` Tailwind v4 shorthand in new completion badge icons (recurring since E02-S05)
- AC2 E2E test is entirely conditional (`if (await contentItem.count() > 0)`) -- no content-status UI exists, so test body never executes, providing zero coverage
- AC3 E2E test also conditional (`if (await progressBar.count() > 0)`) -- if no progressbar found in first card, test passes vacuously
- AC4 E2E test loops through cards looking for 100% -- if none exist, passes vacuously with no assertions
- No unit tests for Progress component (value normalization, showLabel, labelFormat)

## Recurring Anti-Pattern: Uncommitted Fixes
- E03-S02: Blocker fixes (focus trap, ARIA attrs) existed only in working tree
- E03-S03: `urlTransform` override for video:// protocol existed only in working tree
- E03-S05: 6+ fixes existed only in working tree
- E03-S07 (Round 1): ENTIRE IMPLEMENTATION existed only in working tree
- E03-S07 (Round 2): ALL implementation + Round 1 fixes + unit tests STILL only in working tree (6th consecutive occurrence)
- E04-S02: ENTIRE implementation (progress.tsx, CourseCard.tsx, CourseDetail.tsx) exists only in working tree (7th consecutive occurrence)
- Root cause: Implementation code applied locally but never committed before review/shipping

## Silent Failure Patterns to Watch

- Empty catch blocks (seen in several IndexedDB operations across stories)
- `.catch(() => {})` on promises — silently swallows errors
- IndexedDB `put()`/`add()` without error callbacks or try/catch
- Async event handlers (`onClick={async () => { ... }}`) without try/catch
- `scrollIntoView()` and DOM APIs called without checking element existence
- Fire-and-forget store actions — async Dexie operations whose failure silently breaks UI state

## Project Conventions
- Import alias: `@/` resolves to `./src`
- Card border radius: `rounded-[24px]`
- Button border radius: `rounded-xl`
- Primary CTA color: `bg-blue-600`
- shadcn/ui components in `src/app/components/ui/`
- Custom components in `src/app/components/figma/`
- Dexie.js DB defined in `src/db/schema.ts`, re-exported from `src/db/index.ts`
- tsconfig.json has `noFallthroughCasesInSwitch: true` -- fallthrough switch requires special handling
- `Tooltip` component from shadcn/ui wraps each instance in its own `TooltipProvider`, so multiple Tooltip uses are fine
