## Review Summary: E62-S02 -- Unknown Story

Date: 2026-04-14

### Pre-checks

- No pre-check data available

### Design Review

WARNINGS -- 1 medium
Report: docs/reviews/design/design-review-2026-04-12-e111-s03.md

### Code Review (Architecture)

WARNINGS -- 3 high, 2 medium
Report: docs/reviews/code/code-review-2026-04-12-e111-s01.md

### Code Review (Testing)

WARNINGS -- 2 high, 4 medium

### Edge Case Review

Not dispatched

### Performance Benchmark

PASS -- 1 medium
Report: docs/reviews/performance/performance-benchmark-2026-04-12-e111-s01.md

### Security Review

PASS

### Exploratory QA

PASS
Report: docs/reviews/qa/exploratory-qa-2026-04-11-e107-s05.md

### OpenAI Adversarial Review

ERROR

### GLM Adversarial Review

FAIL -- 1 high, 2 medium
Report: docs/reviews/code/glm-code-review-2026-04-12-e110-s03.md

### Deduplication Scan

Skipped

### Consolidated Findings

#### Blockers (must fix)

- unknown: Optimistic UI update before persistence. `addToQueue` sets state before `await db.readingQueue.put(entry)`. If the DB write fails, the user briefly sees the item added then it vanishes on rollback. Same pattern in `removeFromQueue`, `reorderQueue`, and `removeAllBookEntries`. Fix: move all `set()` calls after the successful `await db.*()` calls. (src/stores/useReadingQueueStore.ts:65) [Consensus: 85]
- unknown: Optimistic `deleteClip` rollback is broken — rollback restores stale snapshot, silently undoing concurrent successful mutations (data-loss). Fix: re-insert only the deleted clip, or re-fetch from Dexie on failure. (src/stores/useAudioClipStore.ts:96) [Consensus: 88]
- unknown: Race condition in `addClip` — duplicate sortOrder values under concurrent calls. Fix: wrap read-compute-write in a Dexie transaction, or compute sortOrder from already-loaded in-memory state. (src/stores/useAudioClipStore.ts:70) [Consensus: 95]
- unknown: `loadClips` silently swallows errors — `isLoaded` never set to `true` on query failure, permanently disabling the store. Fix: set `isLoaded: true` in the catch block (with `clips: []`) or introduce a distinct `error` state. (src/stores/useAudioClipStore.ts:53) [Consensus: 90]

#### High Priority (should fix)

