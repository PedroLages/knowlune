# Quiz & Assessment System - UX Design Specification

**Author:** Pedro
**Date:** 2026-03-14
**Scope:** Epics 12-18 (61 functional requirements: QFR1-QFR61)
**Parent Spec:** [ux-design-specification.md](ux-design-specification.md)

---

## Executive Summary

The Quiz & Assessment System extends LevelUp's learning platform with formative assessment capabilities. Quizzes are embedded within the course lesson flow, providing learners with immediate feedback, performance tracking, and psychometric analytics -- all stored locally in IndexedDB and localStorage, consistent with LevelUp's local-first architecture.

The system supports four question types (Multiple Choice, True/False, Multiple Select, Fill-in-Blank), optional countdown timers with accessibility accommodations, partial credit scoring, and detailed performance analytics including normalized gain and item difficulty metrics.

**Design Philosophy:** Quizzes reinforce learning, not gatekeep it. The UI maintains LevelUp's encouraging, non-judgmental tone throughout -- "Not quite" replaces "Wrong," unlimited retakes replace attempt limits, and growth opportunities replace failure labels. The quiz experience should feel like a natural extension of studying, not a separate high-stakes testing environment.

**Brownfield Integration:** This system integrates into the existing React 18 + TypeScript + Tailwind CSS v4 + shadcn/ui codebase. All components use established design tokens from `src/styles/theme.css`, extend shadcn/ui primitives, and follow existing patterns (Zustand stores, Dexie persistence, responsive breakpoints).

---

## Quiz-Taking Interface

### Quiz Entry Point

**Route:** `/courses/:courseId/lessons/:lessonId/quiz`

Quizzes are accessed from lesson pages via a "Take Quiz" button. The entry follows LevelUp's progressive disclosure pattern -- learners see quiz metadata before committing to start.

**Quiz Start Screen**

The start screen provides context and configuration before quiz begins:

- **Quiz Title**: `font-display text-2xl font-semibold text-foreground` -- centered on desktop, left-aligned on mobile
- **Description**: `text-base text-muted-foreground` -- 1-2 sentences explaining quiz scope
- **Metadata Row**: Question count, time limit (or "Untimed"), passing score -- displayed as inline badges
  - Question count badge: `bg-brand-soft text-brand rounded-full px-3 py-1 text-sm`
  - Time badge: `bg-muted text-muted-foreground rounded-full px-3 py-1 text-sm`
- **Accessibility Accommodations Link**: `text-brand hover:text-brand-hover text-sm underline` -- opens timer configuration dialog (see Timer section)
- **Start Quiz Button**: Primary CTA, `bg-brand text-brand-foreground hover:bg-brand-hover rounded-xl h-12 px-8 text-base font-medium`
- **Resume Quiz Button**: Appears when `currentProgress` exists in localStorage -- shows "Resume Quiz (5 of 12 answered)" with answer count context

**Layout:**
```
┌─────────────────────────────────────────────┐
│  QuizHeader (title)                         │
├─────────────────────────────────────────────┤
│                                             │
│         Quiz Title (text-2xl)               │
│         Description (text-base)             │
│                                             │
│    [12 questions]  [15 minutes]  [70% pass] │
│                                             │
│         [ Accessibility Accommodations ]    │
│                                             │
│            [ Start Quiz ]                   │
│            or                               │
│       [ Resume Quiz (5/12 answered) ]       │
│                                             │
└─────────────────────────────────────────────┘
```

**Container Styling:** `bg-card rounded-[24px] p-8 max-w-2xl mx-auto shadow-sm` -- centered card following LevelUp's card pattern with generous padding for a focused, uncluttered entry experience.

### Question Display

The active quiz interface uses a focused, single-question-at-a-time layout. The existing sidebar and header remain visible but the quiz content area draws primary focus.

**Quiz Header (QuizHeader)**

Persistent across all questions, displaying:

