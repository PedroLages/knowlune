# Test Coverage Review — E22-S05: Dynamic Filter Chips from AI Tags

**Date:** 2026-03-22
**Branch:** feature/e22-s05-dynamic-filter-chips-from-ai-tags
**Reviewer:** code-review-testing agent

---

## Summary

**AC Coverage: 4/5 (80%)** | Findings: 10 | Blockers: 1 | High: 3 | Medium: 3 | Nits: 3

---

## AC Coverage Table

| AC# | Description | Status | Test Location |
|-----|-------------|--------|---------------|
| AC1 | Chips include both pre-seeded categories AND imported AI tags | Covered | `filterChips.test.ts:36,42,74,80` + `Courses.test.tsx:325,330` |
| AC2 | Chips deduplicated and sorted by frequency | Partial | `filterChips.test.ts:22,28` (utility tested; pre-seeded vs AI ranking not tested) |
| AC3 | Chip filters BOTH imported and pre-seeded simultaneously | Partial | `Courses.test.tsx:364` (imported only; pre-seeded path not tested) |
| AC4 | "Clear filters" resets all filters | Covered | `Courses.test.tsx:335,347` |
| AC5 | New import tags appear without refresh | **GAP** | No test |

---

## Findings

### [Blocker] AC5 has zero test coverage — `Courses.test.tsx`
**Confidence: 92**

"New tags from async import appear in chips without page refresh" has no tests. The story's own testing notes flag this as required. The implementation depends on `useMemo([allCourses, importedCourses])` updating when Zustand store state changes — this reactivity is never exercised.

**Suggested test:**
```typescript
it('updates filter chips when importedCourses store changes (AC5)', async () => {
  renderCourses()
  expect(screen.queryByRole('radio', { name: 'Neuroscience' })).not.toBeInTheDocument()

  act(() => {
    storeState.importedCourses = [{
      ...baseImportedCourse,
      tags: ['neuroscience']
    }]
  })

  await waitFor(() => {
    expect(screen.getByRole('radio', { name: 'Neuroscience' })).toBeInTheDocument()
  })
})
```

---

### [High] AC3 never tests pre-seeded course filtering — `Courses.test.tsx:364-375`
**Confidence: 82**

The AC3 test only verifies imported course filtering. Pre-seeded courses are never mocked with matching categories/tags, so the `allCourses` filter path in `Courses.tsx:141-146` is never exercised in tests.

**Fix:** Add a test mocking `useCourseStore` with a course carrying `category: 'python'`, asserting it appears/disappears when the python chip is toggled.

---

### [High] "All Courses" chip default-active state not asserted — `Courses.test.tsx:325`
**Confidence: 78**

The test confirms the chip renders but never verifies it is selected by default (`data-state="on"`). AC1 explicitly states "All Courses chip is always present and **selected by default**".

**Fix:** Add: `expect(screen.getByRole('radio', { name: 'All Courses' })).toHaveAttribute('data-state', 'on')`

---

### [High] Frequency sort incomplete — chip ranking between pre-seeded and AI tags not tested — `filterChips.test.ts:28-33`
**Confidence: 75**

The sort test only verifies relative order of two AI tag chips. It does not test that pre-seeded category chips are correctly ranked against AI tag chips in a mixed list, nor is the `localeCompare` tie-breaking tested.

**Fix:** Add tests: `'ranks pre-seeded category chip above lower-frequency AI tag chip'` and `'breaks ties alphabetically'`

---

### [Medium] `db` mock incomplete — tests exercise degraded state silently — `Courses.test.tsx:97-98`
**Confidence: 68**

`renderCourses()` doesn't seed `useCourseStore` with pre-seeded courses. All unified filter chip tests only exercise the imported course path. The `db.studySessions` mock is missing, causing the metrics effect to fail silently.

---

### [Medium] "Clear filters" round-trip not fully validated — `Courses.test.tsx:335-345`
**Confidence: 62**

After clearing, the test doesn't verify the "All Courses" chip returns to `data-state="on"`, leaving single-selection round-trip behaviour unvalidated.

---

### [Medium] Chip count includes pre-seeded course `tags` — not tested end-to-end — `filterChips.ts:39`
**Confidence: 60**

The utility counts pre-seeded courses that have a matching tag (not just category) via `c.tags.some(...)`. No test seeds a pre-seeded course with a `tags` field matching an AI tag and verifies the combined count.

---

### [Nit] AI tag chip assertion uses case-insensitive regex, misses title-casing requirement
`Courses.test.tsx:330`: `getByRole('radio', { name: /python/i })` passes whether label is "python", "Python", or "PYTHON". AC1 requires title-cased display. Use exact match: `getByRole('radio', { name: 'Python' })`.

### [Nit] `coursesWithAiTags` fixture defined outside its `describe` block — `Courses.test.tsx:276-310`
Move inside the `unified filter chips` describe block for better locality.

### [Nit] Test data uses inline objects rather than factory pattern
Per project conventions, shared fixtures should use factories from `tests/support/fixtures/factories/`.

---

## Edge Cases Missing Tests

1. **Chip selected when all matching courses are removed** — orphaned `selectedFilter` with no active chip visible
2. **Case-normalisation pipeline end-to-end** — mixed-case tag stored, filtered correctly
3. **Empty state with zero courses** — ToggleGroup renders with only "All Courses" chip
4. **Pre-seeded + imported sharing same tag** — combined count verification

---

## Verdict

**BLOCKED by 1 missing AC test.** AC5 (reactive chip update after import) has zero coverage. Additionally, 3 High issues should be addressed to improve AC2/AC3 coverage quality.
