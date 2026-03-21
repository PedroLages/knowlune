## Edge Case Review — E14-S02 v2 (2026-03-21)

### Unhandled Edge Cases

**[MultipleSelectQuestion.tsx:40-50, MultipleChoiceQuestion.tsx:33-43, TrueFalseQuestion.tsx:28-38]** — `User presses number key while focus is inside an input, textarea, or contentEditable element (e.g., Layout search bar, browser devtools)`
> Consequence: The `document.addEventListener('keydown', ...)` handler fires globally with no `activeElement` guard. Pressing "1", "2", etc. while typing in the search bar (Layout.tsx line 390) or any future text input on the quiz page will simultaneously toggle/select a quiz option and type the character. The Layout's own `?` shortcut (line 262) correctly checks `isEditable` — these handlers do not.
> Guard: `if (['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement?.tagName ?? '')) || (document.activeElement as HTMLElement)?.isContentEditable) return`

---

**[MultipleSelectQuestion.tsx:40-50, MultipleChoiceQuestion.tsx:33-43, TrueFalseQuestion.tsx:28-38]** — `Submit confirmation AlertDialog is open while keydown listener is still active`
> Consequence: When the AlertDialog (Quiz.tsx line 349) is open, the question components remain mounted and their `document.addEventListener('keydown')` handlers are still registered. Pressing "1" or "2" while reviewing the submit dialog will silently change the answer on the current question behind the modal. Radix AlertDialog does trap focus but does not `stopPropagation` on keydown events from reaching document-level listeners.
> Guard: Add an `isDialogOpen` prop or context check, or attach the listener to the fieldset element instead of `document`

---

**[MultipleSelectQuestion.tsx:40-50, MultipleChoiceQuestion.tsx:33-43, TrueFalseQuestion.tsx:28-38]** — `User triggers number key during IME composition (CJK input methods)`
> Consequence: When composing CJK characters, pressing number keys selects candidates in the IME popup. The handler does not check `e.isComposing`, so it will call `e.preventDefault()` and intercept the key, breaking IME input for any text field that happens to not have focus (since the listener is on `document`). Combined with the missing `activeElement` guard above, this could break IME even when typing in a text field.
> Guard: `if (e.isComposing) return`

---

**[MultipleSelectQuestion.tsx:33-36]** — `handleToggle is a plain function closed over stale value when called from useCallback`
> Consequence: `handleKeyDown` is wrapped in `useCallback` with deps `[isActive, options, value, onChange]`, but it calls `handleToggle` which is a plain function that also closes over `value`. When `handleKeyDown` is recreated (deps change), it captures the current `handleToggle`. However, if React batches state updates and `value` changes between keystrokes in the same tick, the closure could see stale `value`. This is a theoretical race under rapid key presses — the practical risk is low because React 19 auto-batches, but the pattern is fragile. The MultipleChoiceQuestion avoids this by calling `onChange` directly.
> Guard: Inline the toggle logic inside `handleKeyDown`: `const newValue = value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]; onChange(newValue)`

---

**[QuizActions.tsx:30-35, 37-50]** — `ref is conditionally attached to Next OR Submit button via two separate branches`
> Consequence: When transitioning from the second-to-last question to the last question, the Next button unmounts and the Submit button mounts. During this transition, `ref.current` is briefly `null`. The Quiz.tsx `requestAnimationFrame` call (line 316) mitigates this for auto-focus, but any external code that reads `nextBtnRef.current` synchronously after a `goToNextQuestion` call on the penultimate question will get `null`. If a future feature adds synchronous ref access (e.g., scroll-into-view), it will silently fail.
> Guard: Use `ref.current?.focus()` (already done) and document that `ref` may be null during question transitions

---

**[MultipleSelectQuestion.tsx:89-95, MultipleChoiceQuestion.tsx:84-90, TrueFalseQuestion.tsx:80-86]** — `Question has more than 9 options (kbd badge displays "10", "11", etc. but key shortcut only works for 1-9)`
> Consequence: The `kbd` badge renders `index + 1` for every option with no upper bound. For a question with 10+ options, badges will show "10", "11", etc., but the keyboard handler parses `e.key` as a single digit (`parseInt(e.key, 10)`), so pressing "1" then "0" would select option 1 (not option 10). The badge misleads the user into thinking "10" is a valid shortcut. MultipleSelectQuestion has no upper bound warning in dev mode (unlike MultipleChoiceQuestion which warns at >6).
> Guard: `{index < 9 && isActive && (<kbd ...>{index + 1}</kbd>)}` — only render kbd badges for options 1-9

---

**[MultipleSelectQuestion.tsx:44, MultipleChoiceQuestion.tsx:37, TrueFalseQuestion.tsx:32]** — `e.preventDefault() intercepts browser/OS shortcuts that use number keys`
> Consequence: Some browser extensions and assistive technologies use number keys for navigation (e.g., Vimium link hints, screen reader heading navigation with numbers). The blanket `e.preventDefault()` on any number key 1-N will break these tools. The handler does not check for modifier keys (Ctrl, Alt, Meta) which could distinguish intentional shortcuts from quiz input.
> Guard: `if (e.ctrlKey || e.metaKey || e.altKey) return` before the `parseInt` check

---

**Total:** 7 unhandled edge cases found.