- **Progress Indicator**: "Question 3 of 12" -- `text-sm text-muted-foreground`
- **Progress Bar**: `bg-muted rounded-lg h-2` track with `bg-brand rounded-lg` fill, width proportional to current question index
- **Timer Display**: MM:SS countdown (see Timer section) -- positioned right-aligned in header
- **Quiz Title**: `text-lg font-medium text-foreground` -- truncated with `line-clamp-1` on mobile

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Question 3 of 12          Quiz Title  14:32 │
│ [████████░░░░░░░░░░░░░]                     │
├─────────────────────────────────────────────┤
│                                             │
│  Question text with rich formatting         │
│  (Markdown: code blocks, lists, emphasis)   │
│                                             │
│  ○ Option A                                 │
│  ● Option B (selected)                      │
│  ○ Option C                                 │
│  ○ Option D                                 │
│                                             │
│  [ ] Mark for Review                        │
│                                             │
│  [Feedback card if immediate mode]          │
│                                             │
├─────────────────────────────────────────────┤
│ [ Previous ]  [1][2][3]...[12]  [ Next ]    │
└─────────────────────────────────────────────┘
```

**Question Card:** `bg-card rounded-[24px] p-6 lg:p-8` -- consistent with platform card styling. Question text uses `text-lg lg:text-xl text-foreground leading-relaxed` for readability during study sessions.

**Answer Selection States:**

| State | Visual Treatment |
|-------|-----------------|
| Unselected | `border border-border bg-card hover:bg-accent rounded-xl p-4` |
| Selected | `border-2 border-brand bg-brand-soft rounded-xl p-4` |
| Correct (review mode) | `border-2 border-success bg-success-soft rounded-xl p-4` |
| Incorrect (review mode) | `border-2 border-warning bg-[color:var(--momentum-hot-bg)] rounded-xl p-4` |
| Disabled (review mode) | `opacity-60 cursor-default` |

**Spacing:** Options stack vertically with `space-y-3` gap. Each option has minimum `h-12` (48px) for touch targets exceeding the 44px WCAG AAA requirement.

### Navigation Controls

**QuizActions (Previous/Next/Submit)**

Bottom-anchored navigation bar providing sequential and random-access question navigation:

- **Previous Button**: `variant="outline" rounded-xl h-11 px-6` -- disabled on first question with `opacity-50 cursor-not-allowed`
- **Next Button**: `variant="default" bg-brand rounded-xl h-11 px-6` -- changes to "Submit Quiz" on last question
- **Submit Quiz Button**: `bg-brand text-brand-foreground rounded-xl h-11 px-8 font-medium` -- triggers confirmation if unanswered questions remain

**Question Navigation Grid (QuizNavigation)**

Horizontal scrollable grid showing all question numbers for random-access navigation:

- **Grid Layout**: `flex gap-2 overflow-x-auto py-2` -- scrollable on mobile, wraps on desktop
- **Question Number Button**: `w-10 h-10 rounded-full text-sm font-medium` -- minimum 40px touch target
  - Unanswered: `bg-muted text-muted-foreground border border-border`
  - Answered: `bg-brand text-brand-foreground`
  - Current: `ring-2 ring-brand ring-offset-2`
  - Marked for Review: Additional `border-2 border-warning` overlay with small flag icon

**Mark for Review (MarkForReview)**

Toggle control positioned near the question text (not in the footer):

- **Control**: shadcn/ui Checkbox with label "Mark for Review"
- **Visual**: `text-sm text-muted-foreground` label, checkbox uses `border-warning` when checked
- **Grid Indicator**: Flagged questions show a small `text-warning` flag icon on their grid number

### Answer Auto-Save

Every answer selection triggers immediate state update via `useQuizStore.submitAnswer()`:

1. Zustand state updates optimistically (instant UI feedback)
2. Persist middleware auto-saves `currentProgress` to localStorage (debounced)
3. No explicit "Save" action required -- invisible persistence following the NoteEditor autosave pattern

**Crash Recovery:** On page load, if `currentProgress` exists in localStorage for the current quiz, the start screen shows "Resume Quiz" instead of "Start Quiz." All answers, current question index, timer state, and review marks are restored.

---

## Question Types

### Multiple Choice (QFR9)

**Component:** `MultipleChoiceQuestion.tsx`

Standard single-answer selection using shadcn/ui RadioGroup within a semantic `<fieldset>/<legend>` structure.

**Anatomy:**
- Question text rendered as Markdown via `react-markdown` with `remark-gfm`
- 2-6 answer options displayed as radio buttons
- Single selection enforced (selecting new option deselects previous)
- No default selection (all options unselected initially)

**Styling:**
```
<fieldset>
  <legend> (question text, Markdown-rendered) </legend>
  <RadioGroup className="space-y-3">
    <label className="flex items-start gap-3 p-4 rounded-xl border
                      hover:bg-accent cursor-pointer
                      data-[state=checked]:border-brand
                      data-[state=checked]:bg-brand-soft">
      <RadioGroupItem />
      <span className="text-base text-foreground leading-relaxed">
        Option text
      </span>
    </label>
  </RadioGroup>
