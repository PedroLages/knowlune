# E01-S06: Delete Imported Course — Implementation Plan

## Context

Epic 1 has 5 completed stories (1.1–1.5) building course import, library display, tagging, status management, and file detection. Story 1.6 adds the ability to **permanently remove** an imported course — the final CRUD operation for course management. The store method `removeImportedCourse` already exists with optimistic update + rollback; this story is purely UI integration.

## Files to Modify

| File | Change |
|------|--------|
| `src/app/components/figma/ImportedCourseCard.tsx` | Add delete dropdown item + AlertDialog confirmation |
| `tests/e2e/e01-s06-delete-imported-course.spec.ts` | Already created (ATDD) — may need selector tweaks during implementation |

## Task 1: Add Delete Action to ImportedCourseCard

### 1.1 New imports (top of file)

```typescript
import { Trash2 } from 'lucide-react'           // add to existing lucide import
import { DropdownMenuSeparator } from '...'       // add to existing dropdown import
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
```

### 1.2 New state and store subscription (inside component, ~line 68)

```typescript
const removeImportedCourse = useCourseImportStore(state => state.removeImportedCourse)
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
```

### 1.3 Delete handler

```typescript
async function handleDelete() {
  await removeImportedCourse(course.id)
  const { importError } = useCourseImportStore.getState()
  if (importError) {
    toast.error('Failed to remove course')
  } else {
    toast.success('Course removed')
  }
}
```

### 1.4 Dropdown menu addition (after line 272, inside `DropdownMenuContent`)

Add `DropdownMenuSeparator` + destructive `DropdownMenuItem` with `Trash2` icon after the status items map. The menu item opens the dialog via `setDeleteDialogOpen(true)`.

Key attributes:
- `data-testid="delete-course-menu-item"`
- `className="text-destructive focus:text-destructive gap-2"`

### 1.5 AlertDialog (render as sibling after `</article>`, before ThumbnailPickerDialog)

Controlled via `open={deleteDialogOpen}` / `onOpenChange={setDeleteDialogOpen}` (no Trigger component).

Key attributes:
- `data-testid="delete-confirm-dialog"` on AlertDialogContent
- `data-testid="delete-confirm-button"` on AlertDialogAction
- AlertDialogAction styled: `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"`
- AlertDialogTitle: `Delete "{course.name}"?`
- AlertDialogDescription: warns about permanent removal

## Task 2: Verify E2E Tests

The ATDD test file is already created at `tests/e2e/e01-s06-delete-imported-course.spec.ts` with tests for AC1–AC4. After Task 1 implementation:

1. Run the tests: `npx playwright test tests/e2e/e01-s06-delete-imported-course.spec.ts --project=chromium`
2. Fix any selector mismatches (e.g., locator strategy for finding the course card and its dropdown trigger)
3. AC5 (error rollback) is intentionally not E2E tested — verify manually if desired

## Key Patterns to Reuse

| Pattern | Source |
|---------|--------|
| `removeImportedCourse(courseId)` | `src/stores/useCourseImportStore.ts:66-98` — optimistic delete + 3-table Dexie transaction + rollback |
| `useCourseImportStore.getState().importError` | Check after await to determine success/failure |
| `toast.success()` / `toast.error()` | Sonner — already used throughout codebase |
| `e.stopPropagation()` | Existing pattern in dropdown (line 236, 251) — prevents card navigation |
| AlertDialog controlled mode | Use `open` + `onOpenChange` props (no AlertDialogTrigger) |

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations (design tokens, no hardcoded colors)
3. `npx playwright test tests/e2e/e01-s06-delete-imported-course.spec.ts --project=chromium` — AC1–AC4 pass
4. Manual check: open Courses page → import a course → open status dropdown → click "Delete course" → confirm → course disappears + toast shown
5. Manual check: repeat but click Cancel → course remains

## Commits

1. After Task 1: `feat(E01-S06): add delete course action with confirmation dialog`
2. After Task 2 (if test fixes needed): `test(E01-S06): fix E2E selectors for delete course flow`
