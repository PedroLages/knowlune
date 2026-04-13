---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-04e-aggregate-nfr', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-04-13'
epic: E71
title: 'Knowledge Map Contextual Action Suggestions'
overallRisk: LOW
verdict: PASS
inputDocuments:
  - src/lib/actionSuggestions.ts
  - src/app/components/knowledge/ActionCard.tsx
  - src/app/components/knowledge/SuggestedActionsPanel.tsx
  - src/stores/useKnowledgeMapStore.ts
  - src/app/pages/KnowledgeMap.tsx
  - src/lib/__tests__/actionSuggestions.test.ts
  - src/app/components/knowledge/__tests__/ActionCard.test.tsx
  - src/app/components/knowledge/__tests__/SuggestedActionsPanel.test.tsx
  - tests/e2e/story-e71-s03.spec.ts
---

# NFR Assessment — Epic 71: Knowledge Map Contextual Action Suggestions

**Date:** 2026-04-13
**Assessor:** Master Test Architect (bmad-testarch-nfr)
**Epic:** E71 — Knowledge Map Contextual Action Suggestions
**Stories assessed:** E71-S01, E71-S02, E71-S03
**Overall verdict:** PASS (Low Risk)

---

## Scope

| Story | File(s) |
|-------|---------|
| E71-S01 | `src/lib/actionSuggestions.ts` |
| E71-S02 | `src/app/components/knowledge/ActionCard.tsx`, `SuggestedActionsPanel.tsx` |
| E71-S03 | `src/stores/useKnowledgeMapStore.ts`, `src/app/pages/KnowledgeMap.tsx` |

---

## NFR Category Results

| Category | Verdict | Risk |
|----------|---------|------|
| Performance | PASS | LOW |
| Security | PASS | LOW |
| Reliability | CONCERNS | LOW-MEDIUM |
| Maintainability | PASS | LOW |
| Accessibility | PASS | LOW |
| Testability | PASS | LOW |

---

## 1. Performance

**Verdict: PASS**

### Evidence

- `generateActionSuggestions()` is a pure synchronous function with O(n) complexity over declining topics (filter + map + Map dedup + sort + slice). With a realistic upper bound of ~100 topics, worst-case is <1ms per invocation on any modern JS engine.
- The function is called once per `computeScores()` invocation, which itself is cache-gated at 30 seconds (`lastComputedAt` check). Repeated calls within the window are no-ops.
- `SuggestedActionsPanel` renders at most `maxSuggestions` (default 5) cards. No virtualization needed at this scale.
- No per-render computation: `KnowledgeMap.tsx` accesses `suggestions` as pre-computed Zustand state.
- The `useIsMobile` hook causes a conditional render of two `<SuggestedActionsPanel>` instances (mobile inline + desktop sidebar). Only one is rendered at a time based on the boolean; no duplicate computation.

### Risks

None. Data volume is inherently bounded by topic count (typically <50 in practice, hard ceiling ~200).

---

## 2. Security

**Verdict: PASS**

### Evidence

- All URL construction uses `encodeURIComponent()` at `actionSuggestions.ts:105`, `:119`, `:137-138`. Topic canonical names and lesson/course IDs are URI-encoded before embedding in routes.
- Routes are internal (`/flashcards?topic=...`, `/quiz?topic=...`, `/courses/.../lessons/...`) — no external URL construction.
- `ActionCard` renders `actionLabel` and `topicName` via plain JSX text interpolation. React's JSX escaping prevents XSS from user-generated content in topic names or lesson titles. No raw HTML injection API is used anywhere in E71 components.
- `lessonTitle` is rendered through `actionLabel` — no raw HTML insertion.
- No external data fetching, no secrets, no authentication tokens involved in this feature.

### Risks

None identified. Pre-condition: upstream data sources (quiz questions, course imports) must sanitize topic strings — this is outside E71's scope and is an architectural dependency.

---

## 3. Reliability

**Verdict: CONCERNS (Low-Medium)**

### Evidence — Handled Edge Cases

- Empty topics array: `generateActionSuggestions([])` returns `[]` immediately (line 190).
- All-strong topics: filter removes them; returns `[]`.
- Topic with no activities (no flashcards, quizzes, lessons): `generateTopicSuggestions` returns `[]`; topic produces no suggestions, silently skipped.
- Missing `recencyScore`: falls back to default `50` via `?? 50` (line 202).
- Missing `durationMinutes` on lesson: falls back to `DEFAULT_LESSON_DURATION = 15` (line 141).
- `resolvedTopics.length === 0`: store sets `suggestions: []` (lines 181-188).
- Store `catch` block: sets `error` message and `isLoading: false` (lines 407-412). UI renders `EmptyState` on error.

### Concerns

**C1 — Lesson title approximation leaks into UI (MEDIUM)**
`useKnowledgeMapStore.ts:388-391` constructs lesson entries as:
```ts
lessons: t.courseIds.map(courseId => ({
  lessonId: courseId,
  courseId,
  title: `${t.name} Lesson`,   // placeholder title
  completionPct: t.scoreResult.score,
}))
```
The `title` field is a synthetic approximation used in `actionLabel` ("Rewatch {title}"). Users see "Rewatch Linear Algebra Lesson" rather than an actual lesson title. This is documented via a TODO comment (`TODO(E56-S04)`) but degrades UX quality of lesson-rewatch suggestions. No crash risk.

**C2 — Trend derivation is a coarse proxy (LOW)**
`useKnowledgeMapStore.ts:377-381` maps `daysSinceLastEngagement` to trend using fixed thresholds:
- > 14 days → 'declining'
- > 7 days → 'stable'
- otherwise → 'improving'