- unknown: ABS progress sync (useAudiobookshelfProgressSync) floods console with 188+ repeated 429 errors when playback position changes via clip seek — no rate limiting or backoff on 429 responses. Pre-existing issue, not introduced by E111-S01. [Consensus: 85]
- unknown: AC-1 E2E test verifies toggle persistence and active-indicator visibility but does not exercise the actual silence detection loop (RAF tick, threshold crossing, audio seek). The test passes even if Web Audio API detection is entirely non-functional. No test path covers the full skip event emission. (tests/e2e/story-e111-s02.spec.ts:73) [Consensus: 82]
- unknown: AC-4 (drag-and-drop reorder) has zero test coverage. No E2E test exercises the reorderQueue store action or verifies that the UI order changes persist after reload. [Consensus: 80]
- unknown: AC-4 play-clip E2E assertion is weak: clicks 'play clip' button and asserts audio-playing-indicator without verifying seek to clip start time or stop at end time. No wait for isPlaying state to settle after mock play() resolves. Test does not verify the core AC-4 behavior of seeking to startTime and playing to endTime. (tests/e2e/regression/story-e111-s01.spec.ts:204) [Consensus: 80]
- unknown: AC-7 DnD E2E test only verifies drag handles are visible — does not perform an actual drag reorder or assert new order persists across page reload. The AC explicitly requires persistence across sessions. (tests/e2e/regression/story-e111-s01.spec.ts:266) [Consensus: 78]
- unknown: AC-7 test only covers marking status as 'finished' via dropdown. The AC states '100% progress' as the trigger, but the implementation only emits book:finished on status change — not when progress reaches 100. The test does not cover the progress=100 path, nor is there documentation that it is intentionally excluded. (tests/e2e/story-e110-s03.spec.ts:131) [Consensus: 85]
- unknown: Cancel recording button touch target is 25x44px — below the 44x44px minimum. Missing min-w-[44px] on the cancel button in ClipButton. On touch devices users will frequently miss this target during time-sensitive clip recording. (src/app/components/audiobook/ClipButton.tsx:119) [Consensus: 90]
- unknown: Drag handle and remove buttons are missing type="button". Without it, buttons default to type="submit" per the HTML spec when inside a form ancestor, creating a latent form-submit regression risk. (src/app/components/library/ReadingQueue.tsx:86) [Consensus: 100]
- unknown: ETA formula avgPagesPerDay = (avgSpeedPagesPerHour \* (totalSeconds / 3600)) / (sessionCount / 7) is mathematically incorrect. It divides total pages by sessions-per-week ratio rather than computing actual daily reading rate, producing wildly inaccurate ETAs. (src/services/ReadingStatsService.ts:136) [Consensus: 85]
- unknown: Error fallback object in ReadingStatsSection catch block is missing required avgReadingSpeedPagesPerHour property from ReadingStats interface. TypeScript type violation. (src/app/components/reports/ReadingStatsSection.tsx:71) [Consensus: 92]
- unknown: IDB 'object store not found' errors on first page load before DB upgrade completes caused navigation away from audiobook player, blocking all clip functionality in the initial session. [Consensus: 70]
- unknown: Invalid ARIA: <li role="option"> wraps a <button> child in the speed popover. The ARIA spec prohibits interactive elements inside `option` roles. Screen readers (NVDA, VoiceOver) will double-announce each item as both an option and a button, confusing learners. (src/app/components/audiobook/SpeedControl.tsx:56) [Consensus: 100]
- unknown: Keyboard shortcuts [ and ] for speed adjustment only call setPlaybackRate() but do NOT call updateBookPlaybackSpeed(). Speed changes via keyboard are not persisted per-book to IndexedDB, violating AC-5. The SpeedControl popover correctly calls both. Fix: add updateBookPlaybackSpeed(book.id, newRate) after each setPlaybackRate call in both keyboard shortcut actions. (src/app/components/audiobook/AudiobookRenderer.tsx:266) [Consensus: 100]
- unknown: Module-level AudioContext singletons (\_mediaSource, \_analyser) are never re-bound when the underlying HTMLAudioElement changes (new book). The second book's audio bypasses the analyser entirely — silence detection reads zeroed buffers from a disconnected stale source. (src/app/hooks/useSilenceDetection.ts:21) [Consensus: 88]
- unknown: Optimistic `updateClipTitle` rollback has same stale-snapshot problem — concurrent mutations can be silently overwritten on failure. Fix: re-fetch from Dexie on failure. (src/stores/useAudioClipStore.ts:82) [Consensus: 85]
- unknown: Potential infinite silence skip loop: useSilenceDetection.ts skips only 0.1s (SKIP_LOOKAHEAD_S) per trigger then resets silenceStartRef.current to null, which immediately re-detects silence and fires another skip ~6 times/second until non-silent audio is reached. The diff was truncated so the fix could not be confirmed in source. Causes constant UI flashing, degraded playback, and high CPU. [Consensus: 72]
- unknown: Single-file M4B: repeated chapterend dispatch during fade-out. When defaultPrevented skips setCurrentChapterIndex, the 500ms polling loop re-detects the boundary and fires chapterend ~10 times during the 5s fade, starting competing rAF loops. Fix: always call setCurrentChapterIndex(i) before the defaultPrevented check, or add a fading guard in handleChapterEnd. (src/app/hooks/useAudioPlayer.ts:271) [Consensus: 88]
- unknown: SkipSilenceActiveIndicator has both role="status" (which implies aria-live="polite") and an explicit aria-live="polite" attribute. This redundancy can confuse automated tools and over-specifies semantics. (src/app/components/audiobook/SkipSilenceActiveIndicator.tsx:17) [Consensus: 90]
- unknown: SpeedControl hard-codes SPEED_OPTIONS=[0.5,0.75,1.0,1.25,1.5,1.75,2.0,2.5,3.0] — missing 2.25 and 2.75 that exist in VALID_SPEEDS. A user who sets the global default to 2.25x will play at that rate but see no option selected in the popover. (src/app/components/audiobook/SpeedControl.tsx:19) [Consensus: 100]
- unknown: `isLoaded` guard prevents queue reload after deletion cascade. When `deleteBook` triggers `removeAllBookEntries`, navigating away and back skips `loadQueue` because `isLoaded` is still true. External changes (e.g. another tab) also won't load. Fix: remove the guard or ensure cascade cleanup resets `isLoaded`, or add a comment explaining the tradeoff. (src/stores/useReadingQueueStore.ts:55) [Consensus: 90]
- unknown: `reorderClips(oldIndex, newIndex)` uses array indices that can desync from Dexie data if `isLoaded` is false or clips were externally modified. Fix: guard with `if (!get().isLoaded) return;`. (src/app/components/audiobook/ClipListPanel.tsx:65) [Consensus: 80]
- unknown: `startTime` can be stale in ClipButton; no validation that `endTime > startTime` — a clip with negative duration can be persisted if audio is seeked backward. Fix: add guard before calling `addClip`. (src/app/components/audiobook/ClipButton.tsx:48) [Consensus: 100]
- unknown: activeClipEnd is never cleared on manual play/pause/seek -- stale clip boundary causes unexpected auto-pause during normal playback (src/app/components/audiobook/AudiobookRenderer.tsx:328) [Consensus: 78]
- unknown: computeETA is exported but never called anywhere. AC2 requires ETA display for in-progress books but no component invokes this function — AC2 is unimplemented in the UI. (src/services/ReadingStatsService.ts:106) [Consensus: 88]
- unknown: handlePlayClip uses setTimeout without cleanup -- seekTo/play may execute after component unmount (src/app/components/audiobook/AudiobookRenderer.tsx:316) [Consensus: 82]
- unknown: loadClips has no error handling -- Dexie query failure leaves panel stuck on 'Loading clips...' with no recovery path (src/stores/useAudioClipStore.ts:39) [Consensus: 90]
- unknown: useKeyboardShortcuts crashes with TypeError when keydown event target is document (no tagName property). Happens when no focusable element has focus — real-world edge case on audiobook reader page. (src/app/hooks/useKeyboardShortcuts.ts:62) [Consensus: 100]
- unknown: useSilenceDetection production hook uses Date.now() directly in setLastSkip (line 129). This is benign in production but makes the lastSkip.timestamp field non-deterministic if a unit test is ever written for the detection loop. (src/app/hooks/useSilenceDetection.ts:129) [Consensus: 100]

