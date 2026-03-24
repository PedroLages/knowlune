---
story_id: E21-S05
story_name: "User Engagement Preference Controls"
status: done
started: 2026-03-23
completed: 2026-03-24
reviewed: true
review_started: 2026-03-24
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
burn_in_validated: true
---

# Story 21.5: User Engagement Preference Controls

## Story

As a user who values control over my experience,
I want to toggle gamification features (achievements, streaks, badges, animations),
so that I can customize the platform to my learning style.

## Acceptance Criteria

**AC1: Engagement Preferences section exists in Settings**
Given I am on the Settings page
When I scroll to the "Engagement Preferences" section
Then I see toggles for: Achievements, Streaks, Badges, Animations

**AC2: Toggles control feature visibility**
Given I toggle "Streaks" OFF in Engagement Preferences
When I navigate to the Overview page
Then the Study Streak Calendar section is hidden
And the streak stat in the metrics strip is hidden

Given I toggle "Achievements" OFF
When I complete a lesson milestone
Then no confetti celebration or AchievementBanner is shown

Given I toggle "Badges" OFF
When I view course cards or the overview
Then MomentumBadge and similar badge components are hidden

Given I toggle "Animations" OFF
When I navigate between pages or load content
Then all motion/framer-motion animations are disabled (instant transitions)
And confetti effects are suppressed

**AC3: Color scheme picker**
Given I am in the Engagement Preferences section
When I select "Professional" or "Vibrant" color scheme
Then the UI applies the corresponding color palette
(Note: Vibrant palette depends on E21-S04; Professional is the current default)

**AC4: localStorage persistence**
Given I toggle any engagement preference
When I close and reopen the app
Then my preference selections are preserved

**AC5: Default state for new users**
Given I am a new user with no saved preferences
When I first visit the Settings page
Then all toggles default to ON (Achievements, Streaks, Badges, Animations all enabled)
And color scheme defaults to "Professional"

## Tasks / Subtasks

- [ ] Task 1: Create `useEngagementPrefsStore` Zustand store with localStorage persistence (AC: 4, 5)
  - [ ] 1.1 Define `EngagementPrefs` interface (achievements, streaks, badges, animations, colorScheme)
  - [ ] 1.2 Implement Zustand store with localStorage load/save
  - [ ] 1.3 Add unit tests for store
- [ ] Task 2: Create `EngagementPreferences` settings component (AC: 1, 3)
  - [ ] 2.1 Build card section with Switch toggles and color scheme RadioGroup
  - [ ] 2.2 Wire to store
  - [ ] 2.3 Add to Settings page between Appearance and Reminders
- [ ] Task 3: Conditionally render engagement features based on preferences (AC: 2)
  - [ ] 3.1 Create `useEngagementVisible(feature)` hook for clean conditional checks
  - [ ] 3.2 Gate `AchievementBanner` and confetti celebrations
  - [ ] 3.3 Gate `StudyStreakCalendar` and streak stats
  - [ ] 3.4 Gate `MomentumBadge` and other badge components
  - [ ] 3.5 Gate motion animations (respect `animations` toggle via MotionConfig)
- [ ] Task 4: E2E tests (AC: 1-5)
  - [ ] 4.1 Test toggle rendering and persistence
  - [ ] 4.2 Test feature visibility toggling
  - [ ] 4.3 Test default state for new users

## Design Guidance

- Follow existing Settings page card pattern (CardHeader + CardContent)
- Use shadcn Switch component for toggles
- Use RadioGroup for color scheme picker (matches existing theme selector pattern)
- Group toggles with descriptive labels and muted helper text
- Use Sparkles or Gamepad2 icon for section header
- Spacing: consistent with other Settings sections (space-y-6 within card)

## Implementation Notes

**Plan:** [e21-s05-user-engagement-preference-controls.md](plans/e21-s05-user-engagement-preference-controls.md)

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

- **Zustand for reactive preferences**: Using `useEngagementPrefsStore` with selectors (e.g., `s => s.badges`) ensures components only re-render when their specific toggle changes, not on every preference update. The `useEngagementVisible(feature)` hook wraps this pattern for clean one-liner checks.
- **Gating components across the app**: Components like `MomentumBadge` self-gate via the store (returning `null` when disabled), while layout-level components like `StudyStreakCalendar` are gated by the parent page. The self-gating pattern is cleaner for deeply nested components; parent-gating is better when layout adjustments (grid collapse) are needed.
- **Empty grid space when features are disabled**: Initially used an empty `<div />` placeholder when streaks were hidden, which left a large blank column on desktop. Fixed by removing the placeholder entirely and making the grid layout conditional (`lg:grid-cols-[3fr_2fr]` only when streaks are shown), so remaining content takes full width.
- **Standalone functions need store gating too**: The `celebrateCompletion()` export calls confetti outside the React component tree, so it cannot use hooks. Used `useEngagementPrefsStore.getState()` for imperative access to check the animations preference before firing confetti.
- **Vibrant color scheme "coming soon" pattern**: Used a disabled radio option with a "coming soon" badge rather than hiding the option entirely. This signals the feature roadmap to users without cluttering the UI, and avoids re-layout when the feature ships later.
- **Deterministic test data**: Replaced `new Date().toISOString()` in test init scripts with a fixed ISO string to prevent flaky time-dependent behavior in CI environments.