</fieldset>
```

**Scoring:** All-or-nothing (0% or 100% of question points).

### True/False (QFR10)

**Component:** `TrueFalseQuestion.tsx`

Binary choice using RadioGroup with exactly two options. Visually identical to Multiple Choice but with only "True" and "False" options.

**Layout Options:**
- **Mobile (<640px):** Stacked vertically, full-width buttons
- **Desktop (>=1024px):** Side-by-side in a 2-column grid (`grid grid-cols-2 gap-3`) for compact presentation

**Scoring:** All-or-nothing (0% or 100% of question points).

### Multiple Select (QFR11)

**Component:** `MultipleSelectQuestion.tsx`

Multi-answer selection using shadcn/ui Checkbox components. Visually distinct from Multiple Choice through checkbox controls (squares vs circles) and an explicit instruction label.

**Key Differences from Multiple Choice:**
- Checkboxes instead of radio buttons (visual cue: square vs circle)
- Instruction text below question: "Select all that apply" in `text-sm text-muted-foreground italic`
- Zero, one, or multiple options may be selected
- Each checkbox toggles independently

**Scoring:** Partial Credit Model (PCM):
```
score = max(0, (correct_selections - incorrect_selections) / total_correct_answers)
```
This penalizes guessing while rewarding partial knowledge. The score is clamped to minimum 0 (no negative points).

**Feedback Display:** Shows "2 of 3 correct" with individual option indicators (checkmark for correct selections, X for incorrect selections).

### Fill-in-Blank (QFR12)

**Component:** `FillInBlankQuestion.tsx`

Free-text input using shadcn/ui Input component within a `<fieldset>/<legend>` structure.

**Anatomy:**
- Question text (Markdown-rendered) with clear indication that a typed answer is expected
- Single-line text input: `bg-input-background border border-border rounded-xl h-12 px-4 text-base w-full max-w-md`
- Placeholder: "Type your answer here" in `text-muted-foreground`
- Character counter (optional): "0/500" in `text-xs text-muted-foreground` right-aligned below input

**Scoring:** Case-insensitive, whitespace-trimmed comparison. "React" = "react" = "REACT" = " react ". All-or-nothing (0% or 100%).

**Accessibility:** The input has a visible label via the `<legend>` element. The placeholder text is supplementary, not the sole label.

### Rich Text Formatting (QFR15)

All question types support Markdown formatting via `react-markdown` with `remark-gfm`:

**Supported Elements:**
- **Code blocks**: Monospace font, `bg-surface-sunken rounded-lg p-4 overflow-x-auto` with horizontal scroll for long lines
- **Inline code**: `bg-surface-sunken text-foreground px-1.5 py-0.5 rounded font-mono text-sm`
- **Lists**: Ordered and unordered with `ml-6 space-y-1` indentation
- **Emphasis**: Bold (`font-semibold`) and italic (`italic`)

**Code Block Styling:**
```css
.quiz-markdown pre {
  background: var(--surface-sunken);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  overflow-x: auto;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}
