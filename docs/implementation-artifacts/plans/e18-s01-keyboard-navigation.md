# E18-S01: Implement Complete Keyboard Navigation — Implementation Plan

**Story:** As a learner using only a keyboard, I want to navigate and complete quizzes without using a mouse.
**Complexity:** Medium (4-5 hours)
**Branch:** `feature/e18-s01-implement-complete-keyboard-navigation`

---

## Current State Analysis

### What Already Works
1. **RadioGroup (Radix UI):** Arrow Up/Down navigation + Space to select already built into `RadioGroupPrimitive`. Used by `MultipleChoiceQuestion`, `TrueFalseQuestion`, and `TimerAccommodationsModal`.
2. **Checkbox (Radix UI):** Space to toggle already built into `Checkbox` primitive. Used by `MultipleSelectQuestion` and `MarkForReview`.
3. **AlertDialog (Radix UI):** Focus trap and Escape-to-close already built into `AlertDialogPrimitive`. Used for submit confirmation dialog in `Quiz.tsx`.
4. **Focus-visible indicators:** All quiz buttons use `focus-visible:ring-*` classes. Labels use `focus-within:ring-2 focus-within:ring-ring`.
5. **Number key shortcuts:** MC/TF questions support 1-9 number keys via document-level keydown listeners. MultipleSelect uses fieldset-scoped `onKeyDown`.
6. **Next/Submit auto-focus:** After answering single-answer questions, `nextBtnRef.current?.focus()` fires via rAF.
7. **44px touch targets:** All buttons and labels meet `min-h-[44px]` or `min-h-12`.

