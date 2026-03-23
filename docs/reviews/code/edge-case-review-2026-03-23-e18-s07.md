## Edge Case Review — E18-S07 (2026-03-23)

### Unhandled Edge Cases

**`src/lib/analytics.ts:calculateQuizAnalytics`** — `attempt.percentage` is `NaN`, `undefined`, or negative in stored record`
> Consequence: `averageScore` and `completionRate` render as `NaN%` in UI
> Guard: `const pct = typeof a.percentage === 'number' && isFinite(a.percentage) ? a.percentage : 0`

---

**`src/lib/analytics.ts:calculateQuizAnalytics`** — `attempt.completedAt` is a malformed or non-ISO string
> Consequence: Sort comparator returns `NaN`, order is unpredictable and `lastAttemptDate` may be corrupt
> Guard: `const t = new Date(a.completedAt).getTime(); return isNaN(t) ? 0 : t`

---

**`src/lib/analytics.ts:calculateQuizAnalytics`** — `Math.max(...spread)` over a very large `attempts` array (tens of thousands)
> Consequence: `RangeError: Maximum call stack size exceeded`, analytics function throws entirely
> Guard: `const bestScore = attempts.reduce((m, a) => Math.max(m, a.percentage), 0)`

---

**`src/lib/analytics.ts:calculateQuizAnalytics`** — `uniqueQuizzes` exceeds `totalQuizzesAvailable` due to orphaned attempts referencing deleted quizzes
> Consequence: `completionRate` exceeds 100%, displayed as e.g. `120%` in the UI
> Guard: `Math.min(100, Math.round((uniqueQuizzes / totalQuizzesAvailable) * 100))`

---

**`src/lib/analytics.ts:calculateQuizAnalytics`** — 5 or fewer unique quizzes total causes `topPerforming` and `needsImprovement` to share the same items
> Consequence: Same quizzes appear in both "Top Performing" and "Needs Practice" cards simultaneously
> Guard: `const needsImprovement = sortedByScore.length > 5 ? [...sortedByScore].reverse().slice(0, 5) : []`

---

**`src/app/components/reports/QuizAnalyticsDashboard.tsx:useEffect` catch handler** — `calculateQuizAnalytics` rejects (IndexedDB error, schema mismatch, quota exceeded)
> Consequence: User sees "No quiz data yet" empty state with no indication an error occurred (silent failure)
> Guard: `const [error, setError] = useState<string | null>(null); /* in catch: */ setError('Failed to load analytics')`

---

**`src/app/components/reports/QuizAnalyticsDashboard.tsx:recentAttempts` table render** — `attempt.completedAt` is an invalid date string
> Consequence: Table cell renders the literal text `"Invalid Date"`, visible to the user
> Guard: `const d = new Date(attempt.completedAt); d.toLocaleDateString() if !isNaN(d.getTime()) else 'Unknown'`

---

**`src/app/pages/Reports.tsx:activeTab`** — URL contains an arbitrary `?tab=<unknown>` value
> Consequence: `<Tabs>` renders with an unrecognised value; the active tab content area is blank with no user feedback
> Guard: `const VALID_TABS = ['study', 'quizzes', 'ai']; const activeTab = VALID_TABS.includes(raw) ? raw : 'study'`

---

**`src/app/pages/Reports.tsx:setSearchParams`** — `setSearchParams({ tab })` called when other query params are present
> Consequence: All existing query parameters are silently wiped on every tab switch
> Guard: `setSearchParams(prev => { prev.set('tab', tab); return prev })`

---

**Total:** 9 unhandled edge cases found.
