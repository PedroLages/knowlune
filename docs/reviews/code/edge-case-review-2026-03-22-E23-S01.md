## Edge Case Review — E23-S01 (2026-03-22)

### Unhandled Edge Cases

---

**Courses.tsx:209-212** — `Header subtitle says "0 courses" when both stores empty but before empty state branch`
> Consequence: The subtitle is gated by `allCourses.length + importedCourses.length > 0`, so it correctly hides when both are zero. However, the text always says `N courses` (plural). When the total is exactly 1, it reads "1 courses" which is grammatically incorrect.
> Guard: `${total} ${total === 1 ? 'course' : 'courses'}`

---

**Courses.tsx:134** — `loadCourseMetrics useEffect depends on [allCourses] but iterates importedCourses (line 104)`
> Consequence: When `importedCourses` changes (e.g., a new course is imported) but `allCourses` remains the same, the effect does not re-run. Momentum scores for newly imported courses are never calculated until the next `allCourses` change or page remount.
> Guard: Add `importedCourses` to the dependency array: `}, [allCourses, importedCourses])`

---

**Courses.tsx:196-202** — `handleImportCourse callable while isImporting is true (button disabled, but function unguarded)`
> Consequence: The button is disabled via `disabled={isImporting}`, but `handleImportCourse` itself has no early-return guard. If called programmatically (e.g., from the EmptyState action button which does not check `isImporting`, line 241) or via keyboard event bubbling, a concurrent import could start. The EmptyState `onAction` passes `handleImportCourse` directly with no `disabled` prop.
> Guard: Add an early return at the top of `handleImportCourse`: `if (useCourseImportStore.getState().isImporting) return`

---

**Courses.tsx:235-243** — `Empty state renders when allCourses.length === 0 && importedCourses.length === 0, but importedCourses is still loading`
> Consequence: On initial mount, `importedCourses` defaults to `[]` in Zustand before `loadImportedCourses()` (async, line 53) resolves. For a brief moment, both arrays are empty, causing the empty state to flash before imported courses load. This is a race between the synchronous initial render and the async IDB read.
> Guard: Track a `isLoaded` flag in `useCourseImportStore` (similar to `useCourseStore.isLoaded`) and show a loading skeleton instead of the empty state while `!isLoaded`. Alternatively, check `isImporting` or add a dedicated loading state.

---

**Courses.tsx:284** — `Imported Courses section header shown when search is empty even if no imported courses exist`
> Consequence: The condition `importedCourses.length > 0 || !searchQuery.trim()` means the "Imported Courses" heading and its empty-state CTA are always visible when the search box is empty, even when `allCourses` has courses but no imported courses exist. This is intentional for discoverability (the inline CTA says "Import a course"), but the heading "Imported Courses" with "No imported courses yet" is shown alongside the catalog courses section, which could be confusing.
> Guard: No code fix needed — this is a design decision. Flagging for design review awareness.

---

**story-23-1.spec.ts:45-62** — `addInitScript IDB interception persists for entire browser context lifetime`
> Consequence: `page.addInitScript()` injects a script that runs on every subsequent navigation in that page/context. The override of `IDBObjectStore.prototype.add` permanently intercepts all `add()` calls on the `courses` store for the remainder of the test. If additional test steps were added after line 64 that navigate to other pages needing IDB `courses.add()`, those would silently fail. Within the current test this is fine (test ends right after the assertion), but extending this test would be fragile.
> Guard: The interception should be scoped: either (a) use a flag variable that the test can toggle off, e.g., `window.__blockCoursesSeed = true` checked inside the override, or (b) save and restore the original `IDBObjectStore.prototype.add` after the assertion via `page.evaluate`. This also prevents leakage if the test framework reuses the page in a `test.describe` block.

---

**story-23-1.spec.ts:48-58** — `Fake IDBRequest returned by the IDB interception is incomplete`
> Consequence: The mock `IDBRequest` object lacks `transaction`, `source`, `addEventListener`, `removeEventListener`, and `dispatchEvent` properties. If Dexie's internal code accesses any of these (e.g., `req.transaction` for error handling, or uses `addEventListener` instead of `onsuccess`), the interception would throw a TypeError at runtime. The test currently passes, suggesting Dexie uses `onsuccess`, but a Dexie upgrade could break this.
> Guard: Return a more complete mock, or better yet, intercept at a higher level (e.g., override `Dexie.prototype.open` or use the existing `indexedDB` fixture's `clearStore` with a navigation-based approach that avoids monkey-patching IDB internals).

---

**Courses.tsx:192-194** — `sortedImportedCourses sorts by importedAt but invalid dates produce NaN`
> Consequence: If an `ImportedCourse` has a malformed or empty `importedAt` string, `new Date(b.importedAt).getTime()` returns `NaN`. Sorting with `NaN` produces unpredictable ordering (NaN comparisons always return false).
> Guard: `(a, b) => (new Date(b.importedAt).getTime() || 0) - (new Date(a.importedAt).getTime() || 0)`

---

**Courses.tsx:37 + useCourseStore.ts:11-26** — `allCourses is never undefined/null — always initialized as []`
> Consequence: No issue. Zustand initializes `courses: []` and `loadCourses` catches errors. The component safely receives an empty array. This edge case is already handled.
> Guard: None needed.

---

**useCourseImportStore.ts:194-205** — `loadImportedCourses failure sets importError but importedCourses stays as previous value`
> Consequence: If `loadImportedCourses` throws (e.g., IDB corruption), the store sets `importError` but does not reset `importedCourses` to `[]`. If there were stale courses in state from a previous successful load, they would remain visible even though the DB read failed. On first mount this is benign (starts as `[]`), but on a re-load call it could show stale data.
> Guard: Set `importedCourses: []` in the catch block, or at minimum log the inconsistency: `set({ importedCourses: [], importError: 'Failed to load courses from database' })`

---

**Courses.tsx:169** — `getAllTags() called on every render without memoization`
> Consequence: `getAllTags()` iterates all imported courses and builds a sorted tag array on every render cycle. With a small number of courses this is negligible, but it creates a new array reference each time, which could cause unnecessary re-renders in child components (`TopicFilter`) that use reference equality.
> Guard: Wrap in `useMemo`: `const allTags = useMemo(() => getAllTags(), [importedCourses])`

---

**HybridCourses.tsx:42** — `Hardcoded "text-neutral-500" violates design token rule`
> Consequence: The prototype file uses `text-neutral-500` (line 42) and other hardcoded colors (`bg-white`, `border-neutral-100`, `text-neutral-400`). This should be caught by the ESLint `design-tokens/no-hardcoded-colors` rule. Since this is a prototype file it may be excluded from linting, but if not, it would fail the lint gate.
> Guard: Replace with design tokens (`text-muted-foreground`, `bg-card`, `border-border`) or ensure the prototype directory is excluded from the ESLint rule.

---

**Total:** 11 edge cases analyzed, **8 unhandled edge cases found** (excluding the 1 already-handled case, 1 design-decision flag, and 1 lint-only issue).

### Priority Summary

| Severity | Count | Items |
|----------|-------|-------|
| Medium   | 3     | Missing `importedCourses` dependency, empty-state flash during loading, stale data on reload failure |
| Low      | 3     | Singular/plural subtitle, `handleImportCourse` guard, `getAllTags` memoization |
| Test-only | 2    | IDB interception leak risk, incomplete mock IDBRequest |
