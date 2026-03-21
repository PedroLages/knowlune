## Edge Case Review — E14-S03 (2026-03-21)

### Unhandled Edge Cases

**FillInBlankQuestion.tsx:37-46** — `onBlur fires while debounce timer is still pending`
> Consequence: onChange called twice with same value within 300ms
> Guard: `function handleBlur() { clearTimeout(timerRef.current); onChange(inputValue); }`

**FillInBlankQuestion.tsx:33-35** — `value prop changes (nav back) re-triggers debounce effect`
> Consequence: Redundant onChange write-back of already-persisted value
> Guard: `useEffect(() => { setInputValue(value ?? ''); isInitialMount.current = true; }, [value])`

**FillInBlankQuestion.tsx:37-46** — `Component unmounts <300ms after last keystroke without blur`
> Consequence: Last typed characters silently lost (never persisted)
> Guard: `onBlur or useEffect cleanup that calls onChange with current inputValue`

**FillInBlankQuestion.tsx:63** — `question.text is undefined or null`
> Consequence: Silent empty render with no visible question text
> Guard: `<Markdown ...>{question.text ?? ''}</Markdown>`

**QuestionDisplay.tsx:38** — `Quiz state stores array value for fill-in-blank question`
> Consequence: Prior answer silently discarded, input renders empty
> Guard: `const stringValue = typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined`

---
**Total:** 5 unhandled edge cases found.
