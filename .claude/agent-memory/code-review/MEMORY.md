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

### E03-S00: Data Layer Migration (Notes & Bookmarks)
- Previous review: 2 blockers fixed (compound index, MiniSearch wiring), 3 high fixed (re-throw migration error, saveNote query by courseId, removed duplicate useEffect)
- `fake-indexeddb/auto` in progress.test.ts overrides jsdom localStorage -- `localStorage.clear()` throws TypeError, all 45 tests fail
- `migrateBookmarksFromLocalStorage()` runs fire-and-forget BEFORE `db.open()` -- race condition: Dexie tables may not exist yet
- `progress.ts` note functions (`saveNote`, `addNote`, `deleteNote`) still do NOT use `persistWithRetry` (no retry on transient failure)
- `useNoteStore` and `useBookmarkStore` are NOT imported by any component -- stores are dead code in production
- Bookmark migration (`migrateBookmarksFromLocalStorage`) has ZERO unit tests
- `handleNoteChange` in LessonPlayer calls `saveNote` from `progress.ts` (no retry) instead of `useNoteStore.saveNote` (with retry + optimistic update)
- AC1 says "version 2 to version 3" but implementation uses version 4 (version 3 was already taken for progress table)
- No input validation/sanitization on note content before storing to Dexie (XSS concern if content is rendered as HTML)

### E03-S01: Markdown Note Editor with Autosave
- `video://` protocol NOT registered in Tiptap Link extension -- `parseHTML` strips `video://` links on `setContent` (persistence broken)
- `onVideoSeek` captured in `useEditor` closure (stale closure risk), while `onSave` correctly uses latest-ref pattern
- `formatTimestamp` is yet another copy of `formatTime` (now in 5+ places) -- shared utility still not extracted
- `handleNoteChange` calls both `setNoteText(value)` AND `saveNote(...)` -- double write path, and `setNoteText` triggers re-render that updates `initialContent` prop (potential `setContent` thrash)
- ToolbarButton is `h-8 w-8` (32px) -- below 44px WCAG touch target minimum (recurring pattern)
- `h-4 w-4` / `h-8 w-8` used instead of `size-4` / `size-8` Tailwind v4 shorthand (recurring pattern)
- `insertLink` uses `window.prompt()` with no URL validation -- user can input arbitrary URLs
- No unit tests for NoteEditor component
- E2E tests missing: keyboard shortcuts (AC1), max-wait 10s forced save (AC2), MiniSearch index update (AC2), timestamp link click-to-seek (AC4)
- `cn()` correctly used throughout (improvement over earlier stories)

### E03-S11: Rich Text Toolbar Expansion
- `@tiptap/extension-link` still in package.json despite pre-flight AC requiring removal (StarterKit bundles it)
- `Highlight.configure({ multicolor: true })` enables CSS injection via pasted `<mark data-color="...">` -- toolbar never uses color arg, so multicolor is unnecessary
- `TextStyle` and `Color` imported from `@tiptap/extension-text-style` but NEVER used in toolbar -- dead extensions that expand paste-parsing attack surface
- `#fef08a` hardcoded in `index.css` for `.tiptap mark` -- violates design token convention (should use CSS variable)
- `handleNoteChange` in LessonPlayer no longer calls `setNoteText(value)` -- stale note content on tab switch or lesson navigation
- `formatTimestamp` duplicated for 6th time across codebase (tech debt from S01/S08 reviews still unresolved)
- Duplicate E2E specs: `tests/e2e/story-3-11.spec.ts` (active, 315 lines) vs `tests/e2e/regression/story-3-11.spec.ts` (original ATDD, 340 lines) with divergent test approaches
- S01 review items FIXED in S11: `video://` protocol now registered via StarterKit link config `protocols: ['video']`; ToolbarButton now `size-11` (44px); `window.prompt()` replaced with shadcn Dialog; `onVideoSeek` uses latest-ref pattern
- `cn()` and `size-*` Tailwind v4 shorthand consistently used (improvement over all previous stories)

