# Non-Functional Requirements Assessment: Epic 26

**Epic:** Multi-Path Learning Journeys
**Date:** 2026-03-26
**Assessor:** Claude Opus 4.6 (testarch-nfr)
**Overall Assessment:** PASS

## Scope

Epic 26 added 5 stories across 7 primary source files (3,033 lines):

| Story | Feature | Key Files |
|-------|---------|-----------|
| E26-S01 | Multi-path data model & migration | `schema.ts` (Dexie v24/v25), `types.ts` |
| E26-S02 | Learning path list view | `LearningPaths.tsx` (690 lines) |
| E26-S03 | Path detail view with drag-drop editor | `LearningPathDetail.tsx` (959 lines) |
| E26-S04 | AI path placement suggestion | `suggestPlacement.ts`, `usePathPlacementSuggestion.ts` |
| E26-S05 | Per-path progress tracking | `usePathProgress.ts` (369 lines) |

---

## 1. Performance

**Verdict: PASS**

| Metric | Value | Status |
|--------|-------|--------|
| Build time | No regression | Acceptable |
| @dnd-kit bundle | Already present (E24-S06) | No new dependency cost |
| AI suggestion timeout | 15s hard limit | Bounded |
| Batch data loading | `useMultiPathProgress` — single `Promise.all` | Efficient |

**Strengths:**
- `useMultiPathProgress` batch-loads all catalog courses, content progress, imported courses, and video progress in a single `Promise.all` call, then distributes per-path. This prevents N+1 queries when displaying multiple paths with progress bars.
- AI placement suggestion has a 15-second `AbortController` timeout plus external signal support, preventing indefinite hangs.
- `useMemo` is used for filtering paths by search term and for building the `pathEntries` map for progress hooks, avoiding unnecessary re-computation.
- Motion animations use `MotionConfig` with `staggerContainer`/`fadeUp` variants — consistent with existing animation patterns, no additional library cost.

**Minor concern:**
- `LearningPathDetail.tsx` at 959 lines is the largest single component in Epic 26. While it decomposes well internally (`SortableCourseRow`, `AddCourseDialog`, settings collapsible), the file could benefit from extracting sub-components. Not a performance issue, but affects developer velocity for future changes.

---

## 2. Security

**Verdict: PASS**

| Vector | Mitigation | Status |
|--------|-----------|--------|
| XSS via path names/descriptions | React JSX escaping (no `dangerouslySetInnerHTML`) | Safe |
| XSS via AI justification text | Rendered as text content, not HTML | Safe |
| Input length limits | Name: 100 chars, description: 500 chars in CreatePathDialog | Present |
| AI prompt injection | Course names sent as JSON; AI output parsed and validated | Acceptable |
| AI hallucinated path IDs | `pathExists` validation in `suggestPlacement.ts` lines 171-182 | Mitigated |

**Strengths:**
- AI placement response validation: if AI returns a `pathId` that doesn't exist in the provided paths, the function falls back to `{ pathId: null }` rather than trusting the hallucinated ID.
- JSON response parsing uses defensive `match` patterns for both bare JSON and markdown-wrapped code blocks, with `JSON.parse` on trimmed content.
- `position` output is clamped to `Math.max(1, ...)` preventing negative or zero positions.
- Path CRUD operations use `crypto.randomUUID()` for ID generation — no user-controlled IDs.

**No concerns identified.**

---

## 3. Reliability

**Verdict: PASS**

| Pattern | Implementation | Status |
|---------|---------------|--------|
| Error handling in store | `try/catch` with `toast.error()` in all CRUD operations | Consistent |
| AbortController for AI | `usePathPlacementSuggestion` cancels on unmount + external signal | Correct |
| Cancelled flag for async | `let cancelled = false` pattern in `usePathPlacementSuggestion` and `usePathProgress` | Present |
| Migration graceful degradation | `try/catch` in v24 upgrade — old table preserved on failure | Resilient |
| Dual progress source reconciliation | `Math.max(dexie, localStorage)` with `Math.min(result, total)` clamp | Correct |
| Event-driven reactivity | `PROGRESS_UPDATED_EVENT` + `storage` listeners with cleanup | Proper |

**Strengths:**
- `useLearningPathStore.loadPaths()` sets `error` state on failure, allowing the UI to display error states rather than silently failing with empty data.
- `CreatePathDialog` disables the submit button during submission (`isSubmitting` state) preventing duplicate path creation on double-click.
- Progress hooks properly clean up event listeners in `useEffect` return functions.
- `DndContext` in path detail uses `closestCenter` collision detection with `PointerSensor` (5px activation distance) and `KeyboardSensor` — prevents accidental drags.

