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

### E02-S02: Video Playback Controls and Keyboard Shortcuts
- LessonPlayer does NOT pass `captions` prop to VideoPlayer -- caption toggle and font size controls never render
- `video::cue` pseudo-element CANNOT inherit CSS custom properties from parent elements -- must use dynamic `<style>` injection
- `h-N w-N` instead of `size-N` continues in VideoPlayer (19 instances) -- recurring pattern from S03/S04
- `setTimeout` without cleanup in `triggerCompletion` and `announce` -- no ref-based timer management
- Speed menu dropdown has no click-outside-to-close behavior
- No unit tests exist for VideoPlayer.tsx or LessonPlayer.tsx -- all coverage is E2E only
- `prefers-reduced-motion` global override in index.css sets `transition-duration: 0.01ms !important`, which kills ALL transitions including intentional reduced-motion alternatives
- `motion-safe:` Tailwind prefix used correctly for conditional animations

## Recurring Anti-Patterns (cross-story)
- Missing unit tests for new/modified components (S03 factories unused, S04 StatusFilter untested, S02 VideoPlayer untested)
- `h-N w-N` instead of Tailwind v4 `size-N` shorthand (every story since S03)
- Props available in data types but not threaded through to components (S02 captions)

## Project Conventions
- Import alias: `@/` resolves to `./src`
- Card border radius: `rounded-[24px]`
- Button border radius: `rounded-xl`
- Primary CTA color: `bg-blue-600`
- shadcn/ui components in `src/app/components/ui/`
- Custom components in `src/app/components/figma/`
- Dexie.js DB defined in `src/db/schema.ts`, re-exported from `src/db/index.ts`