```

**Responsive:** Code blocks scroll horizontally on mobile without causing page-level horizontal scroll. Text content wraps naturally.

---

## Results & Feedback

### Immediate Answer Feedback (QFR18-QFR19)

**Component:** `AnswerFeedback.tsx`

Feedback appears immediately after answer selection, below the answer options. It does not block navigation -- learners can proceed to the next question at any time.

**Correct Answer:**
```
┌─────────────────────────────────────────┐
│ ✓ Correct!                              │
│                                         │
│ Explanation text rendered as Markdown.  │
│ Reinforces why this answer is right.    │
│                                         │
│ You earned 10 of 10 points.             │
└─────────────────────────────────────────┘
```
- Container: `border-l-4 border-l-success bg-success-soft rounded-lg p-4 mt-4`
- Icon: `CheckCircle` from lucide-react, `h-6 w-6 text-success`
- Title: `font-semibold text-lg text-foreground`

**Incorrect Answer:**
```
┌─────────────────────────────────────────┐
│ ⚠ Not quite                             │
│                                         │
│ Explanation of why this is incorrect.   │
│                                         │
│ Correct answer: Option C                │
│ You earned 0 of 10 points.             │
└─────────────────────────────────────────┘
```
- Container: `border-l-4 border-l-warning bg-[color:var(--momentum-hot-bg)] rounded-lg p-4 mt-4`
- Icon: `AlertCircle` from lucide-react, `h-6 w-6 text-warning`
- Title uses "Not quite" -- never "Wrong" or "Incorrect" (QFR23 non-judgmental messaging)

**Partial Credit (Multiple Select):**
- Shows "2 of 3 correct" with per-option indicators
- Displays points earned: "You earned 6.7 of 10 points"

**Animation:** Feedback card enters with `animate-in slide-in-from-bottom-2 duration-200` (respects `prefers-reduced-motion`).

### Quiz Results Screen

**Route:** `/courses/:courseId/lessons/:lessonId/quiz/results`

**Component:** `QuizResults.tsx` containing `ScoreSummary.tsx` and `PerformanceInsights.tsx`

**Score Display (ScoreSummary)**

The score is the hero element of the results screen:

```
┌─────────────────────────────────────────────┐
│                                             │
│              [ 85% circle ]                 │
│            10 of 12 correct                 │
│                                             │
│           ✓ Passed (70% required)           │
│          Completed in 8m 32s                │
│                                             │
│     "Great job! You're on the right track." │
│                                             │
├─────────────────────────────────────────────┤
│ Progress (if multiple attempts)             │
│ First attempt: 60%                          │
│ Current: 85%  (+25% improvement)            │
│ Normalized Gain: 62.5% (Good progress!)     │
│ 🎉 New personal best!                      │
├─────────────────────────────────────────────┤
│                                             │
│   [ Retake Quiz ]    [ Review Answers ]     │
│                                             │
└─────────────────────────────────────────────┘
```

**Score Circle:** Large circular progress indicator using the existing `ProgressRing` component pattern:
- Size: `w-32 h-32` (128px)
- Stroke: `stroke-brand` for the filled arc, `stroke-muted` for the track
- Center text: Score percentage in `text-4xl font-display font-bold text-foreground`
- Animation: `500ms ease-out` stroke fill animation on mount

**Pass/Fail Indicator:**
- Passed: `text-success font-medium` with `CheckCircle` icon
- Not passed: `text-muted-foreground font-medium` with neutral icon (no red X, no "Failed" label)

**Encouraging Messages (QFR23):**

| Score Range | Message |
|------------|---------|
| >= 90% | "Excellent work! You've mastered this material." |
| 70-89% | "Great job! You're on the right track." |
| 50-69% | "Good effort! Review the growth areas below." |
| < 50% | "Keep practicing! Focus on the topics below." |

All messages are encouraging and forward-looking. No negative or guilt-inducing language.

**Improvement Tracking (QFR32):**
- Shown only when multiple attempts exist
- Positive improvement: `text-success font-semibold` with "+" prefix
- No improvement or regression: `text-muted-foreground` with neutral phrasing ("Keep practicing to beat your best!")
- New personal best: Highlighted with `text-success font-semibold`

**Action Buttons:**
- **Retake Quiz**: `variant="default" bg-brand rounded-xl h-11 px-6` -- starts fresh attempt immediately
- **Review Answers**: `variant="outline" rounded-xl h-11 px-6` -- enters read-only review mode
- **View Attempt History**: `variant="link" text-brand text-sm` -- expands collapsible attempt table

### Performance Insights (QFR20-QFR22)

**Component:** `PerformanceInsights.tsx`

Displayed below the score summary, grouping performance by topic:

**Strengths Section:**
- Heading: `text-lg font-semibold text-success` -- "Your Strengths"
- Topics with >= 70% score listed with `CheckCircle` icon
- Sorted highest to lowest

**Growth Opportunities Section:**
- Heading: `text-lg font-semibold text-warning` -- "Growth Opportunities"
- Topics with < 70% score listed with specific question references
- Actionable: "Review questions 3, 7, 11 on Functions"
- Sorted lowest to highest (most improvement needed first)

### Quiz Review Mode

**Route:** `/courses/:courseId/lessons/:lessonId/quiz/review/:attemptId`

Read-only navigation through all questions showing user answers alongside correct answers:

- Questions display in the same layout as during the quiz
- User's answer highlighted in `bg-brand-soft border-brand`
- Correct answer highlighted in `bg-success-soft border-success` (if user was incorrect)
- Explanation shown below each question in `bg-surface-sunken rounded-lg p-4`
- Navigation grid uses `text-success` checkmark for correct, `text-warning` dot for incorrect
- "Back to Results" button at the end

### Attempt History Table

**Component:** `AttemptHistory.tsx`

Collapsible table showing all past attempts for a quiz:

- **Container**: shadcn/ui `Collapsible` component
- **Trigger**: "View Attempt History (5 attempts)" link
- **Table Columns**: Attempt #, Date, Score %, Time, Status, Review action
- **Current Attempt Row**: `bg-brand-soft` highlight
- **Status Badges**:
  - Passed: `bg-success-soft text-success rounded-full px-2 py-0.5 text-xs`
  - Not Passed: `bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs`

---

## Timer System

### Countdown Timer Display (QFR24)

**Component:** `QuizTimer.tsx` + `useQuizTimer.ts` hook

**Hook Implementation:** Uses `Date.now()` accuracy pattern to prevent JavaScript `setInterval` drift. Handles Page Visibility API for background tab throttling -- recalculates remaining time on tab focus.

**Timer Display:**
- Position: Right side of quiz header, inline with progress indicator
- Format: `MM:SS` in `font-mono text-lg font-semibold`
- Default color: `text-foreground`

**Timer Color States:**

| Threshold | Color | Token |
|-----------|-------|-------|
| > 25% remaining | Default | `text-foreground` |
| 10-25% remaining | Warning | `text-warning` |
| < 10% remaining | Urgent | `text-destructive` |

**Time Expiration:** Auto-submits quiz with current answers. Displays toast: "Time's up! Your quiz has been submitted." via Sonner toast library.

### Timer Warnings (QFR27-QFR28)

Non-blocking toast notifications at configurable thresholds:

| Threshold | Toast Style | Duration | ARIA Level |
|-----------|------------|----------|------------|
| 75% elapsed (25% remaining) | `toast.info` | 3 seconds | `aria-live="polite"` |
| 90% elapsed (10% remaining) | `toast.warning` | 5 seconds | `aria-live="assertive"` |
| 1 minute remaining | Persistent banner | Until expiry | `aria-live="assertive"` |

Warnings do not disrupt quiz-taking flow. Toasts appear in the corner and auto-dismiss. Screen reader announcements use appropriate politeness levels to avoid interrupting question reading.

### Timer Accommodations (QFR26)

**Component:** `TimerAccommodationsModal.tsx`

Accessible from the quiz start screen via "Accessibility Accommodations" link. Uses shadcn/ui Dialog:

**Options (RadioGroup):**
- Standard time (default)
- 150% extended time -- "(22 minutes 30 seconds for a 15-minute quiz)"
- 200% extended time -- "(30 minutes for a 15-minute quiz)"
- Untimed -- no timer displayed, no time pressure

**Timer Header Annotation:** When accommodations are active, the timer displays "(Extended Time)" suffix in `text-sm text-muted-foreground`.

**Preference Persistence:** Accommodation preference saved to localStorage via settings store. Persists across quiz retakes and sessions.

**Untimed Mode (QFR29):** When selected, the timer component is not rendered. Time-to-completion is still tracked for analytics but not displayed to the learner.

---

## Quiz Analytics

### Overview Metrics

Quiz analytics appear in the Reports section, following the existing `StatsCard` pattern for consistency:

**Completion Rate (QFR35):**
- `StatsCard` with circular progress: `(completed / started) * 100`
- Raw count below: "12 of 15 started quizzes completed"
- Uses `Progress` component from shadcn/ui

**Average Retake Frequency (QFR36):**
- `StatsCard` showing "2.5 attempts per quiz"
- Interpretation text: "You retake quizzes 2-3 times on average for mastery"

**Average Time per Quiz (QFR37):**
- `StatsCard` showing formatted duration: "8m 32s"
- Comparison to previous average if available

### Improvement Trajectory Chart (QFR33)

**Component:** `ImprovementChart.tsx`

Line chart showing score vs attempt number for a specific quiz. Built with Recharts (already in the project for `ProgressChart`):

- **X-axis**: Attempt number (1, 2, 3, ...)
- **Y-axis**: Score percentage (0-100%)
- **Line**: `stroke: var(--brand)` with dot markers at each data point
- **Passing Score Line**: Horizontal dashed line at passing threshold, `stroke: var(--success)` with `stroke-dasharray`
- **Tooltip**: Shows attempt date, score, and time spent on hover
- **Container**: `bg-card rounded-[24px] p-6` card with heading "Score Trajectory"

**Responsive:** Chart fills container width. Height: `h-64` desktop, `h-48` mobile.

### Learning Trajectory Patterns (QFR38)

Analytics service identifies trajectory patterns from score history:

| Pattern | Description | Visual Indicator |
|---------|------------|-----------------|
| Exponential | Rapid early improvement, plateau | Curve icon + "Quick learner" |
| Linear | Steady, consistent improvement | Arrow icon + "Steady progress" |
| Logarithmic | Slow start, accelerating improvement | Growth icon + "Building momentum" |
| Plateau | Scores leveled off | Horizontal icon + "Consider reviewing material" |

Pattern displayed as a badge below the trajectory chart with brief description.

### Item Difficulty (QFR39)

**P-values** calculated per question: proportion of correct responses across all attempts.

**Display:** Horizontal bar chart or simple table in quiz analytics:
- Easy (P > 0.7): `bg-success-soft` bar, `text-success` label
- Medium (0.3 <= P <= 0.7): `bg-brand-soft` bar, `text-brand` label
- Hard (P < 0.3): `bg-[color:var(--momentum-hot-bg)]` bar, `text-warning` label

### Discrimination Indices (QFR40)

Point-biserial correlation per question, measuring how well each question differentiates between high and low performers. Displayed alongside P-values in the item analysis table. Values near 0 indicate questions that don't distinguish knowledge levels; values above 0.3 indicate good discrimination.

### Normalized Gain (QFR34)

Hake's formula: `(final_score - initial_score) / (100 - initial_score)`

**Display:** Below score improvement in results, with interpretation:
- < 30%: "Low gain" -- `text-muted-foreground`
- 30-70%: "Good learning progress" -- `text-brand`
- > 70%: "Excellent learning efficiency" -- `text-success`

---

## Accessibility

### Keyboard Navigation (QFR41)

All quiz functionality is accessible via keyboard without mouse:

| Key | Action | Context |
|-----|--------|---------|
| `Tab` | Move focus to next interactive element | All contexts |
| `Shift+Tab` | Move focus to previous interactive element | All contexts |
| `Space` | Select/deselect checkbox, activate button | Checkboxes, buttons |
| `Enter` | Activate button, submit form | Buttons, inputs |
| `Arrow Up/Down` | Navigate radio options within group | RadioGroup (MC, T/F) |
| `Arrow Left/Right` | Navigate question grid | Question navigation |
| `Escape` | Close dialog/modal | Accommodation modal, confirm dialogs |

**Focus Order:** Header (timer, progress) -> Question text -> Answer options -> Mark for Review -> Feedback (if shown) -> Navigation buttons -> Question grid.

**Focus Management:**
- After starting quiz: Focus moves to first question's `<legend>` element
- After navigating to next question: Focus moves to new question's `<legend>`
- After submitting quiz: Focus moves to score display (`aria-live` region)
- After opening results: Focus moves to `<h1>` heading

### Screen Reader Support (QFR42, QFR46)

**ARIA Live Regions:**
- Timer updates: `aria-live="off"` (too frequent for announcements; announced at warning thresholds only)
- Timer warnings: `aria-live="polite"` for 75% threshold, `aria-live="assertive"` for 10% and 1-minute
- Score display on results: `aria-live="polite"` -- announces score on page load
- Feedback after answer: `aria-live="polite"` -- announces correct/incorrect status and explanation

**Semantic Structure (QFR45):**
- Questions wrapped in `<fieldset>` with question text in `<legend>`
- Radio groups use `role="radiogroup"` (provided by Radix UI)
- Checkbox groups use standard `<input type="checkbox">` semantics
- Navigation uses `<nav aria-label="Quiz navigation">`
- Results use `<main>` with `<section>` elements for each content block
- Heading hierarchy: `<h1>` Quiz title, `<h2>` Section headings, `<h3>` Subsections

**Announcements:**
- Question navigation: "Question 3 of 12" announced on navigation
- Answer selection: "Option B selected" announced on selection
- Review mark: "Marked for review" / "Unmarked" announced on toggle
- Quiz submission: "Quiz submitted. Score: 85 percent. Passed." announced via live region

### Focus Indicators (QFR44)

All interactive elements use the global focus style from `theme.css`:

```css
*:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
  border-radius: 4px;
}
```

This provides a `4.5:1` contrast ratio focus indicator on all backgrounds used in the quiz interface.

**Custom Focus for Answer Options:** Answer option labels receive a compound focus indicator: `outline-2 outline-brand outline-offset-2` ring plus `bg-accent` background shift for maximum visibility.

### Contrast Ratios (QFR48)

All quiz UI elements meet or exceed WCAG 2.1 AA requirements:

| Element | Foreground | Background | Ratio | Level |
|---------|-----------|------------|-------|-------|
| Question text | `foreground` | `card` (#FFF) | 15.8:1 | AAA |
| Muted metadata | `muted-foreground` (#5b6a7d) | `card` (#FFF) | 5.2:1 | AA |
| Timer (default) | `foreground` | `card` (#FFF) | 15.8:1 | AAA |
| Timer (warning) | `warning` (#d97706) | `card` (#FFF) | 4.6:1 | AA |
| Timer (urgent) | `destructive` (#d4183d) | `card` (#FFF) | 5.8:1 | AA |
| Correct feedback | `success` (#16a34a) | `success-soft` | 4.7:1 | AA |
| Brand on soft | `brand` (#2563eb) | `brand-soft` (#eff6ff) | 4.5:1 | AA |

### Timer Accommodations (QFR26, QFR43)

See Timer System section above. Key accessibility considerations:

- Accommodations modal is keyboard navigable with focus trap
- Radio options have descriptive labels including calculated times
- Preference persists so learners don't reconfigure every attempt
- Untimed mode completely removes timer pressure
- Explanation text uses supportive, non-clinical language

### Motion Sensitivity

All quiz animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .quiz-feedback, .score-circle, .progress-fill {
    animation: none;
    transition: none;
  }
}
```

