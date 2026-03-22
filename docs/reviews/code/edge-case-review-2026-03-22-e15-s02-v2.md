## Edge Case Review — E15-S02 (2026-03-22) v2

### Previous Fixes Verified

- **Negative/zero timeLimit**: Guarded in store (`quiz.timeLimit > 0` at useQuizStore.ts:89) — confirmed fixed.
- **Unsafe `as` cast**: Replaced with `TimerAccommodationEnum.safeParse()` in both `handleValueChange` and `loadSavedAccommodation` — confirmed fixed.
- **Floating-point rounding**: `Math.min(Math.round(fractional * 60), 59)` cap present in both `formatTimeBadge` and `formatDuration` — confirmed fixed.

### Unhandled Edge Cases

**src/app/pages/Quiz.tsx:179-200** — `User changes accommodation on start screen, then clicks Resume`
> Consequence: Timer runs with old accommodation; UI badge shows new one — mismatch
> Guard: `if (savedProgress.timerAccommodation !== accommodation) { savedProgress = { ...savedProgress, timerAccommodation: accommodation, timeRemaining: computeAdjustedTime(quiz.timeLimit, accommodation) } }`

**src/app/pages/Quiz.tsx:263** — `Quiz started with 150% or 200% accommodation`
> Consequence: Timer warning thresholds (25%, 10%) fire too late relative to actual time
> Guard: `const multiplier = getAccommodationMultiplier(currentProgress?.timerAccommodation ?? 'standard') ?? 1; const totalTimeSeconds = currentQuiz?.timeLimit != null ? currentQuiz.timeLimit * multiplier * 60 : 0`

---
**Total:** 2 unhandled edge cases found.
