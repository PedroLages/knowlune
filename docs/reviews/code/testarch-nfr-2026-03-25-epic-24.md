# Non-Functional Requirements Assessment: Epic 24

**Epic:** Course Import Wizard & Editing
**Date:** 2026-03-25
**Assessor:** Claude Opus 4.6 (testarch-nfr)
**Overall Assessment:** PASS

## Scope

Epic 24 added 6 stories across 19 source files (4,557+ lines added):

| Story | Feature | Key Files |
|-------|---------|-----------|
| E24-S01 | Scan/persist refactor | `courseImport.ts`, `scanAndPersist.test.ts` |
| E24-S02 | Import wizard dialog | `ImportWizardDialog.tsx` |
| E24-S03 | Tags, cover image, confirmation | `ImportWizardDialog.tsx`, `fileSystem.ts` |
| E24-S04 | AI metadata suggestions | `useAISuggestions.ts`, `courseTagger.ts` |
| E24-S05 | Post-import editing dialog | `EditCourseDialog.tsx`, `useCourseImportStore.ts` |
| E24-S06 | Video drag-and-drop reorder | `VideoReorderList.tsx` (@dnd-kit) |

---

## 1. Performance

**Verdict: PASS**

| Metric | Value | Status |
|--------|-------|--------|
| Build time | 13.24s | Acceptable (no regression) |
| @dnd-kit node_modules | 2.2 MB (disk) | Small; tree-shaken in production |
| Batch metadata extraction | 10 concurrent max | Bounded memory pressure |
| AI suggestion timeout | 10s hard limit | Prevents indefinite hangs |

**Strengths:**
- Metadata extraction uses batched `Promise.allSettled()` with `BATCH_SIZE = 10`, limiting concurrent file I/O and memory pressure during large course imports.
- AI suggestions fire in parallel (`Promise.all` for tags + description) with proper `AbortController` cancellation on component unmount.
- Object URLs for image previews are properly revoked in the cleanup function of the `useEffect` (line 142-144 of `ImportWizardDialog.tsx`).
- `MAX_FILE_NAMES = 50` in `courseTagger.ts` caps prompt size sent to Ollama.

**Minor concern:**
- Video reorder persists each video order update individually in a loop (`for (const video of reordered)`) inside a Dexie transaction. For courses with many videos (50+), a `bulkPut` would be more efficient. Low priority since typical courses have <30 videos.

---

## 2. Security

**Verdict: PASS**

| Vector | Mitigation | Status |
|--------|-----------|--------|
| XSS via user input | React JSX escaping (no `dangerouslySetInnerHTML`) | Safe |
| XSS via AI responses | Tags normalized (lowercase, trimmed), description rendered as text | Safe |
| Input length limits | EditCourseDialog: name 120, description 500, category 60, tag 40 | Present |
| Ollama SSRF | Routes through Express proxy unless direct connection enabled | Mitigated |
| Prompt injection | File names are sent as-is to Ollama; output is parsed/validated, not executed | Acceptable |

**Strengths:**
- All AI responses go through `parseTagResponse()` / `parseDescriptionResponse()` with multi-layer defensive parsing. Malformed output gracefully degrades to empty results.
- `normalizeTags()` in both `courseTagger.ts` and `useCourseImportStore.ts` sanitizes tags (trim, lowercase, deduplicate, limit to 5).
- `ImportError` class uses typed error codes (`NO_FILES`, `PERMISSION_DENIED`, `SCAN_ERROR`, `DUPLICATE`) rather than raw strings.

**Minor concern:**
- `ImportWizardDialog.tsx` does not enforce `maxLength` on the course name or description inputs (unlike `EditCourseDialog.tsx` which does). While not a security vulnerability (data goes to IndexedDB, not a server), adding consistent limits would be good hygiene.

---

## 3. Reliability

**Verdict: PASS**

| Pattern | Implementation | Status |
|---------|---------------|--------|
| Optimistic updates + rollback | All store mutations in `useCourseImportStore.ts` | Consistent |
| Deep clone for rollback | `structuredClone(course)` in `updateCourseDetails` | Correct |
| DnD rollback on persist failure | `VideoReorderList.tsx` line 172-173 | Present |
| Atomic DB transactions | `persistScannedCourse` uses Dexie transaction for course+videos+pdfs | Correct |
| `persistWithRetry` | Used in store mutations and video reorder | Resilient |
| Abort/cancellation | `useAISuggestions` uses `AbortController` + `cancelled` flag | Proper cleanup |
| Graceful degradation | AI unavailable = empty suggestions, no error | Correct |

