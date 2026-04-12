## Review Summary: E111-S02 -- Unknown Story
Date: 2026-04-12

### Pre-checks
- No pre-check data available

### Design Review
WARNINGS -- 2 high, 3 medium
Report: docs/reviews/design/design-review-2026-04-12-e110-s03.md

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
- unknown: Infinite silence skip loop. Once silence exceeds 500ms and audio.currentTime is advanced by SKIP_LOOKAHEAD_S (0.1s), the audio is still in the silent region. The code resets silenceStartRef.current = null and immediately starts tracking again. On the next animation frame (~16ms later), silence is still detected, and after another ~500ms, another skip of 0.1s fires. This creates an infinite loop of tiny 0.1s skips (~6/second) until non-silent audio is reached, causing constant UI flashing, rapid seeking that degrades audio playback, and high CPU usage. (src/app/hooks/useSilenceDetection.ts:78) [Consensus: 92]
- unknown: Optimistic UI update before persistence. `addToQueue` sets state before `await db.readingQueue.put(entry)`. If the DB write fails, the user briefly sees the item added then it vanishes on rollback. Same pattern in `removeFromQueue`, `reorderQueue`, and `removeAllBookEntries`. Fix: move all `set()` calls after the successful `await db.*()` calls. (src/stores/useReadingQueueStore.ts:65) [Consensus: 85]
- unknown: Optimistic `deleteClip` rollback is broken — rollback restores stale snapshot, silently undoing concurrent successful mutations (data-loss). Fix: re-insert only the deleted clip, or re-fetch from Dexie on failure. (src/stores/useAudioClipStore.ts:96) [Consensus: 88]
- unknown: Race condition in `addClip` — duplicate sortOrder values under concurrent calls. Fix: wrap read-compute-write in a Dexie transaction, or compute sortOrder from already-loaded in-memory state. (src/stores/useAudioClipStore.ts:70) [Consensus: 95]
- unknown: `loadClips` silently swallows errors — `isLoaded` never set to `true` on query failure, permanently disabling the store. Fix: set `isLoaded: true` in the catch block (with `clips: []`) or introduce a distinct `error` state. (src/stores/useAudioClipStore.ts:53) [Consensus: 90]

