## Edge Case Review — E23-S06 (2026-03-23)

### Unhandled Edge Cases

**FeaturedAuthor.tsx:88** — `stats.totalHours is NaN (e.g., corrupted or missing data upstream)`
> Consequence: Math.round(NaN) and Math.max(NaN, ...) both return NaN, rendering "NaNh" in the UI
> Guard: `const hours = Number.isFinite(stats.totalHours) ? stats.totalHours : 0`

---

**FeaturedAuthor.tsx:94** — `author.yearsExperience is NaN or undefined coerced to number`
> Consequence: Math.max(0, NaN) returns NaN, rendering "NaNy" as the experience stat
> Guard: `value={\`${Math.max(0, Number.isFinite(author.yearsExperience) ? author.yearsExperience : 0)}y\`}`

---

**FeaturedAuthor.tsx:106** — `author.id is empty string ""`
> Consequence: Link navigates to `/authors/` which may not match any route, showing a blank page or 404
> Guard: `{author.id ? <Link to={...}>View Full Profile</Link> : <span className="text-muted-foreground text-sm">Profile unavailable</span>}`

---

**FeaturedAuthor.tsx:48-49** — `author.name or author.title is empty string ""`
> Consequence: Renders empty `<h2>` and/or `<p>` tags, creating visual gaps with no content
> Guard: `{author.name && <h2 ...>{author.name}</h2>}` or provide fallback text like "Unknown Author"

---

**Authors.tsx:92** — `stats.totalHours is NaN in grid card aria-label`
> Consequence: aria-label renders "NaN hours" which screen readers announce as nonsense
> Guard: `${Number.isFinite(stats.totalHours) ? Math.round(stats.totalHours) : 0} hours`

---

**QuestionGrid.tsx:34-37** — `total is 0 (quiz with no questions)`
> Consequence: Arrow key modulo by zero produces NaN; setFocusedIndex(NaN) makes all buttons unfocusable
> Guard: `if (total === 0) return` at top of handleKeyDown

---

**MultipleChoiceQuestion.tsx:58-66** — `requestAnimationFrame callback fires after component unmount`
> Consequence: onChange called on unmounted component; React may log a warning or cause stale state update
> Guard: Store rAF ID in ref and cancel in useEffect cleanup, or check a mounted ref before calling onChange

---

**TrueFalseQuestion.tsx:52-60** — `requestAnimationFrame callback fires after component unmount`
> Consequence: Same as MultipleChoiceQuestion: stale onChange invocation after unmount
> Guard: Store rAF ID in ref and cancel in useEffect cleanup, or check a mounted ref before calling onChange

---

**MultipleChoiceQuestion.tsx:63 / TrueFalseQuestion.tsx:57** — `radio option has value="" (empty string)`
> Consequence: `if (val)` guard skips empty-string values, so arrow-key navigation silently refuses to select that option
> Guard: `if (val != null)` instead of `if (val)` to allow empty-string values

---

**FeaturedAuthor.tsx:83** — `stats.courseCount is 0 (author has no linked courses)`
> Consequence: Displays "0 Courses" which undermines the hero layout's credibility-building purpose
> Guard: Conditionally hide the stat card or show a placeholder: `{stats.courseCount > 0 && <StatCard ... />}`

---

**QuestionGrid.tsx:44** — `total is 0 and End key pressed`
> Consequence: nextIndex set to -1, setFocusedIndex(-1) means no button matches tabIndex 0, toolbar becomes unreachable via Tab
> Guard: Early return from handleKeyDown when total === 0

---

**Authors.tsx:104** — `stats.totalHours rounds to 0 for small fractional values (e.g., 0.3h) in grid card`
> Consequence: Grid card shows "0h" despite having some content, which looks like missing data
> Guard: `{stats.totalHours > 0 && stats.totalHours < 1 ? '<1' : Math.round(stats.totalHours)}h`

---

**Total:** 12 unhandled edge cases found.