Affected animations:
- Score circle fill animation (500ms) -> instant display
- Feedback card slide-in (200ms) -> instant display
- Progress bar updates (300ms) -> instant update
- Timer color transitions (150ms) -> instant change

---

## Responsive Design

### Desktop (>= 1024px)

The primary quiz-taking viewport. Quiz content centered in the main content area with comfortable margins:

- **Quiz Container**: `max-w-3xl mx-auto px-8` -- centered with generous horizontal padding
- **Question + Options**: Full-width within container
- **Navigation Grid**: Horizontal row, all question numbers visible without scrolling (up to ~20 questions)
- **Timer**: Right-aligned in header, always visible
- **Results**: Score circle centered, insights in 2-column grid below
- **Attempt History Table**: Full table with all columns visible
- **Sidebar**: Persistent (existing layout), does not interfere with quiz focus

### Tablet (640px - 1023px)

Optimized for touch with maintained information density:

- **Quiz Container**: `max-w-2xl mx-auto px-6`
- **Answer Options**: Full-width stacked (same as mobile), `min-h-[48px]` touch targets
- **Navigation Grid**: Horizontally scrollable with `overflow-x-auto`, partial visibility with scroll indicators
- **Timer**: Right-aligned in header, slightly smaller (`text-base`)
- **Results**: Score circle centered, insights stack to single column
- **Attempt History Table**: Horizontal scroll for table, or collapse to card-based layout
- **Sidebar**: Collapsible Sheet, auto-closes on quiz start to maximize quiz space

