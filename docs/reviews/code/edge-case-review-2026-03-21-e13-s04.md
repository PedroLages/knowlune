## Edge Case Review — E13-S04 (2026-03-21)

### Unhandled Edge Cases

**ScoreSummary.tsx:121-124** — `percentage` or `previousBestPercentage` is NaN (corrupted attempt data)`
> Consequence: delta becomes NaN, improvement section renders "Previous best: NaN%" with no delta
> Guard: `const safePrev = Number.isFinite(previousBestPercentage) ? previousBestPercentage : undefined`

**ScoreSummary.tsx:155-166** — `previousBestPercentage` is negative or exceeds 100 (corrupted data)
> Consequence: displays "Previous best: -5%" or "Previous best: 150%" with nonsensical delta
> Guard: `Math.round(Math.min(100, Math.max(0, previousBestPercentage)))` (clamp before display)

**QuizResults.tsx:49-52** — `attempts[].percentage` contains NaN or undefined values
> Consequence: `Math.max(...attempts.slice(0,-1).map(a => a.percentage))` returns NaN, passed to ScoreSummary
> Guard: `const valid = attempts.slice(0,-1).map(a => a.percentage).filter(Number.isFinite); return valid.length ? Math.max(...valid) : undefined`

**Quiz.tsx:116-126** — `hasCompletedBefore` set after `fetchState` already transitions to `'found'`
> Consequence: brief flash of "Start Quiz" before switching to "Retake Quiz" on re-render
> Guard: `await` the attempt count query before calling `setFetchState('found')`, or batch both state updates together

**Quiz.tsx:77+104-138** — `hasCompletedBefore` not reset when `lessonId` changes
> Consequence: navigating from a completed quiz to a fresh quiz briefly shows "Retake Quiz" until Dexie query resolves
> Guard: `setHasCompletedBefore(false)` at the start of the effect before the async query

**QuizResults.tsx:71-78** — `handleRetake` catch block logs error but gives no user feedback
> Consequence: user clicks "Retake Quiz", it silently fails, button appears unresponsive
> Guard: `toast.error('Could not start retake. Please try again.')` inside the catch block

**QuizResults.tsx:146-152** — `aria-disabled="true"` on a non-interactive `<span>` element
> Consequence: screen readers may not announce the disabled state since spans are not interactive elements
> Guard: `<button disabled className="..." type="button">` instead of `<span aria-disabled="true">`

---
**Total:** 7 unhandled edge cases found.
