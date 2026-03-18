# Story-Level Review Details

Detailed findings per story, referenced from MEMORY.md.

## E01-S03 through E04-S02

See git history for these older reviews. Key recurring patterns captured in MEMORY.md.

## E05-S01: Daily Study Streak Counter (Round 3)
- BLOCKER (RECURRING x8): Core fixes exist ONLY in working tree
- Committed `logStudyAction` does NOT dispatch `study-log-updated` event
- Committed `getCurrentStreak` still uses `Math.floor` (DST bug)
- E2E AC2 test manually dispatches event, masking broken `logStudyAction`
- `_progressCache` in progress.ts returns mutable reference
- ErrorBoundary uses hardcoded `bg-[#FAF5EE]`, `bg-white`, `h-16 w-16`

## E05-S05: Study Reminders & Notifications
- BLOCKER (RECURRING x9): ENTIRE implementation exists ONLY in working tree
- `startIntervals` captures stale `settings.dailyReminderTime`
- `handleStudyUpdate` event listener is a no-op (dead code)
- Zero unit tests for studyReminders.ts and ReminderSettings.tsx
- No E2E tests for AC4/AC5 (notification fires)

## E05-S06: Streak Milestone Celebrations
- BLOCKER (RECURRING x10): Multiple round-1 fixes exist ONLY in working tree
  - TIER_CONFIG/getTierConfig moved to streakMilestones.ts (uncommitted)
  - cn() usage in MilestoneGallery and StreakMilestoneToast (uncommitted)
  - sessionStorage dedup guard in celebrateMilestones (uncommitted)
  - tabIndex={0} removal from heatmap cells (uncommitted)
  - useEffect missing celebrateMilestones dep (uncommitted)
  - semantic ul/li in MilestoneGallery (uncommitted)
  - streakStartDate in AC7 E2E seed (uncommitted)
  - confetti assertions for AC2-4 (uncommitted)
- AC7 test passes for wrong reason (missing streakStartDate in seed)
- celebrateMilestones fires on every event without dedup (committed version)
- MilestoneGallery reads milestones only on mount (stale data when popover opens after earning)
- getStreakStartDate() called twice in detectAndRecordMilestones (midnight race)
- confetti useEffect deps should be [milestone.id] not [milestone.milestoneValue]

## E07-S02: Recommended Next Dashboard Section (Round 3)
- Round 2 blocker addressed: custom event dispatched from saveAllProgress(), listened in RecommendedNext
- Round 2 H2 addressed: responsive grid now uses sm:grid-cols-2 lg:grid-cols-3
- Round 2 M1 addressed: bg-blue-100 replaced with bg-brand-soft theme token
- Skeleton duplication fixed: RecommendedNextSkeleton exported and reused in Overview.tsx
- AC5 E2E test improved: now seeds 1 course, verifies 1 card, adds 2nd course via page.evaluate, reloads, asserts 2 cards
- REMAINING: AC5 test uses reload (remount) not same-tab custom event reactivity -- tests "return to dashboard" not live update
- REMAINING: loadSessionStats() fire-and-forget in useEffect (no .catch())
- REMAINING: `totalLessons` from modules.reduce may diverge from course.totalLessons field

## E06-S01: Create Learning Challenges (Round 3)
- Round 2 items largely fixed: parseLocalDate, error state, cn(), deleteChallenge throw, integer validation, ignore flag
- REMAINING: E2E afterEach cleanup is fire-and-forget (callback-based IDB API not awaited)
- REMAINING: useEffect ignore flag is a no-op (loadChallenges state update happens in store, not in .then())
- REMAINING: Validation errors don't clear on input change (persist until next submit)
- REMAINING: `type as ChallengeType` cast when type is '' produces "Target undefined must be a whole number"
- REMAINING: E2E afterEach IDB cleanup doesn't await transaction completion -- test isolation risk

## E06-S02: Track Challenge Progress
- String comparison for date filtering (`p.updatedAt >= challenge.createdAt`) -- fragile with mixed ISO formats
- useEffect `.then()` chain lacks cleanup/ignore flag (stale updates on unmount)
- `refreshAllProgress` optimistic UI update before DB write -- progress "resets" on reload if bulkPut fails
- Streak progress not scoped to challenge creation date (contradicts AC4 wording)
- No `updatedAt` index on contentProgress -- full table scan for completion progress
- E2E afterEach IDB cleanup fire-and-forget (recurring from E06-S01)