#### Medium (fix when possible)

- unknown: AC-2 E2E test verifies element attachment and ARIA attributes but does not verify the indicator shows the correct text after a skip event (e.g., 'Skipped 2.3s silence'). The display logic of SilenceSkipIndicator (text formatting, 2000ms hide timer, rapid-skip reset) has no unit test. (tests/e2e/story-e111-s02.spec.ts:99) [Consensus: 75]
- unknown: AC-2 only tests the dropdown (book-more-actions) add path. The right-click ContextMenu path (context-menu-queue-toggle) — the primary desktop UX surface — has no test. (tests/e2e/story-e110-s03.spec.ts:62) [Consensus: 72]
- unknown: AC-3 clips panel test does not verify empty-state message ('No clips yet...') — only checks panel is visible. Empty state is an implicit AC per test quality framework. (tests/e2e/regression/story-e111-s01.spec.ts:193) [Consensus: 72]
- unknown: AC-3 tests removal via the queue item remove button only. The dropdown menu remove-from-queue path (dropdown-menu-queue-toggle when already queued) has no test. (tests/e2e/story-e110-s03.spec.ts:80) [Consensus: 70]
- unknown: AC-5 assertion uses toContainText('1.5x') and AC-6 uses toContainText('1.5') — both are weak partial-match assertions that would pass for any visible text containing those strings. (tests/e2e/story-e111-s02.spec.ts:153) [Consensus: 74]
- unknown: AC-6 asserts title, author, and progress but omits book cover. The AC explicitly names cover as a required display field. Test would pass even if QueueItemCover rendered nothing. (tests/e2e/story-e110-s03.spec.ts:114) [Consensus: 75]
- unknown: AC-8 accessibility test only checks touch target size for startClipBtn. Edit/delete icon buttons inside ClipListPanel are size-8 (32px) — below the 44px minimum — and are not checked. (tests/e2e/regression/story-e111-s01.spec.ts:276) [Consensus: 65]
- unknown: ChapterList emits React duplicate-key prop warnings on every render because chapter.id is undefined for test seed data (and potentially ABS chapters not yet migrated). key={chapter.id} resolves to undefined for all items. (src/app/components/audiobook/ChapterList.tsx:61) [Consensus: 100]
- unknown: Clips panel trigger button in AudiobookRenderer uses a raw <button> without the project focus ring pattern (focus-visible:ring-[3px]). Falls back to browser-default outline — visually inconsistent with all other secondary controls which use the shadcn Button component. (src/app/components/audiobook/AudiobookRenderer.tsx:508) [Consensus: 90]
- unknown: Duplicated decay date formatting logic: getDecayInfo (TopicDetailPopover.tsx:102-130) and formatDecayPrediction (TopicTreemap.tsx:207-233) implement identical threshold logic with different return types. Extract shared utility to src/lib/decayFormatting.ts. (src/app/components/knowledge/TopicDetailPopover.tsx:102) [Consensus: 90]
- unknown: Empty state container applies text-center globally, centering the instruction paragraph. Design principles specify left-aligned body text for LTR languages. Center-aligned multi-line instructional text is harder to read. (src/app/components/library/ReadingQueue.tsx:194) [Consensus: 100]
- unknown: Homepage FCP increased 31.6% (392ms → 516ms), exceeding the 25% relative threshold. Absolute value (516ms) is well within the 1800ms budget. Audio clips changes are confined to AudiobookRenderer — not present on the homepage route. Classified as dev server measurement variance. [Consensus: 70]
- unknown: Library production chunk grew 20.1% (183KB → 220KB), exceeding the 10% bundle growth threshold. Caused by ReadingQueue.tsx, useReadingQueueStore.ts, and BookContextMenu.tsx additions from E110-S03. [Consensus: 90]
- unknown: Missing SheetDescription in ClipListPanel triggers Radix UI console warning on every panel open: 'Missing Description or aria-describedby={undefined} for {DialogContent}'. Screen reader users receive no panel description. AudiobookSettingsPanel shows the correct pattern. (src/app/components/audiobook/ClipListPanel.tsx:319) [Consensus: 90]
- unknown: Module-level MutationObserver (TopicTreemap.tsx:112-120) never disconnects. HMR cycles create new observers without cleanup. Move to useEffect or add singleton guard. (src/app/components/knowledge/TopicTreemap.tsx:112) [Consensus: 82]
- unknown: No test coverage for E62-S02. Story has 8 ACs. Pure functions (getRetentionColor, formatDecayPrediction, getTextColorForBg) are testable without browser. (src/app/components/knowledge/TopicTreemap.tsx:142) [Consensus: 85]
- unknown: No test for the last-chapter-of-book edge case: when chapterend fires on the final chapter (toIndex would equal chapter count), the current implementation still triggers fade+pause with no special handling. The story AC-3 text ('single-file M4B fires chapterend, triggers fade+pause') implies this is expected, but there is no test confirming last-chapter behavior is identical to mid-book chapters, nor that the event detail shape (fromIndex/toIndex) is validated. [Consensus: 80]
- unknown: No tests for optimistic rollback paths in updateClipTitle, deleteClip, and reorderClips. Store has explicit rollback logic that is completely untested. [Consensus: 68]
- unknown: No unit test for cancelTimer called during an active fade (mid-rAF sequence). If the user cancels EOC after chapterend fires but before fadeOutAndPause completes, the fade continues to completion and still calls onPause + sets the localStorage flag. This is a potential UX defect and is unverified. Suggested test: 'cancelTimer during fade does not invoke onPause after cancellation'. [Consensus: 80]
- unknown: No unit test for null audioRef guard in EOC mode (useSleepTimer.ts:109-115). When audioRef.current is null at the time setTimer('end-of-chapter') is called, the chapterend listener is never attached and eocCleanupRef is never set. The test suite exercises the happy path but not this branch. Suggested test: 'EOC mode: silently skips listener attachment when audioRef.current is null'. [Consensus: 80]
- unknown: Progress bar fill div uses transition-[width] duration-300 without motion-reduce:transition-none. Learners who have enabled 'Reduce Motion' in OS settings will still see animated bar width updates, violating WCAG 2.1 SC 2.3.3 and the project's prefers-reduced-motion convention. (src/app/components/audiobook/SleepTimer.tsx:119) [Consensus: 100]
- unknown: RAF tick dataArray (Uint8Array) is allocated inside runDetectionLoop rather than in a ref. Each enable/disable toggle recreates the array. In a high-frequency RAF loop this creates avoidable GC pressure. (src/app/hooks/useSilenceDetection.ts:89) [Consensus: 70]
- unknown: Second useEffect for bookId change detection is redundant -- first effect already covers this case (src/app/components/audiobook/ClipListPanel.tsx:279) [Consensus: 72]
- unknown: SkipSilenceActiveIndicator receives isActive={skipSilence} (stored preference) instead of silenceDetection.isActive (runtime). The badge shows 'active' as soon as the toggle is flipped, even before Play is pressed and while AudioContext is suspended. (src/app/components/audiobook/AudiobookRenderer.tsx:448) [Consensus: 90]
- unknown: Sleep timer popover option buttons briefly detach from DOM when the popover is reopened while a timer is active. Caused by chapterProgressPercent updates triggering re-renders of AudiobookRenderer that propagate to SleepTimer PopoverContent, unmounting/remounting option buttons mid-click. Official spec already works around this with force:true and explicit listbox wait. (src/app/components/audiobook/SleepTimer.tsx:67) [Consensus: 100]
- unknown: SortableClipItem has role='listitem' but is wrapped in <li> -- duplicate semantics for assistive technology (src/app/components/audiobook/ClipListPanel.tsx:109) [Consensus: 75]
- unknown: Test data (BOOK_1, BOOK_2, QUEUE_ENTRY_1, QUEUE_ENTRY_2) is defined inline as module-level constants rather than using factories from tests/support/fixtures/factories/. Project pattern requires factory usage. (tests/e2e/story-e110-s03.spec.ts:13) [Consensus: 70]
- unknown: The <Label> elements for 'Default Speed' (line 82) and 'Default Sleep Timer' (line 145) have no htmlFor attribute. They are not programmatically associated with their radiogroup controls. Screen readers announce them as standalone text rather than as group labels. (src/app/components/audiobook/AudiobookSettingsPanel.tsx:82) [Consensus: 90]
- unknown: The ReadingQueue section is rendered inside the Library page but the section has no landmark role or aria-label on the containing div (data-testid='reading-queue-section'). Screen reader users navigating by landmark cannot distinguish it from other content regions. (src/app/components/library/ReadingQueue.tsx:149) [Consensus: 100]
- unknown: The Skip Silence switch and Auto-Bookmark on Stop switch both have adjacent description paragraphs not linked via aria-describedby. Keyboard/AT users receive no programmatic description when the switch receives focus. (src/app/components/audiobook/AudiobookSettingsPanel.tsx:116) [Consensus: 92]
- unknown: `reorderClips` writes every clip's sortOrder on each drag, issuing N Dexie puts. Fix: only update the two clips that actually changed sortOrder. (src/stores/useAudioClipStore.ts:106) [Consensus: 75]
- unknown: `reorderQueue` issues N individual `update()` calls inside a transaction. For large queues this is N separate write operations. Consider using `bulkPut` for efficiency. (src/stores/useReadingQueueStore.ts:96) [Consensus: 100]
- unknown: addClip returns-id test uses toBeTruthy() + typeof string — would pass for any non-empty string. Should assert UUID format with a regex. (src/stores/**tests**/useAudioClipStore.test.ts:120) [Consensus: 70]
- unknown: bookMap is rebuilt on every render; useMemo would clarify intent and avoid unnecessary work. (src/app/components/library/ReadingQueue.tsx:163) [Consensus: 100]
- unknown: computeAverageReadingSpeed sums totalPages from ALL finished books but only counts session duration from last 90 days. Old books without recent sessions inflate speed unrealistically. (src/services/ReadingStatsService.ts:56) [Consensus: 72]
- unknown: fadeOutAndPause has no cancellation mechanism. If user cancels timer during 5s fade, rAF loop continues and eventually pauses audio. Fix: return a cancel function that calls cancelAnimationFrame and restores volume. (src/app/hooks/useSleepTimer.ts:21) [Consensus: 72]
- unknown: formatSpeed uses '×' (Unicode U+00D7) in SpeedControl.tsx but 'x' (ASCII letter) in AudiobookSettingsPanel.tsx. The player speed button shows '1.5×' while settings presets show '1.5x', creating a visual mismatch. Screen readers also announce them differently. (src/app/components/audiobook/AudiobookSettingsPanel.tsx:45) [Consensus: 99]
- unknown: getReadingStats test only checks typeof — no behavioral test for the main aggregation entry point. (src/services/**tests**/ReadingStatsService.test.ts:180) [Consensus: 75]
- unknown: getTimeOfDayPattern has zero behavioral tests — only an existence check. AC4 bucketing logic is completely untested. (src/services/**tests**/ReadingStatsService.test.ts:300) [Consensus: 78]
- unknown: loadQueue uses isLoaded guard but never resets it, preventing DB refresh on re-navigation. Single-tab assumption should be documented. (src/stores/useReadingQueueStore.ts:38) [Consensus: 75]
- unknown: updateBookPlaybackSpeed in useBookStore has no dedicated unit tests. The error rollback path (Dexie failure), the toast.error call, and the out-of-range validation guard (speed < 0.5 or > 3.0 silently dropped) have zero test coverage. (src/stores/useBookStore.ts:333) [Consensus: 74]
- unknown: updateBookPlaybackSpeed in useBookStore.ts has no input validation — any out-of-range number can be persisted. The UI constrains to 0.5–3.0 but the store API is public and can be called directly. [Consensus: 72]
- unknown: useAppColorScheme() duplicates event-listening logic from useColorScheme() in src/hooks/useColorScheme.ts. Both listen to settingsUpdated and read getSettings().colorScheme. Consider extracting a shared base hook. (src/app/components/reader/readerThemeConfig.ts:104) [Consensus: 90]
- unknown: v47 Dexie migration may omit prior tables — Dexie requires all tables to be re-declared in each version's `.stores()` call or it will drop unlisted tables on upgrade from v46. (src/db/schema.ts:87) [Consensus: 70]

