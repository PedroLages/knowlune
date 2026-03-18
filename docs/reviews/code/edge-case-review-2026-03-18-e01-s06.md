## Edge Case Review — E01-S06 (2026-03-18)

### Unhandled Edge Cases

**[ImportedCourseCard.tsx:182-190]** — `Double-click on Delete confirm button`
> Consequence: `handleDelete()` fires twice. The first call optimistically removes the course from Zustand state (line 71-74 of store). The second call finds no `courseToRemove` (line 68 returns `undefined`) and still executes the Dexie transaction (deleting already-deleted records — a no-op), but two "Course removed" toasts appear. In the error path, the rollback guard (`if (courseToRemove)`) silently skips, so a failed second call does not rollback but also does not set `importError`, masking the failure.
> Guard: `Add an `isDeleting` state flag. Disable `AlertDialogAction` while pending, or early-return in `handleDelete` if already in-flight.`
> ```tsx
> const [isDeleting, setIsDeleting] = useState(false)
>
> async function handleDelete() {
>   if (isDeleting) return
>   setIsDeleting(true)
>   try {
>     await removeImportedCourse(course.id)
>     // ... existing error check
>   } finally {
>     setIsDeleting(false)
>   }
> }
> ```

**[ImportedCourseCard.tsx:182-190]** — `Component unmounts while handleDelete is awaiting removeImportedCourse`
> Consequence: After the optimistic update removes the course from Zustand, React unmounts the `ImportedCourseCard` (the course disappears from the list). The `await` in `handleDelete` resumes on an unmounted component. Calling `useCourseImportStore.getState()` on line 184 is safe (Zustand is external), but the `toast.success()` / `toast.error()` calls and `setIsDeleting(false)` (if the guard above is added) would trigger React state updates on an unmounted component. React 19 suppresses the warning, but the toast may still fire unexpectedly after navigation.
> Guard: `Use an AbortController ref or check a mounted ref before calling toast. Alternatively, move the toast logic into the store itself so the component is not responsible for post-delete side effects.`
> ```tsx
> const mountedRef = useRef(true)
> useEffect(() => () => { mountedRef.current = false }, [])
>
> async function handleDelete() {
>   await removeImportedCourse(course.id)
>   if (!mountedRef.current) return
>   // ... toast logic
> }
> ```

**[ImportedCourseCard.tsx:184-185]** — `importError already set from a previous failed operation (e.g., failed tag update or status change)`
> Consequence: The store's `removeImportedCourse` clears `importError` to `null` at line 73 before the Dexie transaction. However, the check at line 184 (`useCourseImportStore.getState().importError`) reads state after the `await`. If another concurrent store operation (tag update, status change on a *different* card) sets `importError` between the optimistic update and the `getState()` call, `handleDelete` would incorrectly show "Failed to remove course" even though the delete succeeded. This is a TOCTOU race on shared `importError` state.
> Guard: `Have removeImportedCourse return a success/failure result directly instead of relying on shared mutable state. Alternatively, use a per-operation error key (e.g., deleteError) to avoid cross-contamination.`
> ```ts
> // In store: return { success: boolean } from removeImportedCourse
> // In component: const result = await removeImportedCourse(course.id)
> ```

**[ImportedCourseCard.tsx:411-437]** — `AlertDialog references course.name after optimistic delete`
> Consequence: The `AlertDialogAction` `onClick` calls `handleDelete()`, which triggers the optimistic update. The optimistic update removes the course from `importedCourses` in Zustand. Because the parent component (likely a `.map()` over `importedCourses`) would unmount this card, the dialog content referencing `course.name` in the title (`Delete "{course.name}"?`) could briefly render with stale props during the unmount transition. In practice, Radix AlertDialog's exit animation may show the stale content, which is cosmetically acceptable but technically a stale closure.
> Guard: `This is low severity. No guard needed unless the dialog has an exit animation that makes the stale name visually jarring. If so, capture the course name in local state when the dialog opens.`

**[ImportedCourseCard.tsx:295-304]** — `Dropdown menu onClick does not call e.stopPropagation()`
> Consequence: The existing status menu items use `e.stopPropagation()` (documented at line 236, 251 of the original file). The new "Delete course" `DropdownMenuItem` at line 298 uses `onClick={() => setDeleteDialogOpen(true)}` without `stopPropagation`. If the card's parent has a click handler (e.g., for navigation), clicking "Delete course" could simultaneously trigger card navigation. Reviewing the card structure: the card uses `onClick` for navigation on the card body. Radix `DropdownMenuItem` click events may or may not bubble depending on the portal setup. Since the dropdown content is portaled, this is likely safe, but inconsistent with the established pattern.
> Guard: `Add stopPropagation for consistency with sibling menu items.`
> ```tsx
> onClick={(e) => {
>   e.stopPropagation()
>   setDeleteDialogOpen(true)
> }}
> ```

**[useCourseImportStore.ts:66-98]** — `Concurrent delete of the same course (two browser tabs, or rapid UI interaction before optimistic update re-renders)`
> Consequence: Two calls to `removeImportedCourse(sameId)` execute concurrently. Both read `courseToRemove` from the same snapshot (line 67-68). Both optimistically filter the course out (line 71-73) — the second filter is a no-op since it's already gone. Both then execute the Dexie transaction — the second transaction deletes zero records (already deleted). Both succeed, both show "Course removed" toast. If one fails, its rollback re-adds the course to state, but the other call already completed successfully and deleted from Dexie — the UI shows a "ghost" course that no longer exists in the database.
> Guard: `Add a Set<string> of in-flight deletion IDs to the store. Skip if courseId is already being deleted.`
> ```ts
> // In store state: deletingIds: Set<string>
> removeImportedCourse: async (courseId) => {
>   if (get().deletingIds.has(courseId)) return
>   set(state => ({ deletingIds: new Set([...state.deletingIds, courseId]) }))
>   // ... existing logic ...
>   // finally: remove from deletingIds
> }
> ```

---
**Total:** 6 unhandled edge cases found.

| # | Severity | Edge Case | Location |
|---|----------|-----------|----------|
| 1 | HIGH | Double-click fires handleDelete twice | ImportedCourseCard.tsx:182 |
| 2 | MEDIUM | Component unmounts mid-delete, toast fires on unmounted component | ImportedCourseCard.tsx:182 |
| 3 | MEDIUM | Shared importError TOCTOU race with concurrent store operations | ImportedCourseCard.tsx:184 |
| 4 | LOW | Stale course.name in dialog during exit animation | ImportedCourseCard.tsx:411 |
| 5 | LOW | Missing stopPropagation on delete menu item (inconsistent pattern) | ImportedCourseCard.tsx:298 |
| 6 | MEDIUM | Concurrent deletion of same course causes ghost rollback | useCourseImportStore.ts:66 |