**Tablet Sidebar Note:** Following the existing pattern, seed `localStorage.setItem('eduvi-sidebar-v1', 'false')` in E2E tests to prevent the sidebar Sheet from overlaying quiz content at tablet viewports.

### Mobile (< 640px)

Touch-first single-column layout:

- **Quiz Container**: `px-4` -- minimal horizontal padding to maximize content width
- **Question Text**: `text-base` (reduced from `text-lg` on desktop) for better fit
- **Answer Options**: Full-width, `min-h-[52px]` for comfortable thumb targets
- **Navigation Grid**: Horizontally scrollable strip, `gap-1.5` for compact fit
- **Navigation Buttons**: Full-width stacked: Previous above Next/Submit
- **Timer**: Centered below progress bar (moved from header right to avoid crowding)
- **Mark for Review**: Full-width toggle below answer options
- **Results**:
  - Score circle: `w-24 h-24` (reduced from `w-32 h-32`)
  - Action buttons: Full-width stacked
  - Insights: Single column
- **Attempt History**: Card-based layout instead of table (one card per attempt)
- **Bottom Navigation**: Visible (existing BottomNav), does not overlap quiz actions

**Mobile-Specific Optimizations:**
- Full-screen quiz mode (no distracting sidebar elements)
- Swipe gestures for question navigation (optional future enhancement)
- Input fields use `inputmode` attributes for appropriate keyboard types
- Code blocks in questions scroll independently with `-webkit-overflow-scrolling: touch`

