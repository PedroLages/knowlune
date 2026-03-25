## Edge Case Review — E18-S09 (2026-03-24)

### Unhandled Edge Cases

**[src/lib/quizPreferences.ts:39-43]** — `saveQuizPreferences called while localStorage is full or disabled (Safari private mode)`
> Consequence: `localStorage.setItem` throws, unhandled exception crashes the caller
> Guard: `try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch { /* toast or silent fallback */ }`

---

**[src/lib/quizPreferences.ts:40-41]** — `saveQuizPreferences receives a patch with extra or invalid keys from a programmatic caller`
> Consequence: Invalid values bypass Zod on write, persist to localStorage, and fail validation on next read (silent reset to defaults)
> Guard: `const updated = QuizPreferencesSchema.parse({ ...current, ...patch })`

---

**[src/app/pages/Quiz.tsx:77-79]** — `catch block in loadSavedAccommodation returns hardcoded 'standard' instead of getQuizPreferences().timerAccommodation`
> Consequence: User's global timer preference is silently ignored when localStorage throws, inconsistent with the happy-path fallback two lines above
> Guard: `return getQuizPreferences().timerAccommodation` (or wrap in nested try/catch to truly fall back to 'standard')

---

**[src/stores/useQuizStore.ts:84]** — `getQuizPreferences() called inside Zustand action without try/catch`
> Consequence: If localStorage access throws (e.g., SecurityError in sandboxed iframe), the entire startQuiz action aborts
> Guard: `const shouldShuffle = (() => { try { return getQuizPreferences().shuffleQuestions } catch { return false } })() || quiz.shuffleQuestions`

---

**[src/stores/useQuizStore.ts:84]** — `OR logic (preference || quiz.shuffleQuestions) is one-directional — user cannot override a quiz-defined shuffle to off`
> Consequence: User sets "shuffle off" globally but quizzes with `shuffleQuestions: true` always shuffle regardless, with no per-quiz override path
> Guard: `const shouldShuffle = getQuizPreferences().shuffleQuestions ?? quiz.shuffleQuestions` (use preference as override, not additive OR)

---

**[src/app/components/settings/QuizPreferencesForm.tsx:42]** — `storage event listener does not filter by key`
> Consequence: Any localStorage write from any origin key (e.g., sidebar state, theme) triggers a full re-read and re-render of quiz preferences
> Guard: `window.addEventListener('storage', (e) => { if (e.key === 'levelup-quiz-preferences') handleUpdate() })`

---

**[src/app/components/settings/QuizPreferencesForm.tsx:53-54]** — `CustomEvent dispatched and toast fired on every toggle/radio change with no debounce`
> Consequence: Rapid toggling (e.g., triple-clicking shuffle) stacks multiple toast notifications and rapid localStorage writes
> Guard: Debounce `update()` by ~300ms or deduplicate toasts with a `toastId`

---

**Total:** 7 unhandled edge cases found.
