# Story 83.7: Storage Indicator

Status: ready-for-dev

## Story

As a learner,
I want to see how much storage my book library is using,
so that I know when I am approaching browser storage limits and can manage my library accordingly.

## Acceptance Criteria

1. **Given** the user is on the Library page with one or more books **When** the page loads **Then** a StorageIndicator appears at the bottom showing: book count, storage used (formatted), storage available (formatted), and a progress bar

2. **Given** the storage indicator **When** storage is below 80% **Then** the progress bar fill is `bg-brand`

3. **Given** the storage indicator **When** storage is between 80-95% **Then** the progress bar fill is `bg-warning`

4. **Given** the storage indicator **When** storage exceeds 95% **Then** the progress bar fill is `bg-destructive`

5. **Given** the storage indicator **When** storage exceeds 90% **Then** a warning message suggests removing unused books

6. **Given** storage data **When** retrieved **Then** it comes from `navigator.storage.estimate()` via `OpfsStorageService.getStorageEstimate()`

## Tasks / Subtasks

- [ ] Task 1: Create `StorageIndicator` component (AC: 1, 2, 3, 4, 5)
  - [ ] 1.1 Create `src/app/components/library/StorageIndicator.tsx`
  - [ ] 1.2 Layout: `flex items-center gap-3 p-4 rounded-xl bg-surface-sunken/30 border border-border/50`
  - [ ] 1.3 Icon: `HardDrive` from lucide-react, `size-4 text-muted-foreground`
  - [ ] 1.4 Text: "{count} books · {used} used · {available} available" in `text-xs text-muted-foreground`
  - [ ] 1.5 Progress bar: `h-1.5 rounded-full bg-muted` with dynamic fill color:
    - `<80%`: `bg-brand`
    - `80-95%`: `bg-warning`
    - `>95%`: `bg-destructive`
  - [ ] 1.6 Warning message when >90%: `text-xs text-warning mt-1` "Storage is almost full. Consider removing books you've finished reading."

- [ ] Task 2: Implement storage data fetching (AC: 6)
  - [ ] 2.1 Create `useStorageEstimate` hook or use `useEffect` in StorageIndicator
  - [ ] 2.2 Call `OpfsStorageService.getStorageEstimate()` on mount and after book import/delete
  - [ ] 2.3 Format bytes to human-readable: KB, MB, GB with 1 decimal place
  - [ ] 2.4 Handle browsers where `navigator.storage.estimate()` is unavailable — show "Storage info unavailable"

- [ ] Task 3: Wire into Library page (AC: 1)
  - [ ] 3.1 Add `StorageIndicator` at the bottom of Library page, below the book grid/list
  - [ ] 3.2 Only show when `books.length > 0` (hidden in empty state)
  - [ ] 3.3 Refresh storage estimate after successful import or delete

## Dev Notes

### Storage Formatting Utility

```typescript
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
```

### Storage Estimate API

`navigator.storage.estimate()` returns `{ usage: number, quota: number }`:
- `usage`: bytes currently used by origin (all storage, not just OPFS)
- `quota`: estimated maximum available
- Note: these are origin-wide estimates, not book-specific. The component shows origin storage to help users understand their total browser budget.

### Design Token Verification

- `bg-surface-sunken/30` — verify this token exists in theme.css. If not, use `bg-muted/30` as fallback
- `bg-warning` and `bg-destructive` — confirmed in the design token system
- `text-warning` — verify availability; if missing, use `text-warning-foreground` or equivalent

### Performance Note

`navigator.storage.estimate()` is async but fast (typically <5ms). No need for debouncing. Call it on page load and after import/delete operations. Avoid polling — it's not needed since we know when storage changes.

### Dependencies on Previous Stories

- E83-S01: `OpfsStorageService.getStorageEstimate()`
- E83-S03: Library page layout (place indicator at bottom)

### Project Structure Notes

- New files: `src/app/components/library/StorageIndicator.tsx`
- Modified files: `src/app/pages/Library.tsx` (add StorageIndicator at bottom)

### References

- [Source: _bmad-output/planning-artifacts/epics-books-audiobooks-library.md#E83-S07]
- [Source: _bmad-output/planning-artifacts/ux-design-books-audiobooks-library.md#Storage Indicator]
- [Source: _bmad-output/planning-artifacts/architecture-books-audiobooks-library.md#Decision 2: OPFS Storage Architecture — Storage Service Interface]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