## E06-S03: Challenge Milestone Celebrations
- `fireMilestoneToasts` setTimeout timers never cleaned up on unmount -- leaked toasts after navigation
- `refreshAllProgress` returns milestoneMap outside try/catch -- returns stale empty map on error
- `confettiColors` array reference in useEffect deps causes re-fire (referential inequality)
- Hardcoded hex colors in confettiColors (acceptable for canvas-confetti, not Tailwind classes)
- `hasFiredRef` prevents milestone toasts after first load -- new milestones from manual refresh never celebrated
- E2E afterEach IDB cleanup fire-and-forget (recurring from E06-S01)
- ChallengeMilestoneToast missing `role="status"` for screen reader announcements

## E07-S04: At-Risk Course Detection & Completion Estimates (Round 1)
- No uncommitted changes (pattern broken -- positive)
- H1 (RECURRING): `text-gray-500` hardcoded in CompletionEstimate.tsx instead of `text-muted-foreground`
- H2: Division by zero in completionEstimate.ts when all sessions have duration:0 (renders "Infinity sessions")
- H3: No clamp on negative remainingContentMinutes (stale progress can produce negative values)
- H4 (RECURRING): Hardcoded orange-* Tailwind classes in AtRiskBadge instead of theme tokens (--warning exists)
- H5: E2E beforeEach missing sidebar localStorage seed -- will fail on tablet viewport in CI
- M1: Hard wait `waitForTimeout(500)` in AC6 sort test
- M2: Date.now() in pure calculation functions blocks deterministic unit testing
- M3: JSX whitespace bug renders "session s" instead of "sessions" in CompletionEstimate
- M4: Magic number 15 (minutes per lesson) not extracted as constant

## E07-S05: Smart Study Schedule Suggestion
- `allocateTimeAcrossCourses` over-allocates when courses > dailyMinutes (Math.max(1) floor inflates sum)
- `bg-blue-600` hardcoded on Progress indicators instead of theme token `bg-brand`
- `buildActiveCoursesWithMomentum` iterates `allCourses` twice (two `.map()` passes), minor perf
- No test coverage for allocation sum-to-budget invariant
- E2E tests don't cover AC6 (rolling window updates) -- only static state snapshots

## E08-S01: Study Time Analytics (Revalidation)
- Round 1 fixes verified: ignore flag, useMemo, loading state, ARIA cleanup, .catch() on Reports.tsx
- REMAINING: Sidebar seed in test beforeEach runs AFTER page.goto (should be before)
- REMAINING: Weekly adherence uses sliding window from most recent session, not current calendar week (contradicts AC2 "this week")
- REMAINING: AC2.2 "real-time update" unimplemented -- component loads sessions once in useEffect([]), no subscription
- REMAINING: AC2.2 test uses page.reload() to simulate real-time, masking the gap
- REMAINING: AC3.3 test conditional assertion `if (count > 0)` silently passes when no elements found
- REMAINING: Hard wait `waitForTimeout(100)` in keyboard navigation test
- Math.max(...sessions.map(...)) stack overflow risk with large arrays

## E09-S02: Web Worker Architecture & Memory Management
- H1: `terminate()` clears pendingRequests without rejecting -- promises hang forever (also on visibilitychange)
- H2: search.worker.ts global error handler posts response without `requestId` -- coordinator can't route it
- H3: Per-request `addEventListener('message', handleMessage)` leaks if worker crashes before responding
- H4: E2E tests only cover AC1, AC6, AC7 -- missing AC2 (idle termination), AC3 (visibility), AC4 (crash recovery), AC5 (no-worker fallback), AC8 (Vite config verified at runtime), AC9 (useWorkerCoordinator unmount)
- M1: `bulkSaveEmbeddings` in vector-store.ts has no error handling -- partial writes with no rollback
- M2: `supportsModuleWorkers()` returns same value as `supportsWorkers()` -- misleading (Firefox <114 supports workers but not module workers)

## E09B-S01: AI Video Summary (Round 2)
**Round 1 fixes verified:**
- BLOCKER fixed: `_testApiKey` now typed on interface, `import.meta.env.DEV` gating added
- H1 fixed: AbortController ref with useEffect cleanup on unmount
- H2 fixed: Existing controller aborted before new one created (re-invocation safe)
- H3 fixed: `as any` cast removed, `_testApiKey` on typed interface
- M2 fixed: Timeout override via `window.__AI_SUMMARY_TIMEOUT__`, test uses 3s
- M3 fixed: Sidebar localStorage seed added to beforeEach

