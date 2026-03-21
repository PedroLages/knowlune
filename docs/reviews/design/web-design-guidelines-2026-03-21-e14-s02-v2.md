# Web Design Guidelines Review — E14-S02 (Round 2)

**Date:** 2026-03-21
**Story:** E14-S02 — Display Multiple Select Questions (Partial Credit)
**Reviewer:** Claude Opus 4.6
**Scope:** MultipleSelectQuestion, MultipleChoiceQuestion, TrueFalseQuestion, QuizActions
**Focus:** Second-round review of fixes + new code (kbd badges, number key shortcuts, forwardRef)

---

## Previous Findings Status

| Finding | Status |
|---------|--------|
| `aria-describedby` for "Select all that apply" hint | FIXED — `aria-describedby={hintId}` on fieldset |
| Redundant `role="group"` on fieldset | FIXED — removed |
| Redundant `aria-label` on fieldset | FIXED — removed |

---

## BLOCKER

None.

---

## HIGH

None.

---

## MEDIUM

### M1. Global keydown listeners conflict when multiple question components mount simultaneously

**Files:** All three question components
**Lines:** `document.addEventListener('keydown', handleKeyDown)` (MultipleSelectQuestion:54, MultipleChoiceQuestion:47, TrueFalseQuestion:43)

**Issue:** Each question component registers a global `document` keydown listener. If more than one question component is mounted at the same time (e.g., during a transition, review mode showing all questions, or a future layout change), pressing a number key would fire handlers on every mounted instance, causing unintended selections.

**Recommendation:** Scope the keydown listener to the fieldset element via `onKeyDown` on the `<fieldset>` instead of `document.addEventListener`. This also eliminates the need for `useEffect` cleanup. If global shortcuts are intentionally desired (so the user does not need focus inside the fieldset), add a guard that checks whether only one question is visible, or use a context/ref to track the "active" question.

**WCAG Reference:** Not a direct WCAG violation, but affects predictable behavior (WCAG 3.2.2 On Input).

### M2. Number key shortcuts may interfere with assistive technology and browser shortcuts

**Files:** All three question components
**Lines:** `e.preventDefault()` on digit keys

**Issue:** Calling `preventDefault()` on digit keys at the document level can interfere with:
- Screen reader shortcuts that use number keys (e.g., JAWS uses 1-6 for heading levels in virtual cursor mode)
- Browser extensions or user-configured shortcuts
- Users typing in other focusable elements on the page (e.g., search bar in the header)

**Recommendation:** At minimum, check that the active element is not an input/textarea/contenteditable before handling the shortcut:
```typescript
const tag = (e.target as HTMLElement).tagName
if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
```
Ideally, scope the listener to the fieldset element (see M1) so shortcuts only fire when the quiz question area has focus.

### M3. `handleToggle` is not in the dependency array of `useCallback` for `handleKeyDown` (MultipleSelectQuestion)

**File:** MultipleSelectQuestion.tsx:49
**Lines:** `[isActive, options, value, onChange]`

**Issue:** `handleKeyDown` calls `handleToggle` (defined as a plain function at line 33), but `handleToggle` is not listed in the `useCallback` dependency array. Instead, the deps list `value` and `onChange` individually. While this happens to work because `handleToggle` closes over the same values, it is fragile — if `handleToggle` gains additional dependencies in the future, the stale closure would cause bugs.

**Recommendation:** Either wrap `handleToggle` in `useCallback` and include it in `handleKeyDown`'s dependency array, or inline the toggle logic directly inside `handleKeyDown`.

---

## LOW

### L1. Kbd badge touch target is small but acceptable given `aria-hidden="true"`

**Files:** All three question components
**Lines:** `w-5 h-5` (20x20px)

**Issue:** The kbd badge is 20x20px, below the 44x44px mobile touch target guideline. However, since it is `aria-hidden="true"` and is purely decorative (not interactive), this is not a functional problem. The surrounding `<label>` element with `min-h-12` (48px) and `p-4` provides the actual touch target.

**Status:** Acceptable. No action needed.

### L2. Checkbox component lacks explicit `aria-label` for screen readers

**File:** MultipleSelectQuestion.tsx:97-102

**Issue:** The `<Checkbox>` does not have an explicit `aria-label`. It relies on the wrapping `<label>` element for its accessible name. This is correct HTML semantics — the label association is implicit via DOM nesting. However, some screen readers may announce the checkbox without clear context if the label text is long and the user navigates by form controls.

**Status:** Acceptable. The wrapping `<label>` provides the accessible name correctly per HTML spec.

### L3. QuizActions `role="group"` with `aria-label` is appropriate

**File:** QuizActions.tsx:19

**Issue reviewed:** The `role="group"` with `aria-label="Quiz controls"` on the wrapper `<div>` is appropriate here since this is a `<div>`, not a `<fieldset>`. This groups related buttons for screen reader users.

**Status:** Correct usage. No action needed.

### L4. Submit button aria-label could use `aria-describedby` instead

**File:** QuizActions.tsx:42-44

**Issue:** The submit button uses `aria-label` which replaces the visible text entirely. The long description "Submit Quiz — ends the quiz and shows your results" overrides the visible "Submit Quiz" label, which can confuse sighted screen reader users who see one label but hear another.

**Recommendation:** Consider using `aria-describedby` with a visually hidden `<span>` for the supplementary text, keeping the visible label as the accessible name:
```tsx
<Button aria-describedby="submit-desc">Submit Quiz</Button>
<span id="submit-desc" className="sr-only">Ends the quiz and shows your results</span>
```
This preserves the visible label match while adding context. Minor — current implementation is functional.

---

## Positive Observations

1. **Design tokens used consistently** — All colors reference semantic tokens (`bg-brand-soft`, `border-brand`, `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-accent`, `bg-muted`, `border-border`). No hardcoded colors detected.

2. **Touch targets meet guidelines** — All interactive `<label>` elements have `min-h-12` (48px) and `p-4` padding, exceeding the 44x44px minimum. QuizActions buttons have `min-h-[44px]`.

3. **Motion reduction respected** — `motion-reduce:transition-none` applied to option labels.

4. **Keyboard focus indicators present** — `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2` on option labels; buttons inherit shadcn focus styles.

5. **Semantic HTML** — Proper use of `<fieldset>`, `<legend>`, `<label>`, and `<RadioGroup>`. The `aria-describedby` on the MultipleSelect fieldset correctly links to the "Select all that apply" hint.

6. **forwardRef on QuizActions** — Clean implementation with named function for React DevTools. Ref correctly forwarded to the contextually relevant button (Next or Submit).

7. **kbd badges correctly hidden** — `aria-hidden="true"` prevents screen readers from announcing visual-only shortcut hints.

8. **Brand button variant** — Submit button uses `variant="brand"` per project conventions.

9. **Responsive typography** — `text-lg lg:text-xl` on legends provides appropriate scaling.

---

## Summary

| Severity | Count | Action Required |
|----------|-------|----------------|
| BLOCKER  | 0     | —              |
| HIGH     | 0     | —              |
| MEDIUM   | 3     | Recommended    |
| LOW      | 4     | Optional       |

**Verdict:** No blockers or high-severity issues. The three MEDIUM findings relate to the global keydown shortcut pattern (conflict risk, AT interference, stale closure risk) and are worth addressing before the next epic. The component code is well-structured, accessible, and follows project conventions.