### What Needs to Be Built
1. **Programmatic focus on question change** (AC #2) — No `questionRef` exists; question text has no `tabIndex`.
2. **QuestionGrid roving tabindex** (AC #5) — Currently all grid buttons are in tab order (each has implicit `tabindex=0`). Need roving tabindex with Arrow Left/Right.
3. **Tab order verification/enforcement** (AC #1) — Need to audit and potentially reorder DOM elements to ensure logical sequence.
4. **Focus indicator contrast audit** — Verify `ring-ring/50` passes 4.5:1 against backgrounds.
5. **E2E keyboard tests** — No quiz-specific keyboard E2E tests exist.

---

## Implementation Steps

### Step 1: Programmatic Focus on Question Change (AC #2)

**File:** `src/app/pages/Quiz.tsx`

**Changes:**
- Add a `questionTextRef = useRef<HTMLDivElement>(null)` in the Quiz component
- Add `useEffect` keyed on `currentProgress.currentQuestionIndex` that calls `questionTextRef.current?.focus()`
- Pass `questionTextRef` down to the question display area

**File:** `src/app/components/quiz/QuestionDisplay.tsx` (or question text container)

**Changes:**
- The question text `<div>` inside each question type component (MC, TF, MS, FIB) currently uses `id={labelId}` and `data-testid="question-text"`. The best approach is to add the ref + `tabIndex={-1}` at the Quiz.tsx level, wrapping the `<QuestionDisplay>` with a focusable heading element.
- Add a `<h2>` or `<div>` wrapper with `ref={questionTextRef}` and `tabIndex={-1}` and `className="outline-none"` (suppress focus ring since it's programmatic, not user-initiated)

**Design decision:** Place the ref at the Quiz page level rather than inside each question type component. This avoids prop-drilling and keeps focus management centralized. The question text `<div>` already exists in each question component's `fieldset`, but we want to focus a single element that wraps the question number/text area.

**Pattern:**
```tsx
const questionTextRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  questionTextRef.current?.focus()
}, [currentProgress.currentQuestionIndex])

// In JSX:
<div ref={questionTextRef} tabIndex={-1} className="outline-none">
  <QuestionDisplay ... />
</div>
```

**Why `tabIndex={-1}`:** Makes the element programmatically focusable (via `.focus()`) but NOT reachable via Tab key, exactly matching the AC.

---

### Step 2: QuestionGrid Roving Tabindex (AC #5)

**File:** `src/app/components/quiz/QuestionGrid.tsx`

**Changes:**
- Convert from "all buttons tabbable" to roving tabindex pattern
- Only the currently focused grid button has `tabIndex={0}`; all others have `tabIndex={-1}`
- Track focused index in local state (initialize to `currentIndex`)
- Handle `onKeyDown`:
  - `ArrowRight`: Move focus to next button (wrap to first)
  - `ArrowLeft`: Move focus to previous button (wrap to last)
  - `Enter`: Call `onQuestionClick(focusedIndex)` to jump to that question
  - `Home`: Move focus to first button
  - `End`: Move focus to last button
- Use refs array to imperatively `.focus()` on arrow key presses
- Add `role="toolbar"` to the container and `aria-label="Question grid"` (WAI-ARIA toolbar pattern is appropriate here since items are navigated with arrows)

**Pattern:**
```tsx
const [focusedIndex, setFocusedIndex] = useState(currentIndex)
const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

// Sync focusedIndex when currentIndex changes (user navigated via other means)
useEffect(() => {
  setFocusedIndex(currentIndex)
}, [currentIndex])

function handleKeyDown(e: React.KeyboardEvent) {
  let nextIndex = focusedIndex
  switch (e.key) {
    case 'ArrowRight': nextIndex = (focusedIndex + 1) % total; break
    case 'ArrowLeft': nextIndex = (focusedIndex - 1 + total) % total; break
    case 'Home': nextIndex = 0; break
    case 'End': nextIndex = total - 1; break
    case 'Enter': onQuestionClick(focusedIndex); return
    default: return
  }
  e.preventDefault()
  setFocusedIndex(nextIndex)
  buttonRefs.current[nextIndex]?.focus()
}
```

**Why roving tabindex over `aria-activedescendant`:** Roving tabindex is simpler, more widely supported by screen readers, and matches the WAI-ARIA toolbar pattern. The grid has <20 items, so the ref array cost is negligible.

---

### Step 3: Verify RadioGroup Keyboard (AC #3) — Mostly Free

**Files:** `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`, `TrueFalseQuestion.tsx`

**Status:** Radix `RadioGroup` already provides:
- Tab to enter the group (focuses selected or first item)
- Arrow Up/Down to move between items
- Space to select

**Changes needed:** Minimal verification:
- Confirm the `disabled` prop doesn't break keyboard navigation when `isActive` is true
- No code changes expected — just E2E test verification

---

### Step 4: Verify Checkbox Keyboard (AC #4) — Mostly Free

**File:** `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`

**Status:** Radix `Checkbox` already provides Space to toggle. Each checkbox is independently tabbable (correct for checkbox group pattern per WAI-ARIA).

**Changes needed:** None expected — just E2E test verification.

---

### Step 5: Ensure Logical Tab Order (AC #1)

**File:** `src/app/pages/Quiz.tsx`

**Current DOM order analysis:**
1. `QuizHeader` — Progress bar, title (no interactive elements needing tab)
2. `TimerWarnings` — Display only
3. `QuestionDisplay` — Radio group / Checkboxes / Input (interactive)
4. `QuestionHint` — Collapsible, may have button
5. `AnswerFeedback` — Display only
6. `MarkForReview` — Checkbox (interactive)
7. `QuizNavigation` → `QuizActions` (Previous/Next/Submit buttons) + `QuestionGrid` (buttons)
8. `AlertDialog` — Portal-based, separate from main flow

**Desired tab order from AC:**
1. Answer options (radio/checkboxes)
2. "Mark for Review" toggle
3. Navigation buttons (Previous, Next, Submit)
4. Question grid

**Current order matches the AC!** The DOM order already follows this sequence:
- `QuestionDisplay` (answer options) comes before `MarkForReview`
- `MarkForReview` comes before `QuizNavigation`
- Within `QuizNavigation`, `QuizActions` (buttons) renders before `QuestionGrid`

**Changes needed:**
- Verify that `QuestionHint` (between answer options and MarkForReview) doesn't break the logical flow. If it has an interactive disclosure button, it should appear after answers but before MarkForReview — which is the current DOM position. This is acceptable.
- No DOM reordering needed.

---

### Step 6: Verify AlertDialog Focus Trap and Escape (AC #6)

**File:** `src/app/pages/Quiz.tsx` (AlertDialog for submit confirmation)

**Status:** Radix `AlertDialog` provides:
- Focus trap (Tab/Shift+Tab cycle within dialog)
- Escape to close
- Focus returns to trigger element on close

**Current implementation uses:** `AlertDialog` with `open={showSubmitDialog}` and `onOpenChange={setShowSubmitDialog}`. The trigger is the "Submit Quiz" button (`ref={nextBtnRef}`).

**Potential issue:** Focus restoration — when the dialog closes, Radix AlertDialog returns focus to the trigger by default. But the "Submit Quiz" button uses `ref={nextBtnRef}` which is on the Next/Submit button. Need to verify Radix handles this correctly since there's no explicit `AlertDialogTrigger` — the dialog is opened programmatically via `setShowSubmitDialog(true)`.

**Changes needed:**
- If focus doesn't return to the Submit button after dialog close, we may need to manually restore focus in the `onOpenChange` handler
- E2E test will verify this behavior

**Also check:** `TimerAccommodationsModal` uses `DialogContent` (Radix Dialog, not AlertDialog). Radix Dialog also provides focus trap + Escape. Should work out of the box.

---

### Step 7: Focus Indicator Contrast Audit

**Current focus styles across quiz components:**
- Grid buttons: `focus-visible:ring-[3px] focus-visible:ring-ring/50`
- Answer labels: `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2`
- Action buttons: Default `Button` focus styles from shadcn/ui
- RadioGroupItem: `focus-visible:ring-[3px] focus-visible:border-ring focus-visible:ring-ring/50`

**Concern:** `ring-ring/50` is 50% opacity — may not pass 4.5:1 contrast. Need to verify `--ring` color value against card backgrounds.

**Changes needed:**
- Check `--ring` token value in theme.css
- If `ring/50` doesn't meet 4.5:1 contrast, increase to `ring-ring` (full opacity) or `ring-ring/70`
- QuestionGrid buttons are the most likely candidates for needing adjustment since they use `/50`

---

### Step 8: E2E Tests

**File:** `tests/e2e/regression/story-e18-s01.spec.ts`

**Test structure:** Follow patterns from `story-e14-s02.spec.ts` (existing keyboard test reference).

**Helper setup:**
- Seed a quiz with mixed question types (MC, MS, TF, FIB) via IDB seeding helper
- Navigate to quiz page and start quiz

**Test cases:**

1. **Tab through entire quiz — all interactive elements reachable in logical order**
   - Start quiz → Tab through: answer option → MarkForReview checkbox → Previous button → Next/Submit button → QuestionGrid first button
   - Verify each element receives focus in expected order

2. **Answer MC question using keyboard only**
   - Tab to radio group → Arrow Down to select → verify answer registered
   - Verify focus auto-advances to Next button after selection

3. **Answer MS question using keyboard only**
   - Tab to first checkbox → Space to toggle → Tab to next → Space to toggle
   - Verify multiple selections registered

4. **QuestionGrid arrow navigation**
   - Tab to grid → Arrow Right moves focus → Arrow Left moves focus
   - Enter on grid button jumps to that question
   - Verify roving tabindex (only one button in tab order)

5. **Programmatic focus on question change**
   - Navigate to next question → verify question text container has focus
   - Verify question text is NOT reachable via Tab

6. **Submit quiz using Enter key**
   - Navigate to last question → Tab to Submit button → Enter → dialog opens
   - Tab within dialog (focus trapped) → Enter on "Submit Anyway" → results page

7. **Modal focus trap and Escape**
   - Open submit dialog → Tab cycles within dialog (doesn't escape)
   - Press Escape → dialog closes → focus returns to Submit button

8. **Complete quiz using keyboard only (integration)**
   - Answer all questions, navigate between them, submit — entirely keyboard-driven

---

## File Change Summary

| File | Change Type | Description |
|------|------------|-------------|
| `src/app/pages/Quiz.tsx` | Modify | Add questionTextRef, useEffect for focus, wrap QuestionDisplay |
| `src/app/components/quiz/QuestionGrid.tsx` | Modify | Roving tabindex, arrow key navigation, role="toolbar" |
| `src/styles/theme.css` | Possibly | Adjust focus ring contrast if needed |
| `tests/e2e/regression/story-e18-s01.spec.ts` | Create | Full keyboard navigation E2E test suite |

## Dependencies

- No new npm packages required
- Radix UI primitives (RadioGroup, Checkbox, AlertDialog) provide built-in keyboard support
- Only custom keyboard handling needed: QuestionGrid roving tabindex + programmatic focus

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Radix RadioGroup arrow keys conflict with custom number key handlers | Number key handlers use `document.addEventListener` and check `e.target.tagName` — they skip when focus is on radio inputs. Should coexist. Test explicitly. |
| Focus restoration after AlertDialog close may not work without explicit trigger | Radix returns focus to previously focused element. If it fails, add manual `nextBtnRef.current?.focus()` in `onOpenChange`. |
| `ring-ring/50` focus indicator may not pass 4.5:1 contrast | Audit theme.css `--ring` value. Fallback: bump to `ring-ring/70` or full opacity on quiz components only. |
| QuestionGrid roving tabindex state could desync from currentIndex | Sync via `useEffect` on `currentIndex` change. |

## Build Sequence

1. Step 1 (programmatic focus) — standalone, no dependencies
2. Step 2 (QuestionGrid roving tabindex) — standalone
3. Steps 3-4 (verify radio/checkbox) — verification only, may need no code
4. Step 5 (tab order audit) — verification, likely no changes
5. Step 6 (dialog verification) — verification, may need minor fix
6. Step 7 (focus contrast audit) — may need CSS adjustment
7. Step 8 (E2E tests) — depends on all above being complete