#### High Priority (should fix)
- unknown: ABS progress sync (useAudiobookshelfProgressSync) floods console with 188+ repeated 429 errors when playback position changes via clip seek — no rate limiting or backoff on 429 responses. Pre-existing issue, not introduced by E111-S01. [Consensus: 85]
- unknown: AC-1: test only verifies skip-silence-active-indicator is visible after toggling — does not verify that silence detection actually fires (RMS below threshold for >500ms causes seek). Test would pass even if useSilenceDetection were a no-op. (tests/e2e/story-e111-s02.spec.ts:86) [Consensus: 85]
- unknown: AC-2: toBeAttached() on silence-skip-indicator always passes because the element is always in the DOM (rendered with opacity-0). The assertion does not verify the indicator becomes visible or shows text matching 'Skipped X.Xs silence'. (tests/e2e/story-e111-s02.spec.ts:100) [Consensus: 85]
- unknown: AC-4 (drag-and-drop reorder) has zero test coverage. No E2E test exercises the reorderQueue store action or verifies that the UI order changes persist after reload. [Consensus: 80]
- unknown: AC-4 play-clip E2E assertion is weak: clicks 'play clip' button and asserts audio-playing-indicator without verifying seek to clip start time or stop at end time. No wait for isPlaying state to settle after mock play() resolves. Test does not verify the core AC-4 behavior of seeking to startTime and playing to endTime. (tests/e2e/regression/story-e111-s01.spec.ts:204) [Consensus: 80]
- unknown: AC-5: speed persistence test does not navigate away and return to confirm the speed was written to Dexie. Test only verifies the UI label updated in memory, not that updateBookPlaybackSpeed persisted the value. (tests/e2e/story-e111-s02.spec.ts:130) [Consensus: 80]
- unknown: AC-7 DnD E2E test only verifies drag handles are visible — does not perform an actual drag reorder or assert new order persists across page reload. The AC explicitly requires persistence across sessions. (tests/e2e/regression/story-e111-s01.spec.ts:266) [Consensus: 78]
- unknown: AC-7 test only covers marking status as 'finished' via dropdown. The AC states '100% progress' as the trigger, but the implementation only emits book:finished on status change — not when progress reaches 100. The test does not cover the progress=100 path, nor is there documentation that it is intentionally excluded. (tests/e2e/story-e110-s03.spec.ts:131) [Consensus: 85]
- unknown: Cancel recording button touch target is 25x44px — below the 44x44px minimum. Missing min-w-[44px] on the cancel button in ClipButton. On touch devices users will frequently miss this target during time-sensitive clip recording. (src/app/components/audiobook/ClipButton.tsx:119) [Consensus: 90]
- unknown: Drag handle and remove buttons are missing type="button". Without it, buttons default to type="submit" per the HTML spec when inside a form ancestor, creating a latent form-submit regression risk. (src/app/components/library/ReadingQueue.tsx:86) [Consensus: 100]
- unknown: IDB 'object store not found' errors on first page load before DB upgrade completes caused navigation away from audiobook player, blocking all clip functionality in the initial session. [Consensus: 70]
- unknown: Module-level singletons coupled to per-element instance — cross-element contamination. _mediaSource, _audioCtx, and _analyser are module-level singletons, but createMediaElementSource(audio) binds to a specific HTMLAudioElement. If useSilenceDetection is ever used with a different audio element, _mediaSource is non-null so it won't be recreated, but it's still connected to the old element. (src/app/hooks/useSilenceDetection.ts:117) [Consensus: 85]
- unknown: Navigating to a second audiobook URL (/library/:id/read) redirects back to the previously-opened book. The in-memory Zustand AudioPlayerStore.currentBookId drives a redirect during component mount, preventing users from switching audiobooks via URL and blocking full AC-6 cross-book navigation verification. (src/app/components/audiobook/AudiobookRenderer.tsx:165) [Consensus: 80]
- unknown: Optimistic `updateClipTitle` rollback has same stale-snapshot problem — concurrent mutations can be silently overwritten on failure. Fix: re-fetch from Dexie on failure. (src/stores/useAudioClipStore.ts:82) [Consensus: 85]
- unknown: Speed preset buttons in AudiobookSettingsPanel use min-h-[36px] which is below the 44px touch-target minimum. Users on touch devices must tap with high precision to select a playback speed. (src/app/components/audiobook/AudiobookSettingsPanel.tsx:99) [Consensus: 95]
- unknown: `isLoaded` guard prevents queue reload after deletion cascade. When `deleteBook` triggers `removeAllBookEntries`, navigating away and back skips `loadQueue` because `isLoaded` is still true. External changes (e.g. another tab) also won't load. Fix: remove the guard or ensure cascade cleanup resets `isLoaded`, or add a comment explaining the tradeoff. (src/stores/useReadingQueueStore.ts:55) [Consensus: 90]
- unknown: `reorderClips(oldIndex, newIndex)` uses array indices that can desync from Dexie data if `isLoaded` is false or clips were externally modified. Fix: guard with `if (!get().isLoaded) return;`. (src/app/components/audiobook/ClipListPanel.tsx:65) [Consensus: 80]
- unknown: `startTime` can be stale in ClipButton; no validation that `endTime > startTime` — a clip with negative duration can be persisted if audio is seeked backward. Fix: add guard before calling `addClip`. (src/app/components/audiobook/ClipButton.tsx:48) [Consensus: 100]
- unknown: activeClipEnd is never cleared on manual play/pause/seek -- stale clip boundary causes unexpected auto-pause during normal playback (src/app/components/audiobook/AudiobookRenderer.tsx:328) [Consensus: 78]
- unknown: book.playbackSpeed in dependency array causes re-application on every speed change. When the user changes speed via SpeedControl, the optimistic store update changes book.playbackSpeed, which triggers this effect. The guard returns early in most cases, but unnecessary effect executions occur. More critically, if the book object reference changes due to an unrelated field update, the effect could re-fire. (src/app/hooks/useAudiobookPrefsEffects.ts:58) [Consensus: 100]
- unknown: handlePlayClip uses setTimeout without cleanup -- seekTo/play may execute after component unmount (src/app/components/audiobook/AudiobookRenderer.tsx:316) [Consensus: 82]
- unknown: loadClips has no error handling -- Dexie query failure leaves panel stuck on 'Loading clips...' with no recovery path (src/stores/useAudioClipStore.ts:39) [Consensus: 90]
- unknown: opacity: 0 elements with aria-live='polite' cause ghost screen reader announcements. When visible is false, the indicator div still has aria-live='polite' and aria-atomic='true', and the displayText span remains in the DOM. Screen readers may announce stale 'Skipped Xs silence' text when other DOM changes occur nearby. (src/app/components/audiobook/SilenceSkipIndicator.tsx:43) [Consensus: 100]
- unknown: useKeyboardShortcuts crashes with TypeError when a KeyboardEvent is dispatched programmatically without a valid target (e.target is null/undefined causes tagName.toLowerCase() to throw). This is a pre-existing bug not introduced by E110-S03 but exposed during testing at src/app/hooks/useKeyboardShortcuts.ts:62 — the handler accesses e.target.tagName without a null guard. (src/app/hooks/useKeyboardShortcuts.ts:62) [Consensus: 85]