**Strengths:**
- Every Zustand store mutation that touches IndexedDB follows the optimistic-update + rollback-on-failure pattern consistently.
- `scanCourseFolder()` properly resets store state in `finally` block regardless of success/failure.
- `handleDragEnd` in `VideoReorderList` shows error toast on persist failure and rolls back to pre-drag order.
- Duplicate import detection (`db.importedCourses.where('name').equals(...)`) prevents accidental re-imports.
- Partial metadata extraction failures are handled gracefully via `Promise.allSettled()` -- successful files are imported even if some fail.

**No concerns identified.**

---

## 4. Maintainability

**Verdict: PASS**

| Metric | Value | Status |
|--------|-------|--------|
| Unit test lines (Epic 24 only) | 1,711 | Strong coverage |
| Test files | 4 dedicated test suites | All passing |
| Component decomposition | Wizard, EditDialog, VideoReorderList | Well-separated |
| Shared patterns | `persistWithRetry`, optimistic rollback | DRY |
| Type safety | Full TypeScript, exported interfaces | Strict |

**Strengths:**
- Clean separation between scan phase (pure data extraction) and persist phase (IndexedDB writes) enables independent testing and wizard preview flow.
- `useAISuggestions` is a standalone hook, cleanly decoupled from the wizard UI.
- `VideoReorderList` is extracted as its own component with dedicated tests (249 lines), not inline in the dialog.
- Tag management logic (add, remove, normalize, deduplicate) is consistent between `ImportWizardDialog` and `EditCourseDialog`.

**Minor concern:**
- `EditCourseDialog.test.tsx` produces `act(...)` warnings (visible in test output). Not a test failure, but indicates an async state update that could cause flaky behavior in the future.
- `courseTagger.ts` exports `parseTagResponse` and `parseDescriptionResponse` but has no dedicated unit test file for these parsers. They are tested indirectly through the component tests, but direct parser tests would improve coverage confidence.

---

## 5. Accessibility

**Verdict: PASS**

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| ARIA labels | Drag handles, image radio group, tag remove buttons, step indicator | Present |
| Role attributes | `role="radiogroup"` for image selection, `role="listitem"` for DnD rows, `role="status"` for step indicator | Correct |
| aria-invalid | Course name input in both wizard and edit dialog | Present |
| aria-live | Validation errors (`role="alert"`), saving status (`aria-live="polite"`) | Present |
| Keyboard navigation | `KeyboardSensor` for @dnd-kit, Enter/Backspace for tags | Functional |
| aria-hidden | Decorative icons throughout | Consistent |
| Focus management | `autoFocus` on course name input in wizard details step | Present |

**Strengths:**
- Image selection uses `role="radiogroup"` with `role="radio"` and `aria-checked` on each image option -- proper accessible pattern for single-selection.
- @dnd-kit `KeyboardSensor` with `sortableKeyboardCoordinates` enables keyboard-based drag-and-drop.
- AI loading states use `role="status"` with `aria-live="polite"` for screen reader announcements.
- `PointerSensor` has `activationConstraint: { distance: 5 }` to prevent accidental drags on touch devices.

**No concerns identified.**

---

## Summary

| Category | Verdict | Key Finding |
|----------|---------|-------------|
| Performance | PASS | Batched extraction, bounded AI timeouts, proper URL cleanup |
| Security | PASS | No XSS vectors, AI output validated, SSRF mitigated via proxy |
| Reliability | PASS | Consistent optimistic update + rollback, atomic transactions, graceful AI degradation |
| Maintainability | PASS | 1,711 test lines, clean component decomposition, DRY patterns |
| Accessibility | PASS | ARIA roles/labels, keyboard DnD, live regions for status updates |

**Overall: PASS**

### Minor Recommendations (Non-blocking)

1. Add `maxLength` to `ImportWizardDialog` name/description inputs for consistency with `EditCourseDialog`.
2. Fix `act(...)` warnings in `EditCourseDialog.test.tsx` to prevent future flakiness.
3. Consider `bulkPut` instead of individual updates in `VideoReorderList` persist loop for large courses.
4. Add dedicated unit tests for `parseTagResponse()` and `parseDescriptionResponse()` in `courseTagger.ts`.