**Round 2 findings:**
- H1: CSP connect-src missing entries for 3 new providers (Groq, GLM, Gemini) -- API calls will be silently blocked
- H2: VTT parser duplicated between aiSummary.ts and TranscriptPanel.tsx (identical parseVTT/parseTime functions)
- H3: Word count computed per-chunk in streaming loop is O(n^2) over accumulated text
- H4: Test `mockOpenAIStreaming` checks abort BEFORE delay, so abort mid-stream races with yield
- M1: Still no word count validation/warning displayed to user (comment says "prompt-enforced only")
- M2 (RECURRING): `(window as any)` casts for test hooks -- typed window interface extension preferred
- Nit: `handleGenerate` abort-cancelled state leaves component in `generating` -- no visual reset

## E9B-S03: AI Learning Path Generation
- BLOCKER: 20s timeout violates AC6 2-second requirement; AC6 E2E test only exercises "no API key" path, never network timeout
- H1 (RECURRING): Fire-and-forget `regeneratePath()` calls in handleRegenerateClick and handleRegenerateConfirm
- H2: Timeout promise `setTimeout` never cleared on success (resource leak)
- H3 (RECURRING): `w-12 h-12` instead of `size-12` Tailwind v4 shorthand
- M1: `text-white` hardcoded instead of `text-gold-foreground` theme token (dark mode contrast)
- M2: `font-heading` class not a valid Tailwind v4 utility (works by coincidence from base layer h1/h3 styles)
- M3: Optimistic UI reorder without rollback on persistence failure (violates pre-review checklist)
- M4: Grammar error in empty state message ("You need at least 2 courses are needed")
- Positive: No uncommitted changes (pattern broken), typed Window mock interface, good LLM response validation

## E9B-S04: Knowledge Gap Detection
- H1 (RECURRING x14): String interpolation for className instead of cn() in GapCard component (2 instances)
- H2: Under-noted detection logic scales incorrectly -- per-video noteCount compared against videoCount/3 (course-level), so courses with 30 videos require 10+ notes per video
- H3: Bidirectional note link write (two db.notes.put) not wrapped in Dexie transaction -- partial write risk
- H4: progress.ts constructs stale savedNote for link suggestions (uses pre-write `existing` object)
- H5 (RECURRING from E9B-S03): setTimeout in Promise.race never cleared on success (resource leak)
- M1: Unused `toast` import in useNoteStore.ts
- M2: dismissNoteLinkPair silently swallows localStorage write failures (empty catch)
- M3: AI response descriptions not type-guarded (non-string values flow to UI)
- Positive: No uncommitted changes, clean state machine, good AbortController cleanup, typed Window mock

## E9B-S06: AI Feature Analytics & Auto-Analysis (Round 1)
- H1 (RECURRING): `trackAIUsage()` calls in instrumented files are fire-and-forget without `.catch()` -- promise rejections unhandled
- H2 (RECURRING): String interpolation `${trendConfig.className}` in AIAnalyticsTab.tsx instead of `cn()` utility
- H3: `getAIUsageTimeline` ISO string comparison for timestamps -- lexicographic sort works for ISO but fragile pattern
- H4: AC3 E2E test verifies `typeof window !== 'undefined'` -- trivially true, doesn't test auto-analysis
- M1: `autoAnalysis.ts` records `'summary'` as featureType instead of a distinct auto-analysis feature type
- M2: `buildChartConfig()` called on every render without memoization
- M3: `parseTagsFromResponse` silently returns empty array on parse errors (catch block with no logging)
- Positive: No uncommitted changes, good ignore flag pattern in useEffect, proper AbortController cleanup, consent gating well-implemented

## E9B-S06: AI Feature Analytics & Auto-Analysis (Round 2 - Revalidation)
**Round 1 fixes verified:**
- H1 FIXED: `.catch(() => {})` added to all `trackAIUsage()` calls in AISummaryPanel, QAChatPanel, OrganizeNotesButton, useLearningPathStore
- H2 FIXED: `cn()` used for className merging in stat cards
- H4 FIXED: AC3 test now imports `triggerAutoAnalysis` directly and verifies consent gating blocks AI requests
- M1 FIXED: `autoAnalysis.ts` now uses `'auto_analysis'` featureType
- M2 FIXED: `CHART_CONFIG` hoisted to module-level constant
- M3 FIXED: `console.warn` added to parseTagsFromResponse catch block