#### Medium (fix when possible)
- unknown: AC-2 only tests the dropdown (book-more-actions) add path. The right-click ContextMenu path (context-menu-queue-toggle) — the primary desktop UX surface — has no test. (tests/e2e/story-e110-s03.spec.ts:62) [Consensus: 72]
- unknown: AC-3 clips panel test does not verify empty-state message ('No clips yet...') — only checks panel is visible. Empty state is an implicit AC per test quality framework. (tests/e2e/regression/story-e111-s01.spec.ts:193) [Consensus: 72]
- unknown: AC-3 tests removal via the queue item remove button only. The dropdown menu remove-from-queue path (dropdown-menu-queue-toggle when already queued) has no test. (tests/e2e/story-e110-s03.spec.ts:80) [Consensus: 70]
- unknown: AC-6 asserts title, author, and progress but omits book cover. The AC explicitly names cover as a required display field. Test would pass even if QueueItemCover rendered nothing. (tests/e2e/story-e110-s03.spec.ts:114) [Consensus: 75]
- unknown: AC-8 accessibility test misses ARIA attributes on SkipSilenceActiveIndicator (role=status, aria-label) and SilenceSkipIndicator (aria-live=polite, aria-atomic=true). (tests/e2e/story-e111-s02.spec.ts:176) [Consensus: 75]
- unknown: AC-8 accessibility test only checks touch target size for startClipBtn. Edit/delete icon buttons inside ClipListPanel are size-8 (32px) — below the 44px minimum — and are not checked. (tests/e2e/regression/story-e111-s01.spec.ts:276) [Consensus: 65]
- unknown: AnalyserNode is never disconnected — AudioContext may enter 'closed' state silently. If the AudioContext is closed by the browser (e.g., after extended inactivity), _audioCtx will be in a 'closed' state and all operations on it will fail silently. (src/app/hooks/useSilenceDetection.ts:133) [Consensus: 72]
- unknown: Clips panel trigger button in AudiobookRenderer uses a raw <button> without the project focus ring pattern (focus-visible:ring-[3px]). Falls back to browser-default outline — visually inconsistent with all other secondary controls which use the shadcn Button component. (src/app/components/audiobook/AudiobookRenderer.tsx:508) [Consensus: 90]
- unknown: Empty state container applies text-center globally, centering the instruction paragraph. Design principles specify left-aligned body text for LTR languages. Center-aligned multi-line instructional text is harder to read. (src/app/components/library/ReadingQueue.tsx:194) [Consensus: 100]
- unknown: Homepage FCP increased 31.6% (392ms → 516ms), exceeding the 25% relative threshold. Absolute value (516ms) is well within the 1800ms budget. Audio clips changes are confined to AudiobookRenderer — not present on the homepage route. Classified as dev server measurement variance. [Consensus: 70]
- unknown: Library production chunk grew 20.1% (183KB → 220KB), exceeding the 10% bundle growth threshold. Caused by ReadingQueue.tsx, useReadingQueueStore.ts, and BookContextMenu.tsx additions from E110-S03. [Consensus: 90]
- unknown: Missing SheetDescription in ClipListPanel triggers Radix UI console warning on every panel open: 'Missing Description or aria-describedby={undefined} for {DialogContent}'. Screen reader users receive no panel description. AudiobookSettingsPanel shows the correct pattern. (src/app/components/audiobook/ClipListPanel.tsx:319) [Consensus: 90]
- unknown: No input validation on playbackSpeed before IndexedDB write. updateBookPlaybackSpeed accepts any number and persists it without bounds checking. UI constrains to 0.5-3.0 but store API is public. (src/stores/useBookStore.ts:335) [Consensus: 72]
- unknown: No tests for optimistic rollback paths in updateClipTitle, deleteClip, and reorderClips. Store has explicit rollback logic that is completely untested. [Consensus: 68]
- unknown: No unit tests exist for useSilenceDetection. The hook contains testable pure logic (calculateRms, 500ms threshold gate, singleton guard) that the E2E environment cannot exercise because no real audio loads. (src/app/hooks/useSilenceDetection.ts:62) [Consensus: 90]
- unknown: React 'key' prop warning emitted from ChapterList when rendering the E2E test fixture audiobook (test-audiobook-e111-s02-a). List items lack unique key props. [Consensus: 90]
- unknown: SKIP_LOOKAHEAD_S = 0.1 is too small to be useful. A 0.1 second skip means the algorithm must detect silence, skip 0.1s, re-detect silence, wait another 500ms, skip another 0.1s. For a 10-second silence gap, this triggers ~15 skip events. (src/app/hooks/useSilenceDetection.ts:46) [Consensus: 68]
- unknown: Second useEffect for bookId change detection is redundant -- first effect already covers this case (src/app/components/audiobook/ClipListPanel.tsx:279) [Consensus: 72]
- unknown: Section headings in AudiobookSettingsPanel (Playback, Sleep Timer, Bookmarks) use text-xs uppercase text-muted-foreground. These are used as aria-labelledby targets for section landmarks, so contrast is functionally important. text-muted-foreground in dark mode may not meet 4.5:1 for 12px text. (src/app/components/audiobook/AudiobookSettingsPanel.tsx:75) [Consensus: 65]
- unknown: SkipSilenceActiveIndicator has role="status" but no explicit aria-live attribute. The element also serves as a landmark label target via aria-label set/cleared conditionally. Some screen reader + browser combinations do not reliably announce state changes without an explicit aria-live declaration. (src/app/components/audiobook/SkipSilenceActiveIndicator.tsx:19) [Consensus: 100]
- unknown: SortableClipItem has role='listitem' but is wrapped in <li> -- duplicate semantics for assistive technology (src/app/components/audiobook/ClipListPanel.tsx:109) [Consensus: 75]
- unknown: Test data (BOOK_1, BOOK_2, QUEUE_ENTRY_1, QUEUE_ENTRY_2) is defined inline as module-level constants rather than using factories from tests/support/fixtures/factories/. Project pattern requires factory usage. (tests/e2e/story-e110-s03.spec.ts:13) [Consensus: 70]
- unknown: Test data defined as inline object literals rather than using factory functions from tests/support/fixtures/factories/. testAudiobook and testAudiobookB repeat chapters/source/totalDuration structure. (tests/e2e/story-e111-s02.spec.ts:22) [Consensus: 75]
- unknown: The ReadingQueue section is rendered inside the Library page but the section has no landmark role or aria-label on the containing div (data-testid='reading-queue-section'). Screen reader users navigating by landmark cannot distinguish it from other content regions. (src/app/components/library/ReadingQueue.tsx:149) [Consensus: 100]
- unknown: `reorderClips` writes every clip's sortOrder on each drag, issuing N Dexie puts. Fix: only update the two clips that actually changed sortOrder. (src/stores/useAudioClipStore.ts:106) [Consensus: 75]
- unknown: `reorderQueue` issues N individual `update()` calls inside a transaction. For large queues this is N separate write operations. Consider using `bulkPut` for efficiency. (src/stores/useReadingQueueStore.ts:96) [Consensus: 100]
- unknown: addClip returns-id test uses toBeTruthy() + typeof string — would pass for any non-empty string. Should assert UUID format with a regex. (src/stores/__tests__/useAudioClipStore.test.ts:120) [Consensus: 70]
- unknown: animate-pulse on the SkipSilenceActiveIndicator dot is missing the motion-safe: guard. The codebase consistently uses motion-safe:animate-pulse elsewhere (ContinueLearning.tsx:187, YouTubeImportDialog.tsx:526). Bare animate-pulse plays for users with prefers-reduced-motion enabled. (src/app/components/audiobook/SkipSilenceActiveIndicator.tsx:26) [Consensus: 100]
- unknown: bookMap is rebuilt on every render; useMemo would clarify intent and avoid unnecessary work. (src/app/components/library/ReadingQueue.tsx:163) [Consensus: 100]
- unknown: loadQueue uses isLoaded guard but never resets it, preventing DB refresh on re-navigation. Single-tab assumption should be documented. (src/stores/useReadingQueueStore.ts:38) [Consensus: 75]
- unknown: useAppColorScheme() duplicates event-listening logic from useColorScheme() in src/hooks/useColorScheme.ts. Both listen to settingsUpdated and read getSettings().colorScheme. Consider extracting a shared base hook. (src/app/components/reader/readerThemeConfig.ts:104) [Consensus: 90]
- unknown: v47 Dexie migration may omit prior tables — Dexie requires all tables to be re-declared in each version's `.stores()` call or it will drop unlisted tables on upgrade from v46. (src/db/schema.ts:87) [Consensus: 70]

