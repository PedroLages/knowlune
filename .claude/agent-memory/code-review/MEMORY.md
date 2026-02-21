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