**Round 2 findings:**
- H1: `autoAnalysis.ts` Gemini API key sent as Bearer header instead of `?key=` query param (will 401 for Gemini users)
- H2: Retry button `setPeriod(p => p)` is a no-op -- React skips re-render when setter returns same value
- M1: Hard wait `setTimeout(r, 500)` in AC3 test without justification comment
- Nit: Story doc says "schema v13" but code is v12 (documentation inaccuracy)

## E10-S02: Empty State Guidance (Round 1)
- No uncommitted changes (positive)
- H1 (RECURRING x15): Fire-and-forget `importCourseFromFolder()` in Overview.tsx onAction -- no .catch()
- H2 (RECURRING): `w-16 h-16` / `w-8 h-8` in EmptyState.tsx instead of `size-*` Tailwind v4 shorthand
- H3 (RECURRING): Hardcoded `bg-blue-600/10 text-blue-600` and `ring-blue-600` in Challenges.tsx (pre-existing)
- H4 (RECURRING): String interpolation for className in Reports.tsx line 330 instead of cn()
- M1: Icon uses `text-brand` instead of design-specified `text-brand-muted`
- M2: Missing `font-display` on empty state title (renders in body font, not heading font)
- M3: Reports `hasActivity` check doesn't include session store data -- users with timer-only activity see empty state
- M4: EmptyState props allow both `onAction` and `actionHref` without TypeScript enforcement
- Positive: Clean E2E tests, proper async cleanup patterns, well-typed component API

## E01-S05: Detect Missing or Relocated Files (Re-Review)
**Round 1 fixes verified:** All 4 high + 3 medium findings addressed (cn(), .catch(), Promise.allSettled index fix, toast aggregation, PDF opacity).
**Round 2 findings:**
- H1 (RECURRING): `verifyAll()` fire-and-forget async without .catch() in useEffect
- H2: Dexie .catch() logs but provides no user-facing error state (empty list indistinguishable from load failure)
- M1: Missing flex-wrap on content rows per design spec (narrow viewport badge overflow)
- M2: Available PDFs rendered as disabled (opacity-75, cursor-not-allowed, aria-disabled) -- contradicts AC3
- M3: No E2E afterEach IndexedDB cleanup between tests
- Positive: All round-1 findings fixed, clean separation of concerns, good unit test coverage for mixed states

## E11-S02: Knowledge Retention Dashboard (Round 1)
- No uncommitted changes (positive)
- H1: Inline `style={{ width: ... }}` on TopicRetentionCard progress bar -- should use Tailwind arbitrary value or CSS variable
- H2: `now` memoized with `useMemo(() => new Date(), [])` -- semantically correct but never updates if user stays on page for hours
- H3: E2E afterEach `.catch(() => {})` silently swallows cleanup failures (recurring pattern)
- M1: `fourWeekAvg` operator precedence relies on NaN || 0 fallback -- fragile
- M2: `getWeeklySessionCounts` and `getWeeklyAvgDurations` redundantly filter `s.endTime` on already-filtered input
- Positive: Pure function architecture, deterministic time injection, proper useEffect ignore flag, comprehensive unit tests, good design token usage

