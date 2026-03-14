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