### E03-S12: Code & Media Blocks
- `lowlight/common` imports 37 languages (~376KB raw); AC specifies 6 languages (~79KB raw, ~25KB target) -- should use selective `createLowlight()` with individual imports
- `isValidYoutubeUrl` regex in NoteEditor is stricter than Tiptap's built-in regex -- rejects valid `m.youtube.com`, `music.youtube.com`, `youtube.com/shorts/`, `youtube.com/v/` URLs
- Syntax highlighting comment color `oklch(0.60 0.02 250)` has ~3.1:1 contrast ratio against muted background -- fails WCAG AA 4.5:1 for normal text
- Details toggle button CSS is `width: 1.25rem; height: 1.25rem` (20px) -- below 44px WCAG touch target minimum
- E2E tests do NOT test drag-and-drop image insertion (AC2 specifies "drags an image file onto the editor") -- only tests toolbar file input
- E2E tests have no edge case coverage: invalid YouTube URLs, oversized images, empty code blocks
- First AC2 test only asserts button visibility, never actually uploads -- low-value test
- S11 items FIXED in S12: `multicolor: true` removed from Highlight; `TextStyle`/`Color` dead extensions removed; `@tiptap/extension-link` removed from package.json; `handleNoteChange` now calls `setNoteText(value)` again
- `formatTimestamp` still duplicated (7th copy across codebase) -- shared utility still not extracted
- `cn()` and `size-*` consistently used throughout (continuing improvement)

### E03-S13: Smart Editor UX
- `replaceAll` command in SearchReplaceExtension updates `storage.results` AFTER dispatching the replacement transaction -- decorations read stale positions during that transaction, potentially crashing or misrendering
- Cmd+F handler uses `document.addEventListener('keydown')` -- hijacks browser native find while Notes tab is active
- BubbleMenuBar buttons use `size-9` (36px), inconsistent with main toolbar's `size-11` (44px)
- Color swatch buttons are `size-7` (28px) -- meets AA 2.5.8 (24px min) but not AAA 2.5.5 (44px target)
- Drag handle button is `size-6` (24px) -- at the exact AA 2.5.8 minimum boundary
- FindReplacePanel has 7 `eslint-disable` for `@typescript-eslint/no-explicit-any` -- custom commands not typed via module augmentation
- `@tiptap/extension-floating-menu` in package.json but never imported (dead dependency)
- `@tiptap/extension-emoji` loads 1933 emojis (582KB raw) eagerly -- no lazy loading
- `scrollIntoView({ behavior: 'smooth' })` in SearchReplaceExtension and TableOfContentsPanel does NOT respect `prefers-reduced-motion` (recurring pattern)
- `formatTimestamp` consolidation finally happened via `src/lib/format.ts` -- but `formatTime` duplicates remain in VideoPlayer and ChapterProgressBar
- `cn()` and `size-*` Tailwind v4 shorthand consistently used throughout (continuing improvement from S11/S12)
- S12 `isValidYoutubeUrl` regex fixed (now accepts `shorts/` and `v/` paths)
- Details toggle button now `width: 2.75rem; height: 2.75rem` (44px) -- WCAG fix from S12

### E03-S14: Tables
- Context menu has `role="menu"`/`role="menuitem"` but NO arrow key navigation between items -- WAI-ARIA menu pattern requires ArrowUp/ArrowDown
- `--table-selected` token defined in `:root` but NOT in `.dark` -- table cell selection will look wrong in dark mode
- AC2 says "Enter creates a new row at the end" but E2E test only covers Tab at end (which is the actual TipTap behavior)
- `useLayoutEffect` with `position.y` in deps triggers a guaranteed double-render when clamping (safe but wasteful)
- Grid picker label shows "col x row" (e.g., "2 x 4") which is inverted vs conventional "rows x cols" -- confusing
- S13 items that persist: `@tiptap/extension-floating-menu` dead dep, emoji eager loading, syntax comment contrast
- Items FIXED from first review: stale closure in grid picker, `role="menu"`/`role="menuitem"` added, `selectedCell` uses CSS variable, column-resize-handle dead CSS removed, inline styles replaced with Tailwind, `aria-live` on size label, `min-h-11` replaces inline style, `useLayoutEffect` for viewport clamping, focus management on open, Tab-at-end E2E test added
- `cn()` and `size-*` consistently used throughout (continuing improvement)

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