## E11-S03: Study Session Quality Scoring (Round 1)
- No uncommitted changes (positive)
- H1: `recordInteraction` directly mutates Zustand state object -- breaks immutability contract
- H2 (RECURRING x16): String interpolation for className instead of cn() in QualityScoreRing, TrendIndicator, QualityBadge (3 instances)
- H3: `calculateQualityTrend` splitting logic produces wrong groups when scores.length is odd (e.g. 5 scores: recent=[90,85], previous=[80] -- compares 2 vs 1, not spec's "last 5 vs previous 5")
- H4: E2E tests don't test AC5 (real-time tracking) or AC1 quality score dialog display
- M1: `endSession` clears state before persist -- `session-quality-calculated` event fires after state is null (potential race if listener reads store)
- M2: No E2E test for QualityScoreDialog appearance after session ends
- Positive: Pure function scoring engine, comprehensive unit tests, proper design tokens, clean DB migration, good factory usage

## E12-S03: Create useQuizStore with Zustand (Round 1)
- No uncommitted changes (positive)
- H1 (RECURRING): `startQuiz` Dexie query has no try/catch -- unhandled rejection leaves store stuck in loading state
- H2: `loadAttempts` Dexie query has no try/catch -- same pattern
- H3: `scoring.ts` sets `userAnswer: ''` for unanswered questions but `AnswerSchema.userAnswer` requires `.min(1)` -- schema/code divergence
- H4: Cross-store `setItemStatus` call in `submitQuiz` catch block reverts quiz attempt even though Dexie write succeeded -- false failure
- M1: `timerAccommodation` multiplier not applied to `timeRemaining` despite AC stating it should be
- M2: Dead else branch in persist partialize test auto-passes
- Nit: Bare `catch` discards original Dexie error object -- error details lost for debugging
- Positive: Snapshot rollback pattern, correct partialize scope, clean scoring logic, proper persist middleware usage

## E12-S04: Create Quiz Route and QuizPage Component (Round 1)
- No uncommitted changes in story files (positive), but 6 unrelated files modified in working tree
- BLOCKER: Zod schema JSDoc says timeLimit is "milliseconds" and timeRemaining is "milliseconds" but all code treats both as minutes -- future data import will produce 60x wrong timer values
- H1 (RECURRING): Silent .catch() in Quiz.tsx Dexie lookup -- sets error state but no console.error
- H2: Timer countdown in QuizHeader runs locally in useState but never syncs back to Zustand store -- resume gives full time back
- H3: localStorage progress restored via raw JSON.parse + as cast without Zod validation -- corruption vector
- H4 (RECURRING): Uncommitted changes in working tree (6 files including store formatting)
- M1: handleStart fire-and-forget startQuiz().catch(console.error) -- no user-facing error feedback
- M2: aria-live="polite" on timer updates every second; story spec says per-minute updates only
- M3: savedProgress.answers accessed without null guard in QuizStartScreen
- Positive: Clean async cleanup pattern, proper component decomposition, good E2E test quality with shared helpers

## E12-S04: Create Quiz Route and QuizPage Component (Round 2 - Re-Review)
- 5 of 6 carry-forward items STILL OPEN (see Round 1 entry)

## E12-S04: Create Quiz Route and QuizPage Component (Round 3 - Re-Review)
- All 6 Round 1 carry-forward items FIXED in commits 12207ed and ebf19dc
- H1 NEW: Persist middleware only saves currentProgress, not currentQuiz -- browser refresh silently loses quiz state (per-quiz localStorage key has no production writer)
- H2 NEW: useEffect dependency `[remainingSeconds === null]` is fragile boolean expression -- extract to named `isTimed` variable
- H3 NEW: `.catch(console.error)` on startQuiz is dead code (store catches internally) -- misleading error handling
- M1: `??` fallback on questionOrder.length never triggers (always a number) -- use `||` or remove
- M2: handleResume doesn't validate questionOrder entries exist in current quiz questions
- Positive: All round-1/round-2 findings addressed, clean timer sync architecture, proper Zod safeParse on localStorage

## E11-S06: Per-Course Study Reminders (Round 1)
- No uncommitted changes (positive)
- BLOCKER: Notification `data.url` deep-link is inert -- no `onclick` handler or Service Worker `notificationclick` listener (AC2 unmet)
- BLOCKER: `handleSaveNew` async onClick has no try/catch -- silent IndexedDB failure
- H1 (RECURRING): `handleToggle`/`handleSaveEdit` fire-and-forget async without .catch()
- H2: Scheduler never starts if notification permission not granted at mount -- no re-check mechanism (AC4 "activates once permissions granted" gap)
- H3: `shouldFireReminder` comment says "2-minute window" but code checks `diff <= 1` (1-minute window)
- H4: Permission prompt has no escape hatch -- dismissing native dialog leaves user stuck
- M1: `new Date().toISOString()` in production code without injectable time parameter
- M2: Card missing `rounded-[24px]` design convention
- M3: Scheduler runs 60s interval even when all reminders disabled
- Positive: Clean separation of concerns, proper interval cleanup, good accessibility (role=checkbox, aria-checked, 44px targets), proper design token usage, no hardcoded colors
