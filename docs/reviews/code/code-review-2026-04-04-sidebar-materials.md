# Code Review: Resource Ordering, Sidebar UX, and Scoped Materials Tab

**Reviewer**: Code Review Agent (Opus 4.6)
**Date**: 2026-04-04
**Scope**: ~596 lines across 8 files (uncommitted changes on main)

---

## What Works Well

1. **Clean domain modeling in lessonMaterialMatcher.ts.** The 5-tier matching algorithm is well-structured, pure-functional, and thoroughly tested (25 unit tests covering each tier, edge cases, and helpers). The space-optimized LCS is a nice touch for a utility that could run on large course libraries.

2. **Proper async cleanup patterns.** Both `LessonsTab` and `MaterialsTab` use the `let ignore = false` / cleanup pattern correctly to prevent state updates on unmounted components. `Promise.all` for parallel data loading in `MaterialsTab` is a good performance choice.

3. **Good separation of concerns.** The matcher logic is pure and extracted to its own module. The `MaterialGroup` type is cleanly re-exported through `courseAdapter.ts`. The `MaterialGroupRow` wrapper component in `LessonsTab` is a sensible abstraction.

---

## Findings

### Blockers

- **[Correctness] `src/app/components/course/tabs/LessonsTab.tsx:316` (confidence: 95)**: `useMemo` called after conditional early returns at lines 299 and 309 violates React's Rules of Hooks. When `isLoading` is `true`, the component returns at line 299 and the `useMemo(groupIndexMap)` at line 316 is never called. On the next render when `isLoading` becomes `false`, React sees an additional hook that wasn't called in the previous render, causing unpredictable behavior or a crash.

  **Why**: React hooks must be called in the same order on every render. This can cause runtime errors ("Rendered more hooks than during the previous render") or silent state corruption depending on React's reconciliation.

  **Fix**: Move the `useMemo` at line 316 above the early returns (after line 297, before line 299). The hook will compute an empty Map when `videoGroups` is empty, which is harmless. Estimated effort: ~2 minutes.

### High Priority

- **[Recurring] [Accessibility] `src/app/components/course/tabs/LessonsTab.tsx:150-162` (confidence: 85)**: The interactive PDF badge button has a touch target of approximately 24x16px (`p-1 -m-1` around an `h-4` badge). This is well below the WCAG 2.1 AA minimum of 44x44px for touch targets. Pattern recurring since E02-S07.

  **Why**: On mobile devices, users will struggle to tap the small badge to switch to materials. The `-m-1` trick extends the hit area slightly but still falls far short.

  **Fix**: Increase the button's minimum touch area. Replace `className="p-1 -m-1 rounded-sm"` with `className="p-1.5 -m-1.5 rounded-sm min-h-[44px] min-w-[44px] flex items-center justify-center"`. Alternatively, use a larger invisible hit area via `::before` pseudo-element. Effort: ~5 minutes.

### Medium

- **[Recurring] [Maintainability] `src/app/components/course/tabs/MaterialsTab.tsx:201,280` (confidence: 80)**: String interpolation for `className` instead of using `cn()`. The `ChevronRight` icon in both `PdfSection` and `StandalonePdfsSection` uses template literals for conditional rotate class. This is a recurring pattern across the codebase (tracked since E01-S03).

  **Affects**: `MaterialsTab.tsx` lines 201 and 280.

  **Fix**: Replace `` className={`size-4 ... ${isOpen ? 'rotate-90' : ''}`} `` with `className={cn('size-4 ...', isOpen && 'rotate-90')}`. Both components already have `cn()` available in their file. Effort: ~2 minutes.

- **[Correctness] `src/lib/courseAdapter.ts:135-141` (confidence: 72)**: `LocalCourseAdapter.cachedGroups` is an instance-level cache, but the adapter is re-created on every `useLiveQuery` result from `useCourseAdapter`. The cache effectively never persists across Dexie changes (which is when you'd want fresh data anyway), so it only helps if `getGroupedLessons()` is called multiple times within a single render cycle. Both `LessonsTab` and `MaterialsTab` call it independently via their own `useEffect`, which runs on different microtask ticks -- so the cache does serve a purpose within a single adapter lifecycle.

  **Why**: Not a bug, but the caching intent may be misleading. A reader might assume the cache persists longer than it does.

  **Fix**: Add a brief comment: `// Cache lives only for this adapter instance; adapter is re-created on Dexie changes`. Effort: ~1 minute.

### Nits

- **Nit** `src/app/components/course/BelowVideoTabs.tsx:53` (confidence: 65): The `eslint-disable-next-line react-hooks/exhaustive-deps` comment suppresses the warning for `[focusTab, focusTabKey]` but `focusTabKey` is the intentional trigger. The suppress is technically unnecessary -- the exhaustive-deps rule should be satisfied with both deps listed. If it was added to suppress a stale `focusTab` warning, that suggests the actual dependency might need review.

---

## Recommendations

1. **Fix the hooks ordering violation in LessonsTab.tsx first** -- this is a correctness bug that can crash the app.
2. **Increase the materials badge touch target** -- straightforward accessibility fix.
3. **Swap template literals to cn()** -- low effort, reduces recurring tech debt.
4. **Add cache comment in courseAdapter.ts** -- optional, for maintainability.

---

Issues found: **4** | Blockers: **1** | High: **1** | Medium: **2** | Nits: **1**
Confidence: avg **83** | >= 90: **1** | 70-89: **3** | < 70: **1**