#### Low (improve when convenient)
- unknown: Fallback in getReaderChromeClasses uses hardcoded default keys without documenting why. (src/app/components/reader/readerThemeConfig.ts:95) [Consensus: 50]
- unknown: Loading intermediate state ('Loading clips...') in ClipListPanel has no E2E test. Per test quality framework, intermediate UI states count as implicit ACs. [Consensus: 55]
- unknown: No test for ClipButton cancel recording path (handleCancelRecording) — state reset and UI return to 'Start Clip' is unverified. [Consensus: 62]
- unknown: Pulsing recording indicator span has aria-label='Recording in progress' but is not aria-hidden. Screen readers may announce this redundantly since the button aria-label already communicates state via 'Start Clip' / 'End Clip'. (src/app/components/audiobook/ClipButton.tsx:104) [Consensus: 90]
- unknown: SilenceSkipIndicator uses opacity-0 for hiding rather than visibility:hidden/Tailwind invisible class. Per the story's own Lessons Learned, opacity-0 elements are still considered visible by Playwright toBeVisible(), creating false-positive risk in AC-2 tests. SkipSilenceActiveIndicator correctly uses invisible. (src/app/components/audiobook/SilenceSkipIndicator.tsx:50) [Consensus: 100]
- unknown: seedClips uses inline hardcoded data instead of project factory pattern. Minor deviation from test-data conventions. (tests/e2e/regression/story-e111-s01.spec.ts:96) [Consensus: 60]
- unknown: setTimeout(() => inputRef.current?.focus(), 50) for post-render focus is a minor anti-pattern. Low practical risk but useEffect or flushSync would be more deterministic. (src/app/components/audiobook/ClipListPanel.tsx:79) [Consensus: 90]

