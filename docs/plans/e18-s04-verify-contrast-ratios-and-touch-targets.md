# E18-S04: Verify Contrast Ratios and Touch Targets — Implementation Plan

**Story:** As a learner with visual impairments or using a mobile device, I want sufficient color contrast and large touch targets, so that I can see and interact with quiz elements easily.

**FRs:** QFR44 (Focus Indicators), QFR48 (Contrast Ratios)

**Created:** 2026-03-23

---

## Current State Analysis

### What Already Works

The codebase has strong accessibility foundations. Most quiz components already meet WCAG 2.1 AA requirements:

**Touch targets (>=44px):** Nearly all quiz interactive elements already have `min-h-[44px]` or `min-h-12` (48px):
- Option labels (MC/TF/MS): `min-h-12` (48px)
- QuizActions buttons: `min-h-[44px]`
- QuestionGrid buttons: `size-11` (44px)
- ReviewSummary jump buttons: `min-h-[44px] min-w-[44px]`
- MarkForReview container: `min-h-[44px]`
- FillInBlank input: `min-h-[44px]`
- QuestionBreakdown trigger + items: `min-h-[44px]`
- QuizStartScreen CTAs: `h-12` (48px)
- QuizReviewContent nav buttons: `min-h-[44px]`

**Text contrast:** Design token system ensures most text combinations pass:
- `text-foreground` (#1c1d2b) on `bg-card` (#ffffff): ~15.8:1 (AAA)
- `text-muted-foreground` (#656870) on `bg-card`: ~4.8:1 (AA)
- `text-warning` (#866224) on `bg-card`: ~5.2:1 (AA)
- `text-destructive` (#c44850) on `bg-card`: ~4.6:1 (AA)

**Global focus indicator:** `theme.css` defines `*:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px }` — brand (#5e6ad2) on white: ~4.5:1 (AA)

### Issues to Investigate and Fix

#### Issue 1: Focus Ring Token Contrast (AC4)

**Components affected:** All buttons (via button.tsx), question option labels, QuestionBreakdown trigger, QuizReviewContent link

**Problem:** `button.tsx` applies `outline-none` which suppresses the high-contrast global focus outline, replacing it with `focus-visible:ring-ring/50 focus-visible:ring-[3px]`. The `--ring` token is:
- Light mode: `oklch(0.708 0 0)` ≈ #b3b3b3 — against white (#ffffff): ~1.7:1 ratio (FAILS 3:1)
- Dark mode: `oklch(0.45 0.05 270)` — against dark card (#242536): potentially low contrast

Similarly, question option labels use `focus-within:ring-ring` (without /50), and QuestionBreakdown/QuizReviewContent link use `focus-visible:ring-ring`.

**Why this may still pass:** button.tsx also has `focus-visible:border-ring` which changes the border color too, providing a compound indicator. The ring + border together may provide enough visual change. But the ring alone at 50% opacity on white likely fails 3:1.

**Approach:**
- Measure actual rendered contrast of the ring indicator in both modes
- If failing, update `--ring` to use `--brand` (or a new `--focus-ring` token) in the quiz-specific components, OR update ring classes to use `ring-brand` / `ring-brand/50` which has better contrast
- Must not break non-quiz components — prefer scoped changes on quiz components over global `--ring` changes

#### Issue 2: text-brand on bg-brand-soft (AC1)

**Components affected:** QuestionGrid answered-but-not-current state

**Problem:** QuestionGrid line 43: `bg-brand-soft text-brand border border-brand`. The `text-brand` (#5e6ad2) on `bg-brand-soft` (#d0d2ee) has approximately 2.8:1 contrast in light mode — fails 4.5:1 for normal text.

**Fix:** Replace `text-brand` with `text-brand-soft-foreground` (#3d46b8) on `bg-brand-soft`. This is the exact pattern the styling rules mandate. The QuizStartScreen badges already use this correctly.

**Dark mode check:** `text-brand-soft-foreground` (#8b92da) on `bg-brand-soft` (#2a2c48) needs verification.

#### Issue 3: Dark Mode Specific Contrast (AC5)

**Components to audit in dark mode:**
- Timer warning/urgent text on dark card
- Answer feedback states (success-soft, warning/10 backgrounds with text)
- FillInBlank review feedback block (inline string template for colors)
- QuestionGrid states in dark mode
- Metadata badges in QuizStartScreen

#### Issue 4: QuizTimer Focus/Contrast (AC1, AC2)

**Component:** QuizTimer.tsx line 56 — `text-muted-foreground` for default state is fine, but need to verify:
- Warning state: `text-warning` on card in dark mode
- Urgent state: `text-destructive` on card in dark mode

#### Issue 5: Missing Quiz-Page Axe-Core E2E Tests

**Current state:** Accessibility E2E tests exist for Overview, Courses, Course Detail, Lesson Player, My Courses, Reports — but NOT for quiz pages (Quiz, QuizResults, QuizReview).

---

## Implementation Steps

### Step 1: Contrast Audit Script (Research)

**Goal:** Systematically verify all color token combinations used in quiz components.

**Actions:**
1. Create a manual audit table mapping each quiz component to its color token combinations
2. Calculate contrast ratios for each combination in both light and dark mode using the hex/OKLCH values from theme.css
3. Flag any combination below WCAG AA thresholds (4.5:1 for normal text, 3:1 for large text/UI components)

**Output:** A contrast audit section in the story file documenting all findings.

**Files to read:** `src/styles/theme.css` (already read), all quiz components (already read)

### Step 2: Fix Focus Ring Contrast (AC4)

**Goal:** Ensure all quiz interactive elements have focus indicators with >=3:1 contrast and >=2px thickness.

**Actions:**
1. In quiz question option labels (MultipleChoiceQuestion, TrueFalseQuestion, MultipleSelectQuestion), replace `focus-within:ring-ring` with `focus-within:ring-brand` to use the higher-contrast brand color
2. In QuestionBreakdown CollapsibleTrigger, replace `focus-visible:ring-ring` with `focus-visible:ring-brand`
3. In QuizReviewContent back link, replace `focus-visible:ring-ring` with `focus-visible:ring-brand`
4. For button.tsx — this is a shared component. Two approaches:
   - **Option A (scoped):** Override focus ring classes on quiz-specific button usages via className
   - **Option B (global):** Update `--ring` token value to something with better contrast
   - **Recommended: Option A** — add `focus-visible:ring-brand/50` override on quiz buttons only, avoiding global changes. Actually, the button already has `focus-visible:border-ring` creating a border change too — the compound indicator (border + ring) may suffice. Verify via axe-core first before changing.

**Files to modify:**
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx` (line 89)
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx` (line 84)
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx` (similar pattern)
- `src/app/components/quiz/QuestionBreakdown.tsx` (line 60)
- `src/app/components/quiz/QuizReviewContent.tsx` (line 109)

**Estimated changes:** ~5 files, 1 line each (token swap)

### Step 3: Fix text-brand on bg-brand-soft (AC1)

**Goal:** Ensure answered-question indicators in QuestionGrid use proper contrast tokens.

**Actions:**
1. In QuestionGrid, change `text-brand` to `text-brand-soft-foreground` for the answered-but-not-current state (line 43)
2. Verify the same pattern in ReviewQuestionGrid if it uses similar styling

**Files to modify:**
- `src/app/components/quiz/QuestionGrid.tsx` (line 43)
- `src/app/components/quiz/ReviewQuestionGrid.tsx` (check for same pattern)

**Estimated changes:** 1-2 files, 1 line each

### Step 4: Dark Mode Contrast Fixes (AC5)

**Goal:** Verify and fix all quiz color combinations in dark mode.

**Actions:**
1. Audit each flagged combination from Step 1 in dark mode
2. Fix any violations — likely by using dark-mode-aware token pairs that are already defined
3. Key areas to verify:
   - FillInBlank review feedback: inline `bg-success-soft text-foreground` / `bg-warning/10 text-foreground` — should be fine since `text-foreground` adapts
   - AnswerFeedback states: same pattern, should adapt
   - QuizStartScreen badges: `text-brand-soft-foreground` on `bg-brand-soft` and `text-muted-foreground` on `bg-muted`
   - QuestionGrid states: after Step 3 fix, verify dark mode

**Files to modify:** Only if violations found in audit.

### Step 5: Touch Target Audit (AC3)

**Goal:** Confirm all interactive elements meet >=44px in both dimensions on mobile.

**Actions:**
1. Systematic review of all quiz components for min-h/min-w on interactive elements
2. Known items already meeting 44px: documented in "What Already Works" above
3. Check these potentially undersized elements:
   - `RadioGroupItem` / `Checkbox` internal elements (Radix primitives — may render smaller circles but are within larger label click targets)
   - ReviewQuestionGrid buttons (check if they mirror QuestionGrid's `size-11`)
   - TimerAccommodationsModal radio options
   - AlertDialog buttons in QuizStartScreen (Keep progress / Start over)
4. Fix any undersized elements by adding `min-h-[44px]` / `min-w-[44px]`

**Files to modify:** Only if violations found. Expected: 0-2 files.

### Step 6: Write E2E Accessibility Tests (AC1-5)

**Goal:** axe-core WCAG 2.1 AA audit for quiz pages with zero violations.

**Actions:**
1. Create `tests/e2e/accessibility-quiz.spec.ts` following the pattern from `accessibility-courses.spec.ts`
2. Tests to include:
   - **Quiz Start Screen** — axe-core scan (light mode)
   - **Quiz Taking (active question)** — axe-core scan with quiz data seeded
   - **Quiz Taking (with answer feedback)** — scan after answering a question
   - **Quiz Results page** — axe-core scan
   - **Quiz Review page** — axe-core scan
   - **Dark mode** — repeat key scans with `.dark` class applied
   - **Mobile touch targets** — measure interactive element bounding boxes at 375px viewport
   - **Focus indicator visibility** — tab through quiz elements, verify focus styling applied

3. Test data seeding: use quiz-factory.ts to create test quiz data, seed via IndexedDB helpers

**Files to create:**
- `tests/e2e/accessibility-quiz.spec.ts`

**Dependencies:** `@axe-core/playwright` (already installed)

### Step 7: Write Unit Tests (AC3, AC4)

**Goal:** Unit tests verifying touch target classes and focus indicator classes are present.

**Actions:**
1. Add test cases to existing quiz component test files (not new files):
   - Verify `min-h-12` or `min-h-[44px]` class on interactive elements
   - Verify `focus-within:ring-brand` (after fix) on option labels
   - Verify `focus-visible:ring-brand` on collapsible triggers and links

2. These tests already partially exist:
   - `MultipleChoiceQuestion.test.tsx` has touch target and focus indicator checks (~lines 279, 295)
   - Similar tests in TrueFalseQuestion.test.tsx, MultipleSelectQuestion.test.tsx
   - Update these tests if class names change in Step 2

**Files to modify:**
- `src/app/components/quiz/__tests__/MultipleChoiceQuestion.test.tsx` (update ring class assertion)
- `src/app/components/quiz/__tests__/TrueFalseQuestion.test.tsx` (same)
- `src/app/components/quiz/__tests__/MultipleSelectQuestion.test.tsx` (same)
- `src/app/components/quiz/__tests__/QuestionGrid.test.tsx` (verify text token assertion)

---

## Implementation Order

```
Step 1: Contrast Audit (research, no code)          ~30 min
Step 2: Fix focus ring contrast                      ~15 min
Step 3: Fix text-brand on bg-brand-soft              ~10 min
Step 4: Dark mode contrast fixes                     ~20 min
Step 5: Touch target audit (may yield no changes)    ~15 min
Step 6: E2E accessibility tests                      ~45 min
Step 7: Unit test updates                            ~20 min
```

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Changing `ring-ring` to `ring-brand` looks different | Low | Brand color is the same used for global focus — visual consistency |
| axe-core finds violations in non-quiz shared components | Medium | Exclude non-quiz regions with `.exclude()` selectors, file separate issues |
| Dark mode audit reveals many violations | Low | Design token system was built with dark mode in mind; most combinations should pass |
| Touch target changes break layout | Low | Only adding min-h/min-w, not changing max dimensions |

## Acceptance Criteria Mapping

| AC | Implementation Steps | Test Coverage |
|----|---------------------|---------------|
| AC1: Text contrast >=4.5:1 | Steps 1, 3, 4 | Step 6 (axe-core), Step 7 (unit) |
| AC2: Non-text contrast >=3:1 | Steps 1, 2, 4 | Step 6 (axe-core) |
| AC3: Touch targets >=44px | Step 5 | Step 6 (mobile viewport), Step 7 (class assertions) |
| AC4: Focus indicator >=3:1, >=2px | Step 2 | Step 6 (tab navigation), Step 7 (class assertions) |
| AC5: Dark mode compliance | Step 4 | Step 6 (dark mode scans) |

## Files Likely Modified

**Quiz Components (fixes):**
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx`
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`
- `src/app/components/quiz/QuestionGrid.tsx`
- `src/app/components/quiz/QuestionBreakdown.tsx`
- `src/app/components/quiz/QuizReviewContent.tsx`
- `src/app/components/quiz/ReviewQuestionGrid.tsx` (if same pattern)

**Tests (new/modified):**
- `tests/e2e/accessibility-quiz.spec.ts` (new)
- `src/app/components/quiz/__tests__/MultipleChoiceQuestion.test.tsx`
- `src/app/components/quiz/__tests__/TrueFalseQuestion.test.tsx`
- `src/app/components/quiz/__tests__/MultipleSelectQuestion.test.tsx`
- `src/app/components/quiz/__tests__/QuestionGrid.test.tsx`

**Not modified (confirmed working):**
- `src/styles/theme.css` — no token changes needed; fixes are at usage site
- `src/app/components/ui/button.tsx` — global component, avoid modifying
- `src/app/components/quiz/QuizActions.tsx` — touch targets already correct
- `src/app/components/quiz/MarkForReview.tsx` — already correct
- `src/app/components/quiz/AnswerFeedback.tsx` — uses design tokens correctly
