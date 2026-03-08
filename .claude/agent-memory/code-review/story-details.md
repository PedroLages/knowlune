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
