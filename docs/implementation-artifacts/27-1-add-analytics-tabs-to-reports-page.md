---
story_id: E27-S01
story_name: "Add Analytics Tabs To Reports Page"
status: done
started: 2026-03-23
completed: 2026-03-25
reviewed: true
review_started: 2026-03-25
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
burn_in_validated: false
---

# Story 27.1: Add Analytics Tabs To Reports Page

## Story

As a learner,
I want the Reports page to have URL-aware tabs for Study, Quiz, and AI analytics,
so that I can navigate directly to the analytics view I need via URL and the sidebar links from E27-S03 work correctly.

## Acceptance Criteria

**Given** the Reports page loads with no `?tab=` query parameter
**When** I view the page
**Then** the "Study Analytics" tab is selected by default
**And** all existing Study Analytics content renders unchanged

**Given** I navigate to `/reports?tab=study`
**When** the page loads
**Then** the "Study Analytics" tab is selected and its content is visible

**Given** I navigate to `/reports?tab=quizzes`
**When** the page loads
**Then** the "Quiz Analytics" tab is selected
**And** I see aggregate quiz analytics content (retake frequency, quiz count, average score)

**Given** I navigate to `/reports?tab=ai`
**When** the page loads
**Then** the "AI Analytics" tab is selected and its content is visible

**Given** I click a tab on the Reports page
**When** the tab switches
**Then** the URL updates to reflect the selected tab (`?tab=study`, `?tab=quizzes`, or `?tab=ai`)
**And** the URL is replaced (not pushed) so tab switches don't pollute browser history

**Given** I navigate to `/reports?tab=quizzes` with no quiz data
**When** the page loads
**Then** I see an empty state for Quiz Analytics with guidance to take quizzes

**Given** I navigate to `/reports?tab=quizzes` with quiz attempt data
**When** the page loads
**Then** I see aggregate quiz statistics:
  - Total quizzes taken
  - Average score across all attempts
  - Average retake frequency (moved from Study tab)
  - Best/worst performing quizzes
**And** the retake frequency card is no longer shown in the Study Analytics tab

**Given** I navigate to `/reports?tab=invalid`
**When** the page loads
**Then** the "Study Analytics" tab is selected (fallback to default)

## Tasks / Subtasks

- [ ] Task 1: Make Reports tabs URL-aware with useSearchParams (AC: 1, 2, 3, 4, 5, 8)
  - [ ] 1.1 Add `useSearchParams` hook to Reports.tsx
  - [ ] 1.2 Derive `activeTab` from `?tab=` param with fallback to "study"
  - [ ] 1.3 Use controlled `Tabs` component (`value` + `onValueChange`) instead of `defaultValue`
  - [ ] 1.4 Update URL on tab change via `setSearchParams`

- [ ] Task 2: Add Quiz Analytics tab trigger (AC: 3)
  - [ ] 2.1 Add third `TabsTrigger` for "Quiz Analytics" (value="quizzes")
  - [ ] 2.2 Add third `TabsContent` wrapping `<QuizAnalyticsTab />`

- [ ] Task 3: Create QuizAnalyticsTab component (AC: 3, 6, 7)
  - [ ] 3.1 Create `src/app/components/reports/QuizAnalyticsTab.tsx`
  - [ ] 3.2 Load aggregate quiz data: total quizzes, average score, retake frequency
  - [ ] 3.3 Display stat cards for key quiz metrics
  - [ ] 3.4 Add empty state when no quiz attempts exist
  - [ ] 3.5 Move retake frequency card content from Study tab to Quiz tab

- [ ] Task 4: Move retake frequency from Study tab to Quiz tab (AC: 7)
  - [ ] 4.1 Remove retake frequency card from Study Analytics TabsContent
  - [ ] 4.2 Remove retakeData state/effect from Reports.tsx (moved to QuizAnalyticsTab)

- [ ] Task 5: E2E tests (`tests/e2e/regression/story-e27-s01.spec.ts`)
  - [ ] 5.1 `/reports` defaults to Study tab active
  - [ ] 5.2 `/reports?tab=study` shows Study Analytics content
  - [ ] 5.3 `/reports?tab=quizzes` shows Quiz Analytics content
  - [ ] 5.4 `/reports?tab=ai` shows AI Analytics content
  - [ ] 5.5 Tab click updates URL
  - [ ] 5.6 Invalid tab param falls back to Study
  - [ ] 5.7 Quiz Analytics empty state when no data
  - [ ] 5.8 Quiz Analytics shows retake frequency when data exists

- [ ] Task 6: Update existing E2E tests
  - [ ] 6.1 Update `reports-redesign.spec.ts` if tab switching tests break

## Design Guidance

**Layout**: No major layout changes. The existing `Tabs` + `TabsList` + `TabsTrigger` pattern continues. Add a third trigger between Study and AI (or at the end — "Study Analytics | Quiz Analytics | AI Analytics").

