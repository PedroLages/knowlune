## Edge Case Review — E27-S01 (2026-03-25)

### Unhandled Edge Cases

**src/app/pages/Reports.tsx:200** — `setSearchParams({ tab: value }) drops other query params`
> Consequence: Any non-tab query params on /reports URL are silently discarded on tab switch
> Guard: `setSearchParams(prev => { prev.set('tab', value); return prev }, { replace: true })`

---

**src/app/components/reports/QuizAnalyticsTab.tsx:42** — `a.percentage is undefined or NaN in any attempt record`
> Consequence: averageScore becomes NaN, displayed as "NaN%" in the stat card
> Guard: `const pct = Number.isFinite(a.percentage) ? a.percentage : 0`

---

**src/app/components/reports/QuizAnalyticsTab.tsx:131** — `retakeData.averageRetakes is NaN from upstream calculation`
> Consequence: .toFixed(1) renders "NaN" in the retake stat card and detail card
> Guard: `const displayRetakes = Number.isFinite(data.retakeData.averageRetakes) ? data.retakeData.averageRetakes : 0`

---

**src/app/components/reports/QuizAnalyticsTab.tsx:76-82** — `error path sets data=null, renders empty state not error state`
> Consequence: User sees "No quizzes taken yet" after a DB failure despite having quiz data
> Guard: `Add an error state: const [error, setError] = useState(false); render error-specific UI when error is true`

---

**src/app/pages/Reports.tsx:178-182** — `hasActivity removed retakeData.totalAttempts > 0 check`
> Consequence: Users with only quiz attempts (no course progress) see global empty state instead of tabs
> Guard: `Restore quiz-attempt check in hasActivity or add QuizAnalyticsTab's own data to the condition`

---
**Total:** 5 unhandled edge cases found.
