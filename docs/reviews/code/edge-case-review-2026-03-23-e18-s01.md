## Edge Case Review — E18-S01 (2026-03-23)

### Unhandled Edge Cases

**`src/app/components/quiz/QuestionGrid.tsx:36-37`** — `ArrowRight or ArrowLeft pressed when total === 0`
> Consequence: NaN stored in focusedIndex state, focus call silently fails
> Guard: `if (total === 0) return;`

---

**`src/app/components/quiz/QuestionGrid.tsx:45-46`** — `End key pressed when total === 0`
> Consequence: focusedIndex set to -1; subsequent Enter calls onQuestionClick(-1)
> Guard: `if (total === 0) return;`

---

**`src/app/components/quiz/QuestionGrid.tsx:47-49`** — `Enter pressed after End key on zero-question grid`
> Consequence: Parent navigateToQuestion receives -1; may navigate to invalid index
> Guard: `case 'Enter': if (focusedIndex >= 0 && focusedIndex < total) onQuestionClick(focusedIndex); return;`

---

**`src/app/components/quiz/QuestionGrid.tsx:28-30`** — `total shrinks after mount; focusedIndex exceeds new total`
> Consequence: focusedIndex out of bounds; next arrow key modulo wraps incorrectly on stale state
> Guard: `setFocusedIndex(Math.min(currentIndex, Math.max(0, total - 1)));`

---

**`src/app/pages/Quiz.tsx:324-326`** — `currentProgress transitions to null after quiz submission`
> Consequence: focus() called on element being unmounted; possible scroll-jump in some browsers
> Guard: `if (currentProgress?.currentQuestionIndex == null) return;`

---

**`src/app/pages/Quiz.tsx:457-463`** — `ArrowDown pressed to browse radio, then Tab away without selecting`
> Consequence: isArrowNavRef stays true; next question auto-advance suppressed silently
> Guard: `Add blur/question-change reset: useEffect cleanup or onBlur sets isArrowNavRef.current = false`

---

**`src/app/pages/Quiz.tsx:474-476`** — `Component unmounts while rAF is pending (rapid route change)`
> Consequence: rAF fires post-unmount; focus called on detached nextBtnRef (deferred no-op, no crash)
> Guard: `return () => cancelAnimationFrame(rafRef.current);`

---

**Total:** 7 unhandled edge cases found.