**Quiz Analytics Tab Layout** (follow AIAnalyticsTab pattern):
- Row 1: Stat cards (Total Quizzes, Average Score, Average Retakes)
- Row 2: Retake frequency detail card (moved from Study tab)
- Empty state: Use existing `EmptyState` component with quiz-relevant messaging

**Design Tokens**: Use `bg-brand-soft`, `text-brand-soft-foreground` for quiz stat highlights. Follow existing StatsCard pattern.

**Accessibility**: Each tab panel needs `role="tabpanel"` (shadcn handles this). Screen reader text for quiz metrics. `aria-label` on stat cards.

**Responsive**: Tab list should wrap or scroll on mobile. Quiz stat cards use the same `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` pattern.

## Implementation Notes

**Dependency context**: E27-S03 (sidebar links) is already done and expects URL-aware tabs. This story makes the tabs actually respond to `?tab=` params, completing the circuit.

**useSearchParams pattern** (from Notes.tsx:106-107):
```typescript
const [searchParams, setSearchParams] = useSearchParams()
const activeTab = searchParams.get('tab') ?? 'study'
```

**Controlled Tabs** (needed for URL sync):
```typescript
<Tabs value={validTab} onValueChange={(v) => setSearchParams({ tab: v })}>
```

**Tab validation**: Validate tab param against allowed values `['study', 'quizzes', 'ai']`, fallback to 'study'.

**Plan**: [docs/implementation-artifacts/plans/e27-s01-add-analytics-tabs-to-reports-page.md](plans/e27-s01-add-analytics-tabs-to-reports-page.md)

## Testing Notes

- Quiz factory (`tests/support/fixtures/factories/quiz-factory.ts`) provides `makeQuiz`, `makeAttempt` for seeding
- Existing `reports-redesign.spec.ts` tests tab switching between Study and AI — update for 3 tabs
- E27-S03 tests (`story-e27-s03.spec.ts`) test sidebar navigation to tab URLs — those should now activate correct tabs
- Use `navigateAndWait` helper for URL-based navigation tests

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

- **H1 (HIGH)**: Tab triggers are 36px on mobile, below 44px touch target minimum — remove `className="h-9"` from TabsTriggers
- **H2 (HIGH)**: TabsList missing `aria-label` — add `aria-label="Reports navigation"`
- **M1**: Retake frequency appears twice (stat card + detail card) — consider retiring redundant stat card
- **M2**: `replace: true` makes tab switches invisible to browser Back (overlaps with code review blocker)
- **M3**: No entrance animations on QuizAnalyticsTab (inconsistent with Study tab's motion.div)
- Report: `docs/reviews/design/design-review-2026-03-25-e27-s01.md`

## Code Review Feedback

- **BLOCKER**: `{ replace: true }` in `setSearchParams` (Reports.tsx:202) breaks AC 5 — back button skips tab changes
- **BLOCKER**: AC 7 requires "Best/worst performing quizzes" — not implemented in QuizAnalyticsTab
- **HIGH**: `db.quizAttempts.toArray()` full table scan — use `each()` cursor for running average
- **HIGH**: No E2E test for back-button navigation or quiz data-seeded view (AC 5, AC 7)
- **MEDIUM**: Error state conflated with empty state in QuizAnalyticsTab
- **MEDIUM**: `hasActivity` doesn't account for quiz-only users
- Report: `docs/reviews/code/code-review-2026-03-25-e27-s01.md`
- Test report: `docs/reviews/code/code-review-testing-2026-03-25-e27-s01.md`
- Edge case report: `docs/reviews/code/edge-case-review-2026-03-25-e27-s01.md`

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

- **Welcome wizard blocking E2E tests**: The `knowlune-welcome-wizard-v1` localStorage key must be seeded in `addInitScript` for any E2E test that navigates to pages with the welcome wizard overlay. Without it, the modal blocks all tab/button interactions. This was missed during initial test implementation because the test for empty state (`getByText`) could find text through the overlay, while `getByRole('tab')` could not.

- **useSearchParams requires MemoryRouter in unit tests**: When converting Reports from `defaultValue` to controlled `Tabs` with `useSearchParams`, the existing unit tests broke because `useSearchParams` requires a router context. Wrapping the test render in `<MemoryRouter>` resolved this. This is a common pattern when adding URL-aware state to components that previously didn't use routing hooks.

- **Merge conflict with quiz completion rate card**: The retake frequency card move (Study → Quiz tab) conflicted with concurrent work adding a quiz completion rate card. The resolution required carefully preserving both changes — the new completion rate card stayed in the Study tab while the retake frequency card moved to Quiz Analytics.

- **Controlled vs. uncontrolled Tabs pattern**: Converting shadcn `Tabs` from `defaultValue` to `value` + `onValueChange` is the correct pattern for URL-synced tabs. The `VALID_TABS` array with `.includes()` check provides a clean fallback for invalid tab params without additional error handling.
