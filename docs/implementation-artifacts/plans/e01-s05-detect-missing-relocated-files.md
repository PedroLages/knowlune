# E01-S05: Detect Missing or Relocated Files

## Context

When users import course folders via the File System Access API, `FileSystemFileHandle` objects are persisted in IndexedDB. These handles can become invalid if the user moves, renames, or deletes files outside the app. Currently, the app silently fails when trying to access invalid handles (only caught at video playback time in `useVideoFromHandle.ts`). This story adds proactive detection on course load with visual feedback.

## Key Design Decision: Ephemeral File Status (No Schema Migration)

File status is **inherently transient** — a file could be moved between any two sessions. Persisting `fileStatus` in Dexie would create stale data. Instead, verify handles in-memory when the course detail page loads. This means:
- No Dexie schema v13 migration needed
- No type changes to `ImportedVideo` / `ImportedPdf`
- Status lives in component/hook state, recomputed each course load
- Simpler implementation, zero migration risk

## Implementation Tasks

### Task 1: Create `verifyFileHandle` utility (~20 lines)
**File:** `src/lib/fileVerification.ts` (new)

```typescript
export type FileStatus = 'checking' | 'available' | 'missing' | 'permission-denied'

export async function verifyFileHandle(handle: FileSystemFileHandle): Promise<FileStatus> {
  try {
    const permission = await handle.queryPermission({ mode: 'read' })
    if (permission === 'granted') {
      await handle.getFile() // throws if file moved/deleted
      return 'available'
    }
    return 'permission-denied'
  } catch {
    return 'missing'
  }
}
```

Pattern extracted from: `src/hooks/useVideoFromHandle.ts:17-33`

### Task 2: Create `useFileStatusVerification` hook (~50 lines)
**File:** `src/hooks/useFileStatusVerification.ts` (new)

Accepts arrays of `ImportedVideo[]` and `ImportedPdf[]`, returns a `Map<string, FileStatus>` keyed by item ID.

- Runs verification for all items concurrently via `Promise.allSettled`
- Uses `ignore` flag pattern (from `ImportedCourseDetail.tsx:25`)
- Non-blocking: returns `'checking'` initially, updates as results arrive
- Fires a single aggregated toast when missing files are detected (not per-file)
- Toast uses `toast.warning()` from Sonner with count and filenames

### Task 3: Update `ImportedCourseDetail.tsx` (~40 lines changed)
**File:** `src/app/pages/ImportedCourseDetail.tsx`

Changes:
1. Import and call `useFileStatusVerification(videos, pdfs)`
2. Add `data-testid` attributes with item IDs: `course-content-item-video-{id}`, `file-status-{id}`, `file-not-found-badge-{id}`
3. For each content item, conditionally render:
   - **Available**: Current behavior (clickable Link, brand icon)
   - **Missing**: Render as `div` (not Link), add `<Badge variant="destructive">File not found</Badge>`, reduced opacity, `cursor-not-allowed`, `aria-disabled="true"`
   - **Permission-denied**: Render as `div`, add warning badge, reduced opacity
   - **Checking**: Show subtle loading indicator (optional, verification is fast for local handles)

Layout: Badge renders inline after filename, before duration/metadata:
```
[VideoIcon] lesson-1.mp4 ............ [File not found] 5:30
```

Components to use:
- `Badge` from `src/app/components/ui/badge.tsx` (`destructive` variant)
- `AlertTriangle` from lucide-react
- `toast.warning()` from `src/lib/toastHelpers.ts`

### Task 4: Update ATDD tests for real implementation
**File:** `tests/e2e/story-e01-s05.spec.ts`

The ATDD tests reference test IDs that need to match implementation. May need minor adjustments once the actual data-testid patterns are finalized. Since FileSystemHandle is browser-only, E2E tests will verify:
- Course loads without crashing when handles are null/undefined
- Badge visibility and text content
- Toast appearance
- Navigation to available items still works

**Note:** FileSystemHandle cannot be mocked in Playwright — seeded test data won't have real handles. The verification hook should treat `null`/`undefined` handles as `'missing'`, which naturally creates the test scenario.

## Files to Create
| File | Purpose |
|------|---------|
| `src/lib/fileVerification.ts` | `verifyFileHandle()` utility |
| `src/hooks/useFileStatusVerification.ts` | Hook for batch verification + toast |

## Files to Modify
| File | Changes |
|------|---------|
| `src/app/pages/ImportedCourseDetail.tsx` | Add hook call, conditional rendering, badges, test IDs |
| `tests/e2e/story-e01-s05.spec.ts` | Adjust test IDs if needed after implementation |

## Files to Reuse (No Changes)
| File | What to reuse |
|------|---------------|
| `src/hooks/useVideoFromHandle.ts` | Reference pattern for handle verification |
| `src/app/components/ui/badge.tsx` | `Badge` component with `destructive` variant |
| `src/lib/toastHelpers.ts` / `toastConfig.ts` | Toast helpers and duration constants |
| `src/styles/theme.css` | `--destructive`, `--warning` design tokens |

## Verification

1. `npm run build` — no TypeScript or build errors
2. `npm run lint` — no ESLint violations (design tokens, not hardcoded colors)
3. `npx playwright test tests/e2e/story-e01-s05.spec.ts --project=chromium` — ATDD tests pass
4. Manual test: Import a course, move a file outside the app, reload course detail — badge appears
5. Manual test: Restore the file, reload — badge disappears

## Commit Strategy
- Commit after each task as a save point
- Final commit includes all passing tests