**Minor concern:**
- `useLearningPathStore.createPath()` uses `new Date().toISOString()` for timestamps. In test contexts, this produces non-deterministic timestamps. However, the store is not directly unit-tested, so this does not currently cause flakiness.

---

## 4. Maintainability

**Verdict: PASS (advisory)**

| Metric | Value | Status |
|--------|-------|--------|
| Lines added (Epic 26) | ~3,033 | Moderate |
| Dedicated unit test files | 0 | Advisory |
| Dedicated E2E test files | 0 | Advisory |
| Component decomposition | 7 files, well-separated concerns | Good |
| Type safety | Full TypeScript with exported interfaces | Strict |
| Store patterns | Zustand with Dexie persistence (consistent with project) | Conventional |

**Strengths:**
- Clean separation between data model (S01), list view (S02), detail view (S03), AI integration (S04), and progress tracking (S05) — each story is independently understandable.
- `usePathProgress` and `useMultiPathProgress` are extracted as custom hooks in `src/app/hooks/`, not inline in page components. This enables future reuse and testing.
- AI modules follow the established project pattern: pure function (`suggestPlacement.ts`), React hook wrapper (`usePathPlacementSuggestion.ts`), window mock support for testing.
- The deprecated `LearningPathCourse` interface is properly marked with `@deprecated` JSDoc tag pointing to the replacement types.

**Advisory:**
- Zero automated test files for 3,033 lines of new code is the largest untested feature delivery since Epic 22 (Ollama Integration, which also shipped without E2E tests). The store, hooks, and AI modules are all testable — the test files simply were not created during the epic. This should be addressed before the next epic that modifies learning path functionality.

---

## 5. Accessibility

**Verdict: PASS**

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| ARIA labels | Drag handles: `aria-label="Drag to reorder {courseName}"` | Present |
| Keyboard DnD | `KeyboardSensor` with `sortableKeyboardCoordinates` | Functional |
| Move up/down buttons | Alternative to drag for keyboard/screen reader users | Present |
| aria-hidden on decorative icons | `aria-hidden="true"` on all lucide icons | Consistent |
| Dialog accessibility | Radix `Dialog`/`AlertDialog` primitives with proper title/description | Correct |
| Focus management | `autoFocus` on path name input in create dialog | Present |
| Touch targets | Drag handle `p-1.5`, move buttons `p-1.5`, remove button accessible | Adequate |

**Strengths:**
- The path detail view provides three interaction modes for reordering: drag-and-drop (pointer), keyboard DnD (`KeyboardSensor`), and explicit move up/down buttons. This exceeds WCAG 2.1 AA requirements for operable alternatives.
- Position badges use `bg-brand-soft` with `text-brand-soft-foreground` — correct contrast tokens per project design system.
- `EmptyState` component on the list view follows the shared pattern from E25-S09 with consistent icon, title, description, and CTA structure.

**Minor concern:**
- The AI suggestion card in the path detail view (S04) does not appear to have `aria-live="polite"` for announcing when the suggestion appears. The story file specifies this in the design guidance, but the implementation should be verified.

---

## Summary

| Category | Verdict | Key Finding |
|----------|---------|-------------|
| Performance | PASS | Batch data loading, bounded AI timeouts, efficient memo patterns |
| Security | PASS | AI hallucination guard, input validation, no XSS vectors |
| Reliability | PASS | Consistent error handling, proper cleanup, graceful degradation |
| Maintainability | PASS (advisory) | Clean architecture but zero automated tests for 3,033 lines |
| Accessibility | PASS | Three reorder modes (drag, keyboard, buttons), proper ARIA |

**Overall: PASS**

### Recommendations (Non-blocking)

1. **HIGH:** Add E2E test coverage for path CRUD and drag-drop reorder (zero regression protection currently).
2. **MEDIUM:** Add unit tests for `usePathProgress` hook — the dual-source reconciliation logic is complex enough to warrant direct testing.
3. **LOW:** Extract `SortableCourseRow` and `AddCourseDialog` from `LearningPathDetail.tsx` into separate files to improve maintainability.
4. **LOW:** Verify `aria-live="polite"` on AI suggestion card appearance in path detail view.