#### Nits (optional)
- unknown: Cover image uses alt="" (decorative) — this is intentional and correct per WCAG F39 since the book title immediately follows in text. Documented as verified. (src/app/components/library/ReadingQueue.tsx:43) [Consensus: 100]
- unknown: No test covers the duplicate-add guard (adding a book already in the queue should be a no-op). The store has this guard at line 46 of useReadingQueueStore.ts but it is untested. [Consensus: 60]
- unknown: Persistence test does not verify queue item order after reload — only presence. If sortOrder persistence is critical (per lessons learned), an order assertion should be added. (tests/e2e/story-e110-s03.spec.ts:97) [Consensus: 60]
- unknown: Progress bar inline style lacks the eslint-disable comment present on the dnd-kit style. (src/app/components/library/ReadingQueue.tsx:110) [Consensus: 65]
- unknown: QUEUE_ENTRY_1.sortOrder: 0 and QUEUE_ENTRY_2.sortOrder: 1 are magic numbers. Named constants would clarify intent. (tests/e2e/story-e110-s03.spec.ts:39) [Consensus: 55]
- unknown: Queue section container div lacks a landmark role or aria-labelledby. Adding role="section" with aria-labelledby pointing to the h3 would let screen reader users jump to this section via landmark navigation. (src/app/components/library/ReadingQueue.tsx:207) [Consensus: 70]
- unknown: String interpolation for className instead of cn() -- project convention (src/app/components/audiobook/ClipButton.tsx:88) [Consensus: 65]
- unknown: The `book:finished` event subscription correctly reads from `getState()` inside the callback, avoiding stale closures. The `// Intentional:` comment is present. Confirming the pattern is correct — no action needed. (src/app/pages/Library.tsx:162) [Consensus: 60]
- unknown: [Recurring] Multiple h-3.5 w-3.5 instances should use size-3.5 Tailwind v4 shorthand. (src/app/components/library/BookContextMenu.tsx:92) [Consensus: 80]
- unknown: toContainText('1.5') would also pass for '1.50' or any string containing '1.5'. Actual rendered text is '1.5x'. Use toContainText('1.5x') for precision. (tests/e2e/story-e111-s02.spec.ts:142) [Consensus: 60]
- unknown: useSilenceDetection uses Date.now() for lastSkip.timestamp (line 106) while the detection loop uses performance.now(). Minor inconsistency — timestamp field is wall-clock, detection timing is performance clock. (src/app/hooks/useSilenceDetection.ts:106) [Consensus: 60]


### Verdict
BLOCKED -- fix 5 blocker(s) first