#### Low (improve when convenient)

- unknown: E2E AC-4 test (story-e111-s03.spec.ts:122-123) asserts chapter-progress-bar is 'not.toBeVisible()' but the element may be absent from DOM entirely in countdown mode. This assertion succeeds whether the element is hidden or non-existent; a stricter assertion (count() === 0 or toBeHidden with attached state) would make the intent explicit. [Consensus: 80]
- unknown: E2E test for AC-1 (story-e111-s03.spec.ts:73) is titled 'AC-1/AC-3' but only asserts the badge shows 'EOC' — it does not verify that audio actually fades out or pauses at a chapter boundary. The actual fade+pause behavior for AC-1 is validated only at the unit level (useSleepTimer.test.ts:111-141). For full AC-1 confidence an E2E assertion such as checking audio.paused or the player UI entering a paused state after a dispatched chapterend event would be preferred. [Consensus: 80]
- unknown: EOC chapterend event listener is silently not registered if audioRef.current is null when setTimer is called. Badge shows EOC but chapter-end fade never fires. setActiveOption('end-of-chapter') is called unconditionally before the null check on audioRef. (src/app/hooks/useSleepTimer.ts:109) [Consensus: 85]
- unknown: Fallback in getReaderChromeClasses uses hardcoded default keys without documenting why. (src/app/components/reader/readerThemeConfig.ts:95) [Consensus: 50]
- unknown: Loading intermediate state ('Loading clips...') in ClipListPanel has no E2E test. Per test quality framework, intermediate UI states count as implicit ACs. [Consensus: 55]
- unknown: No test for ClipButton cancel recording path (handleCancelRecording) — state reset and UI return to 'Start Clip' is unverified. [Consensus: 62]
- unknown: Pulsing recording indicator span has aria-label='Recording in progress' but is not aria-hidden. Screen readers may announce this redundantly since the button aria-label already communicates state via 'Start Clip' / 'End Clip'. (src/app/components/audiobook/ClipButton.tsx:104) [Consensus: 90]
- unknown: seedClips uses inline hardcoded data instead of project factory pattern. Minor deviation from test-data conventions. (tests/e2e/regression/story-e111-s01.spec.ts:96) [Consensus: 60]
- unknown: setTimeout(() => inputRef.current?.focus(), 50) for post-render focus is a minor anti-pattern. Low practical risk but useEffect or flushSync would be more deterministic. (src/app/components/audiobook/ClipListPanel.tsx:79) [Consensus: 90]