### Breakpoint-Specific Patterns

```
/* Mobile-first Tailwind utilities */
.quiz-container {
  @apply px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto;
}

.answer-option {
  @apply min-h-[52px] sm:min-h-[48px] p-4 rounded-xl;
}

.nav-buttons {
  @apply flex flex-col sm:flex-row gap-3;
}

.score-circle {
  @apply w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32;
}

.insights-grid {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-6;
}
```

---

## Integration Points

### Lesson Integration (QFR1, QFR61)

Quizzes are associated with specific course lessons. The connection surfaces in several places:

**Lesson Page:**
- "Take Quiz" button appears at the bottom of lesson content when a quiz is associated
- Button variant: `bg-brand text-brand-foreground rounded-xl h-11 px-6`
- If quiz has been completed: Button reads "Retake Quiz" with best score badge (`text-sm text-success`)
- Quiz availability badge on lesson list items: small `bg-brand-soft text-brand rounded-full px-2 py-0.5 text-xs` badge with quiz icon

**Course Page (QFR58):**
- Lessons with quizzes show a small quiz icon (`ClipboardCheck` from lucide-react) next to the lesson title
- Completed quizzes show `text-success` icon, available quizzes show `text-muted-foreground` icon

**Routing:**
```
/courses/:courseId/lessons/:lessonId/quiz          -> Quiz.tsx (take quiz)
/courses/:courseId/lessons/:lessonId/quiz/results  -> QuizResults.tsx (results)
/courses/:courseId/lessons/:lessonId/quiz/review/:attemptId -> QuizReview.tsx (review)
```

### Dashboard Integration (QFR56)

Quiz performance data surfaces in the Overview dashboard:

- **StatsCard**: "Quizzes Completed" metric with sparkline trend
- **RecentActivity**: Quiz completions appear in the activity timeline with score: "Completed React Hooks Quiz - 85%"
- **QuickActions**: "Continue Quiz" action appears if an in-progress quiz exists in localStorage

### Reports Integration (QFR57)

The Reports page gains a "Quiz Performance" section:

- Quiz completion rate (circular progress)
- Average retake frequency
- Average score across all quizzes
- Score improvement trajectory chart (for selected quiz)
- Item difficulty analysis table

These follow the existing Reports page card-based layout with `bg-card rounded-[24px] p-6` containers.

### Settings Integration (QFR59)

Quiz preferences added to the Settings page:

| Setting | Control | Default |
|---------|---------|---------|
| Timer accommodations | RadioGroup (Standard, 150%, 200%, Untimed) | Standard |
| Show immediate feedback | Switch | On |
| Shuffle questions by default | Switch | On |
| Shuffle answer options | Switch | Off |

Settings persist to localStorage via the settings store. Quiz-specific settings grouped under a "Quiz Preferences" heading.

### Progress Tracking Integration (QFR55, QFR60)

Quiz completion events trigger cross-store updates:

1. **Study Streak**: `useProgressStore.getState().recordStudyActivity()` -- quiz completion counts toward daily streak
2. **Lesson Progress**: `useProgressStore.getState().markLessonComplete()` -- quiz completion marks the associated lesson as complete (if passing score met)
3. **Study Session**: `useSessionStore.getState().recordStudyActivity('quiz', timeSpent)` -- quiz time counts toward study session metrics

### Data Persistence

| Data | Storage | Purpose |
|------|---------|---------|
| Current quiz progress | localStorage (Zustand persist) | Crash recovery, pause/resume |
| Quiz attempts (history) | IndexedDB (Dexie `quizAttempts` table) | Analytics, review, improvement tracking |
| Quiz definitions | IndexedDB (Dexie `quizzes` table) | Question data, metadata |
| Quiz preferences | localStorage (settings store) | Timer accommodations, display preferences |

**Quota Exceeded Handling (QFR53):** If localStorage hits quota limits, the system falls back to sessionStorage with a non-blocking toast warning. Submitted attempts still persist to IndexedDB (unaffected by localStorage limits). See `QuotaExceededError` handling in `useQuizStore.ts`.

---

## Animation & Transitions

### Quiz-Specific Animation Philosophy

Quiz animations are more restrained than dashboard celebrations. The goal is to provide clear state feedback without disrupting focus or test-taking flow.

**Timing Guidelines:**
- Micro-interactions (hover, focus): `150ms ease-out`
- State transitions (question navigation, feedback appear): `200ms ease-in-out`
- Score reveal (results page): `500ms ease-out`
- No celebration animations during quiz (maintain focus)
- No confetti or elaborate effects (this is an assessment, not a game)

**Specific Animations:**

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Question transition | Fade + slide from right | 200ms | ease-in-out |
| Feedback card appear | Slide up from bottom | 200ms | ease-out |
| Score circle fill | Stroke-dashoffset animation | 500ms | ease-out |
| Progress bar update | Width transition | 300ms | ease-out |
| Timer color change | Color transition | 150ms | linear |
| Toast notification | Slide in from corner | 200ms | ease-out |