This ignores score trajectory. A topic with a score of 95 unused for 15 days is labelled "declining," potentially inflating urgency. Deferred per roadmap.

**C3 — stale `suggestions` not reset on cache invalidation (LOW)**
`invalidateCache()` sets `lastComputedAt: null` but does not reset `suggestions: []`. If courses are deleted between sessions, `suggestions` retains stale data until the next `computeScores()` call completes. Harmless in practice (page mount triggers recompute) but inconsistent state.

---

## 4. Maintainability

**Verdict: PASS**

### Evidence

- `generateActionSuggestions` is a pure function with no side effects, no React/Zustand/Dexie imports. All constituent functions exported for independent testing.
- Weights are named constants (`URGENCY_WEIGHTS`) rather than magic numbers.
- Store approximations are explicitly flagged with TODO comments cross-referencing future work.
- FSRS bypass is commented at `useKnowledgeMapStore.ts:393-395` with a clear migration path.
- Unit test coverage: 15 test cases covering all ACs, edge cases (empty input, all-strong, no activities, default recency fallback), and mathematical precision assertions (`toBeCloseTo`).
- Component unit tests present for `ActionCard` and `SuggestedActionsPanel`.
- E2E story spec present: `tests/e2e/story-e71-s03.spec.ts`.

### Minor Notes

`SuggestedActionsPanel.tsx:26`: `hiddenCount` is computed as `suggestions.length - maxVisible` without checking for `maxVisible === undefined`, but the containing `hasOverflow` boolean already guards this branch. Safe but slightly non-obvious.

---

## 5. Accessibility

**Verdict: PASS**

### Evidence

- `ActionCard` uses `<article role="listitem">` with descriptive `aria-label` including action label, topic name, score, and trend (line 85).
- `SuggestedActionsPanel` wraps cards in `<div role="list">` and uses `<section aria-labelledby={titleId}>` with `useId()`-generated stable ID (lines 29-43).
- CTA button renders as `<Button asChild><Link to={actionRoute}>{ctaLabel}</Link></Button>` — produces a proper `<a>` element with visible text, not icon-only.
- Show more/less toggle is `<button type="button">` with text label including count ("Show 3 more suggestions").
- `motion-safe:hover:` modifier respects `prefers-reduced-motion`.
- Category filter chips use `aria-pressed` (KnowledgeMap.tsx line 142).
- Loading skeleton has `role="status" aria-busy="true" aria-label="Loading knowledge map"`.
- `MobileTopicCard` uses `role="button" tabIndex={0}` with `onKeyDown` for Enter/Space.

### Concerns

**A1 — Show-more button missing `aria-expanded` (LOW)**
`SuggestedActionsPanel.tsx:88-105`: The toggle `<button>` changes text content but lacks `aria-expanded`. Screen readers benefit from `aria-expanded={expanded}` to communicate state programmatically.

---

## 6. Testability

**Verdict: PASS**

- Pure function architecture enables isolated unit tests without mocking.
- `data-testid` attributes on `suggested-actions-panel` and `action-card` support stable E2E selectors.
- `makeTopic()` factory helper avoids repetition across 15 unit test cases.
- Deterministic time constant `FIXED_DATE` declared per ESLint test-patterns rule.
- No `Date.now()` or `waitForTimeout()` anti-patterns detected.

---

## Fixable Issues (Code-Level)

| ID | Severity | File:Line | Issue | Fix |
|----|----------|-----------|-------|-----|
| NFR-71-01 | LOW | `src/app/components/knowledge/SuggestedActionsPanel.tsx:88` | Show-more button missing `aria-expanded` | Add `aria-expanded={expanded}` to the `<button>` |
| NFR-71-02 | LOW | `src/stores/useKnowledgeMapStore.ts:415` | `invalidateCache()` does not reset `suggestions` | Add `suggestions: []` to the `set()` call |

---

## Architectural Issues (Deferred)

| ID | Severity | Issue | Deferred To |
|----|----------|-------|-------------|
| ARCH-71-01 | MEDIUM | Lesson title in action suggestions is a synthetic approximation (`${t.name} Lesson`), not real lesson data. Reduces UX value of lesson-rewatch suggestions. | E56-S04 (existing TODO comment) |
| ARCH-71-02 | LOW | Trend derivation is time-only (threshold on `daysSinceLastEngagement`), ignores score trajectory. May produce misleading labels. | Post-E56 when score history is available |
| ARCH-71-03 | LOW | FSRS stability not yet wired — all decay calculations use recency fallback. `generateActionSuggestions` supports `fsrsStability` Map but it is never populated. | E59 (FSRS integration epic) |

---

## Gate-Ready Summary

```yaml
epic: E71
verdict: PASS
overall_risk: LOW
fixable_issues:
  - id: NFR-71-01
    severity: low
    file: src/app/components/knowledge/SuggestedActionsPanel.tsx
    line: 88
    description: Add aria-expanded to show-more button
  - id: NFR-71-02
    severity: low
    file: src/stores/useKnowledgeMapStore.ts
    line: 415
    description: Reset suggestions to empty array in invalidateCache()
architectural_deferrals:
  - ARCH-71-01: Lesson title approximation (deferred E56-S04)
  - ARCH-71-02: Trend derivation time-only proxy (deferred post-E56)
  - ARCH-71-03: FSRS not yet wired (deferred E59)
release_recommendation: SHIP — fixable issues are low severity, no functional blockers
```

---

## Next Recommended Workflow

- Apply NFR-71-01 and NFR-71-02 as a chore commit (both are low severity, non-blocking).
- ARCH-71-01 is already tracked via TODO in `useKnowledgeMapStore.ts`; no additional action needed.
- No burn-in required — `generateActionSuggestions` is deterministic and synchronous.