#### Nits (optional)

- unknown: AC-8 accessibility test verifies ARIA label and role but does not test keyboard-only interaction flow (Tab focus, Enter/Space to open speed popover, arrow key navigation). (tests/e2e/story-e111-s02.spec.ts:192) [Consensus: 60]
- unknown: Cover image uses alt="" (decorative) — this is intentional and correct per WCAG F39 since the book title immediately follows in text. Documented as verified. (src/app/components/library/ReadingQueue.tsx:43) [Consensus: 100]
- unknown: E2E AC-7 test seeds localStorage with an ad-hoc object rather than a typed factory shape. If the prefs schema changes, the seed silently mismatches. (tests/e2e/story-e111-s02.spec.ts:183) [Consensus: 70]
- unknown: Hardcoded fallback hex colors (#3a7553, #866224, #c44850) in getTokenColors may drift from theme.css values. (src/app/components/knowledge/TopicTreemap.tsx:103) [Consensus: 60]
- unknown: No test covers the duplicate-add guard (adding a book already in the queue should be a no-op). The store has this guard at line 46 of useReadingQueueStore.ts but it is untested. [Consensus: 60]
- unknown: Persistence test does not verify queue item order after reload — only presence. If sortOrder persistence is critical (per lessons learned), an order assertion should be added. (tests/e2e/story-e110-s03.spec.ts:97) [Consensus: 60]
- unknown: Progress bar inline style lacks the eslint-disable comment present on the dnd-kit style. (src/app/components/library/ReadingQueue.tsx:110) [Consensus: 65]
- unknown: QUEUE_ENTRY_1.sortOrder: 0 and QUEUE_ENTRY_2.sortOrder: 1 are magic numbers. Named constants would clarify intent. (tests/e2e/story-e110-s03.spec.ts:39) [Consensus: 55]
- unknown: Queue section container div lacks a landmark role or aria-labelledby. Adding role="section" with aria-labelledby pointing to the h3 would let screen reader users jump to this section via landmark navigation. (src/app/components/library/ReadingQueue.tsx:207) [Consensus: 70]
- unknown: SilenceSkipIndicator has aria-live="polite" and aria-atomic="true" but no explicit role. Adding role="status" would make semantics self-documenting and consistent with SkipSilenceActiveIndicator. (src/app/components/audiobook/SilenceSkipIndicator.tsx:47) [Consensus: 70]
- unknown: SilenceSkipIndicator rapid-skip scenario (two skips within 2s) is not tested — the clearTimeout + reset pattern is correct but unverified. (src/app/components/audiobook/SilenceSkipIndicator.tsx:31) [Consensus: 55]
- unknown: String interpolation for className instead of cn() -- project convention (src/app/components/audiobook/ClipButton.tsx:88) [Consensus: 65]
- unknown: The `book:finished` event subscription correctly reads from `getState()` inside the callback, avoiding stale closures. The `// Intentional:` comment is present. Confirming the pattern is correct — no action needed. (src/app/pages/Library.tsx:162) [Consensus: 60]
- unknown: The inline test data object (story-e111-s03.spec.ts:21-51) is defined directly in the spec rather than using a factory from tests/support/fixtures/factories/. Per test-patterns.md, factories should be preferred. Low risk since this is a leaf spec, but deviates from the project factory convention. [Consensus: 80]
- unknown: Visible label 'Chapter progress' (line 109) does not exactly match the aria-label 'Current chapter progress' (line 116). Sighted and AT users read slightly different text for the same control. (src/app/components/audiobook/SleepTimer.tsx:109) [Consensus: 95]
- unknown: [Recurring] Multiple h-3.5 w-3.5 instances should use size-3.5 Tailwind v4 shorthand. (src/app/components/library/BookContextMenu.tsx:92) [Consensus: 80]
- unknown: [Recurring] String interpolation for conditional className instead of cn() in AudiobookSettingsPanel speed preset buttons and sleep timer option buttons. (src/app/components/audiobook/AudiobookSettingsPanel.tsx:99) [Consensus: 65]
- unknown: handleBookmarkDeleted calls onBookmarkChange() inside a setState updater — side effects inside updaters are unsafe in concurrent React. Also has an empty dep array so it captures a stale onBookmarkChange reference. (src/app/components/audiobook/AudiobookRenderer.tsx:133) [Consensus: 80]
- unknown: new Date() in service functions creates implicit time dependency. Tests cover this with vi.useFakeTimers() but the coupling is worth noting. (src/services/ReadingStatsService.ts:64) [Consensus: 65]
- unknown: testAudiobook and testAudiobookB are defined as inline literal objects rather than using factories from tests/support/fixtures/factories/. (tests/e2e/story-e111-s02.spec.ts:20) [Consensus: 60]
- unknown: useSilenceDetection.test.ts header comment claims 'full hook is covered by E2E tests' — the E2E tests do not exercise the RAF detection loop either (no real audio signal in headless). Comment is misleading. (src/app/hooks/**tests**/useSilenceDetection.test.ts:1) [Consensus: 55]

### Verdict

BLOCKED -- fix 4 blocker(s) first