All animations disabled when `prefers-reduced-motion: reduce` is set.

---

## Component File Organization

```
src/app/components/quiz/
├── QuizHeader.tsx              # Title, timer, progress bar
├── QuizStartScreen.tsx         # Pre-quiz metadata and start/resume
├── QuestionDisplay.tsx         # Polymorphic renderer (switches on type)
├── QuizNavigation.tsx          # Question grid (number buttons)
├── QuizActions.tsx             # Previous / Next / Submit buttons
├── QuizTimer.tsx               # MM:SS countdown display
├── TimerWarnings.tsx           # Toast + ARIA warning logic
├── TimerAccommodationsModal.tsx # Accommodation selection dialog
├── AnswerFeedback.tsx          # Immediate correct/incorrect feedback
├── MarkForReview.tsx           # Review toggle checkbox
├── ReviewSummary.tsx           # Pre-submit review list
├── ScoreSummary.tsx            # Score circle + pass/fail + time
├── PerformanceInsights.tsx     # Strengths / growth opportunities
├── ImprovementChart.tsx        # Score trajectory (Recharts)
├── AttemptHistory.tsx          # Collapsible attempt table
├── QuizReview.tsx              # Read-only Q&A review
└── questions/
    ├── MultipleChoiceQuestion.tsx
    ├── TrueFalseQuestion.tsx
    ├── MultipleSelectQuestion.tsx
    └── FillInBlankQuestion.tsx
```

**Route-Level Pages:**
```
src/app/pages/
├── Quiz.tsx                    # Main quiz container (start/active/submit)
├── QuizResults.tsx             # Results + insights + actions
└── QuizReview.tsx              # Read-only answer review
```

**Supporting Files:**
```
src/hooks/useQuizTimer.ts       # Date.now() accuracy timer hook
src/stores/useQuizStore.ts      # Zustand quiz state management
src/types/quiz.ts               # TypeScript interfaces + Zod schemas
src/lib/shuffle.ts              # Fisher-Yates shuffle (O(n), immutable)
src/lib/scoring.ts              # Partial credit + PCM calculation
src/lib/analytics.ts            # P-values, discrimination, normalized gain
```

---

## Design Token Reference

All quiz components use tokens from `src/styles/theme.css`. Never use hardcoded Tailwind colors.

| Use Case | Token | Light Value |
|----------|-------|-------------|
| Quiz card background | `bg-card` | `#ffffff` |
| Page background | `bg-background` | `#faf5ee` |
| Primary CTA / selected state | `bg-brand` | `#2563eb` |
| CTA hover | `bg-brand-hover` | `#1d4ed8` |
| Selected option background | `bg-brand-soft` | `#eff6ff` |
| Correct feedback | `bg-success-soft` / `text-success` | `#f0fdf4` / `#16a34a` |
| Incorrect feedback | `text-warning` | `#d97706` |
| Timer urgent | `text-destructive` | `#d4183d` |
| Muted text (metadata) | `text-muted-foreground` | `#5b6a7d` |
| Input background | `bg-input-background` | `#f3f3f5` |
| Code block background | `bg-surface-sunken` | `oklch(0.97 0.005 80)` |
| Card border | `border-border` | `rgba(0, 0, 0, 0.1)` |
| Review mark indicator | `text-warning` / `border-warning` | `#d97706` |
| Elevated surface | `bg-surface-elevated` | `#ffffff` |

**Card Styling:** `rounded-[24px]` for major containers, `rounded-xl` for buttons and inputs, `rounded-full` for badges and pills.

**Spacing:** 8px base grid. Question content uses `space-y-6` between sections. Answer options use `space-y-3`. Action buttons use `gap-3`.

---

## Requirements Traceability

| Section | QFRs Covered |
|---------|-------------|
| Quiz Entry Point | QFR1, QFR4, QFR8, QFR49, QFR50, QFR52 |
| Question Display | QFR2, QFR3, QFR14 |
| Multiple Choice | QFR9 |
| True/False | QFR10 |
| Multiple Select | QFR11, QFR16 |
| Fill-in-Blank | QFR12 |
| Rich Text | QFR15 |
| Navigation | QFR2, QFR3, QFR7, QFR8, QFR13 |
| Immediate Feedback | QFR18, QFR19, QFR23 |
| Results Screen | QFR5, QFR17, QFR20, QFR21, QFR22, QFR23 |
| Timer System | QFR24, QFR25, QFR26, QFR27, QFR28, QFR29, QFR30 |
| Analytics | QFR31, QFR32, QFR33, QFR34, QFR35, QFR36, QFR37, QFR38, QFR39, QFR40 |
| Accessibility | QFR41, QFR42, QFR43, QFR44, QFR45, QFR46, QFR47, QFR48 |
| Data Persistence | QFR49, QFR50, QFR51, QFR52, QFR53, QFR54 |
| Integration | QFR55, QFR56, QFR57, QFR58, QFR59, QFR60, QFR61 |
| Retakes | QFR6 |
| Export | QFR47 |
