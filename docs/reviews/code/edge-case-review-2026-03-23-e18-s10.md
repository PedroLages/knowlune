## Edge Case Review — E18-S10 (2026-03-23)

### Unhandled Edge Cases

**[QuizExportCard.tsx:loadCounts]** — `DB read throws; error swallowed by console.error only`
> Consequence: Export button permanently disabled with no user-visible error message
> Guard: `loadCounts().catch(err => { console.error(err); setLoadError(true) })` and render an error state when `loadError` is true

---

**[QuizExportCard.tsx:handleExport]** — `Component unmounts while export is in progress`
> Consequence: `setIsExporting(false)` fires on unmounted component; React warning; potential memory leak
> Guard: `let mounted = true; return () => { mounted = false };` then guard `setIsExporting` calls with `if (mounted)`

---

**[QuizExportCard.tsx:handleExport — DropdownMenuItem onClick]** — `User clicks second menu item before isExporting state propagates`
> Consequence: Two concurrent export operations fire simultaneously; double download; double toast
> Guard: `onClick={() => !isExporting && handleExport('csv')}` on each DropdownMenuItem

---

**[quizExport.ts:formatTimeSpent]** — `ms argument is negative (corrupted timeSpent in DB)`
> Consequence: Output is e.g. `"-2:-1"` — invalid time string written into CSV rows and PDF cells
> Guard: `const safMs = Math.max(0, ms);` and use `safMs` throughout the function

---

**[quizExport.ts:formatTimeSpent]** — `ms argument is NaN or Infinity`
> Consequence: `"NaN:NaN"` or `"Infinity:NaN"` appears in exported CSV/PDF cells
> Guard: `if (!isFinite(ms) || isNaN(ms)) return '—';`

---

**[quizExport.ts:buildAttemptsCsv — totalPoints]** — `quiz.questions is empty array; totalPoints resolves to 0`
> Consequence: Score column renders `"X / 0"` — misleads reader about quiz structure
> Guard: `const scoreLabel = totalPoints > 0 ? \`${a.score} / ${totalPoints}\` : String(a.score);`

---

**[quizExport.ts:formatDate]** — `completedAt is empty string, null, or malformed ISO`
> Consequence: `"Invalid Date"` literal written into CSV rows and PDF table cells
> Guard: `const d = new Date(isoString); return isNaN(d.getTime()) ? 'Unknown' : d.toLocaleDateString('sv-SE');`

---

**[quizExport.ts:buildQuestionsCsv — questionMap lookup]** — `Question deleted from quiz after attempt was recorded`
> Consequence: Answers for deleted questions silently dropped; export appears complete but has undisclosed gaps
> Guard: `if (!question) { rows.push(csvRow([quiz.title, date, \`[deleted: ${answer.questionId}]\`, formatAnswer(answer.userAnswer), '', answer.isCorrect ? 'Correct' : 'Incorrect'])); continue; }`

---

**[quizExport.ts:calculateSummaryStats]** — `attempt.percentage is NaN in any attempt`
> Consequence: `averageScore` and `bestScore` become `NaN`; PDF and CSV show `"NaN%"`
> Guard: `const scores = allAttempts.map(a => a.percentage).filter(p => isFinite(p) && !isNaN(p));`

---

**[quizExport.ts:exportQuizResultsPdf — attempt.percentage]** — `percentage exceeds 100 due to data corruption`
> Consequence: PDF shows e.g. `"120.0%"` as Best Score; misleads reader
> Guard: `const pct = Math.min(100, Math.max(0, a.percentage));` before rendering

---

**[quizExport.ts:exportQuizResultsCsv and exportQuizResultsPdf]** — `Called directly when no attempts exist (bundles empty)`
> Consequence: User receives an empty-data zip or zero-row PDF with no indication of why
> Guard: `if (bundles.length === 0) throw new Error('No quiz attempts to export');` at start of each export function

---

**[quizExport.ts:buildQuestionsCsv and PDF question breakdown — formatAnswer]** — `answer.userAnswer or question.correctAnswer is undefined`
> Consequence: `"undefined"` literal written into CSV cells and PDF table cells
> Guard: `function formatAnswer(answer: string | string[] | undefined): string { if (answer === undefined) return ''; ... }`

---

**[quizExport.ts:escapeCsv]** — `Value contains a tab character`
> Consequence: Tab-delimited parsers and Excel may misparse column boundaries in the exported CSV
> Guard: Add `|| str.includes('\t')` to the quoting condition

---

**[quizExport.ts:exportQuizResultsPdf — doc.text(quiz.title)]** — `quiz.title contains newline or exceeds page width`
> Consequence: Title renders partially or overflows into the margin; PDF layout corrupted for that quiz section
> Guard: `doc.text(quiz.title.replace(/[\r\n]+/g, ' ').substring(0, 80), 14, y);`

---

**Total:** 14 unhandled edge cases found.
