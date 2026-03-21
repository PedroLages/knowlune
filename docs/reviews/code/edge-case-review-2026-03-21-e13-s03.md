## Edge Case Review — E13-S03 (2026-03-21)

### Unhandled Edge Cases

**useQuizStore.ts:277-283** — `localStorage.setItem throws QuotaExceededError on full storage`
> Consequence: Unhandled exception in subscribe listener could break Zustand subscription chain
> Guard: `try { localStorage.setItem(\`quiz-progress-\${quiz.id}\`, JSON.stringify(progress)) } catch (e) { console.warn('[useQuizStore] per-quiz sync failed:', e) }`

---

**useQuizStore.ts:184-187** — `clearQuiz called when currentProgress is null but per-quiz key exists`
> Consequence: Orphaned per-quiz localStorage key persists indefinitely, showing stale Resume button
> Guard: `const quizId = get().currentProgress?.quizId ?? get().currentQuiz?.id; if (quizId) localStorage.removeItem(\`quiz-progress-\${quizId}\`)`

---

**Quiz.tsx:148-155** — `handleResume removes per-quiz key, then setState triggers subscribe which re-writes it`
> Consequence: Per-quiz localStorage key is never actually cleared on resume (contradicts intent of line 155 comment)
> Guard: `Move localStorage.removeItem(\`quiz-progress-\${quiz.id}\`) after the useQuizStore.setState() call, or accept that subscribe will re-write it (the key is harmless while quiz is active)`

---

**Quiz.tsx:188-192** — `beforeunload handler calls localStorage.setItem which throws QuotaExceededError`
> Consequence: Uncaught exception during page unload — progress lost silently with no recovery
> Guard: `try { localStorage.setItem(...) } catch { /* best-effort, no recovery possible during unload */ }`

---

**useQuizStore.ts:144-145** — `submitQuiz fails after localStorage.removeItem (line 145) but before set() completes (line 147)`
> Consequence: Crash recovery data lost despite quiz submission failure — user loses progress on retry
> Guard: `Move localStorage.removeItem inside the try block after the successful set(), or re-write the per-quiz key in the catch rollback path`

---

**Quiz.tsx:37-52** — `loadSavedProgress finds progress whose questionOrder length mismatches quiz.questions.length`
> Consequence: Resume with mismatched question count — currentQuestionIndex could exceed bounds
> Guard: `if (result.data.questionOrder.length !== 0 && result.data.questionOrder.length !== quizQuestionCount) return null` (requires passing question count to loadSavedProgress)

---

**QuizStartScreen.tsx:58** — `autoFocus fires before screen reader finishes announcing page navigation`
> Consequence: Screen reader navigation announcement interrupted on some assistive technologies (VoiceOver, NVDA)
> Guard: `Use useEffect with ref.current?.focus() after a requestAnimationFrame delay instead of native autoFocus attribute`

---

**Total:** 7 unhandled edge cases found.
