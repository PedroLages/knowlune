# Implementation Plan: E107-S03 Fix TOC Loading and Fallback

**Story:** E107-S03 — Fix TOC Loading and Fallback
**Epic:** E107 — Fix Books/Library Core Bugs
**Started:** 2026-04-09
**Status:** ready-for-dev
**Complexity:** LOW

---

## Overview

This bug fix adds reliable TOC loading states, empty state messaging, timeout fallbacks, and chapter tracking fallback (progress percentage) to the EPUB reader. The goal is to provide confident navigation without broken/missing UI when TOC is unavailable.

---

## Acceptance Criteria

- **AC-1**: TOC loading state is tracked and displayed in the TableOfContents panel
- **AC-2**: Empty TOC displays a user-friendly message in the TableOfContents panel
- **AC-3**: TOC that fails to load or times out gracefully falls back to empty state
- **AC-4**: Chapter tracking in BookReader works even when TOC is unavailable (progress percentage fallback)
- **AC-5**: TableOfContents panel button remains enabled but shows empty state when TOC is unavailable

---

## Dependencies

✅ **E107-S01** (Fix Cover Image Display) — DONE  
✅ **E107-S02** (Fix EPUB Reader Rendering) — DONE

**No external dependencies** — builds on existing E83-E104 implementation.

## Current State Analysis

### Files Involved

1. **`src/app/pages/BookReader.tsx`**
   - Manages TOC state via `const [toc, setToc] = useState<NavItem[]>([])`
   - Has `handleTocLoaded` callback that sets TOC state
   - Passes `toc` to `TableOfContents` component
   - Uses `currentChapter` from reader store for header display

2. **`src/app/components/reader/EpubRenderer.tsx`**
   - Receives `onTocLoaded` callback prop
   - Passes it to `EpubView` as `tocChanged` prop
   - No loading state tracking

3. **`src/app/components/reader/TableOfContents.tsx`**
   - Displays TOC list or "No table of contents available" message
   - No loading state (shows empty message when `toc.length === 0`)

4. **`src/app/components/reader/ReaderHeader.tsx`**
   - Displays `currentChapter` in header title
   - No fallback when chapter name is unavailable

### Problem Statement

1. **No Loading Indicator**: Users don't know if TOC is loading or unavailable
2. **No Timeout**: If `tocChanged` never fires, the loading state persists indefinitely
3. **No Chapter Fallback**: Header shows empty/undefined when TOC is unavailable
4. **Ambiguous Empty State**: Can't distinguish "loading" from "loaded but empty"

## Implementation Approach

### Step 1: Add TOC Loading State to BookReader

**File:** `src/app/pages/BookReader.tsx`

```typescript
// Add new state variable
const [toc, setToc] = useState<NavItem[]>([])
const [isTocLoading, setIsTocLoading] = useState(true) // NEW

// Update handleTocLoaded to clear loading state
const handleTocLoaded = useCallback(
  (loadedToc: NavItem[]) => {
    setToc(loadedToc)
    setIsTocLoading(false) // NEW
    if (loadedToc.length > 0 && !currentChapter) {
      setCurrentChapter(loadedToc[0].label)
    }
  },
  [currentChapter, setCurrentChapter]
)
```

### Step 2: Add Timeout Effect

**File:** `src/app/pages/BookReader.tsx`

```typescript
// Timeout effect for TOC loading
useEffect(() => {
  const timeoutId = setTimeout(() => {
    if (isTocLoading) {
      setIsTocLoading(false)
    }
  }, 5000) // 5 second timeout

  return () => clearTimeout(timeoutId)
}, [isTocLoading])
```

### Step 3: Pass Loading State to TableOfContents

**File:** `src/app/pages/BookReader.tsx`

```typescript
<TableOfContents
  open={tocOpen}
  onClose={() => setTocOpen(false)}
  toc={toc}
  currentHref={currentHref}
  rendition={renditionRef.current}
  isLoading={isTocLoading} // NEW
/>
```

### Step 4: Update TableOfContents Component

**File:** `src/app/components/reader/TableOfContents.tsx`

```typescript
interface TableOfContentsProps {
  open: boolean
  onClose: () => void
  toc: NavItem[]
  currentHref?: string
  rendition: Rendition | null
  isLoading?: boolean // NEW
}

export function TableOfContents({
  open,
  onClose,
  toc,
  currentHref,
  rendition,
  isLoading = false, // NEW
}: TableOfContentsProps) {
  // ... existing code ...

  return (
    <Sheet open={open} onOpenChange={open => !open && onClose()}>
      <SheetContent side="left" className="w-80 p-0 flex flex-col" data-testid="toc-panel">
        <SheetHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/50">
          {/* ... existing header ... */}
        </SheetHeader>

        <ScrollArea className="flex-1 px-2 py-2">
          {isLoading ? ( // NEW
            <div className="flex items-center justify-center py-8" data-testid="toc-loading">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading table of contents...</span>
            </div>
          ) : toc.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No table of contents available
            </p>
          ) : (
            // ... existing TOC list ...
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
```

### Step 5: Update ReaderHeader Chapter Fallback

**File:** `src/app/components/reader/ReaderHeader.tsx`

```typescript
// When displaying current chapter, fall back to progress if unavailable
const chapterDisplay = currentChapter ?? (readingProgress ? `${Math.round(readingProgress * 100)}%` : 'Loading...')
```

## Testing Strategy

### Unit Tests

**File:** `src/app/components/reader/__tests__/TableOfContents.test.tsx`

```typescript
describe('TableOfContents', () => {
  it('shows loading state when isLoading is true', () => {
    render(<TableOfContents {...props} isLoading={true} toc={[]} />)
    expect(screen.getByTestId('toc-loading')).toBeInTheDocument()
  })

  it('shows empty state when toc is empty and not loading', () => {
    render(<TableOfContents {...props} isLoading={false} toc={[]} />)
    expect(screen.getByText('No table of contents available')).toBeInTheDocument()
  })

  it('shows TOC items when available', () => {
    render(<TableOfContents {...props} isLoading={false} toc={mockToc} />)
    expect(screen.getByText('Chapter 1')).toBeInTheDocument()
  })
})
```

**File:** `src/app/pages/__tests__/BookReader.test.tsx`

Add tests for:
- TOC loading state transitions
- Timeout behavior
- Chapter tracking fallback

### E2E Tests

**File:** `tests/e2e/books/toc-loading.spec.ts`

```typescript
test('EPUB without TOC shows empty state', async ({ page }) => {
  // Navigate to an EPUB with no navigation
  await page.goto('/library/test-book-no-toc/read')
  await page.click('[data-testid="toc-button"]')
  await expect(page.getByText('No table of contents available')).toBeVisible()
})

test('TOC shows loading indicator initially', async ({ page }) => {
  await page.goto('/library/test-book-with-toc/read')
  await page.click('[data-testid="toc-button"]')
  // Loading state should appear briefly
  await expect(page.getByTestId('toc-loading')).toBeVisible()
  // Then should show TOC items
  await expect(page.getByText('Chapter 1')).toBeVisible({ timeout: 5000 })
})
```

## Acceptance Criteria Verification

| AC | Verification Method |
|----|---------------------|
| AC-1: Loading state tracked | Unit test: TOC loading transitions from true → false |
| AC-2: Empty TOC message | E2E test: Open TOC panel with EPUB that has no navigation |
| AC-3: Timeout fallback | Unit test: Timeout effect sets loading to false after 5s |
| AC-4: Chapter tracking fallback | Visual QA: Open EPUB without TOC, verify header shows % |
| AC-5: TOC button remains enabled | Manual test: Click TOC button when unavailable, see empty state |

## Edge Cases to Consider

1. **EPUB with corrupted navigation**: `tocChanged` fires with malformed data → handle with try/catch
2. **EPUB with very large TOC**: Timeout should allow extra time for large navigation structures
3. **Rapid TOC open/close**: Loading state should persist correctly across panel open/close cycles
4. **Remote EPUB loading**: TOC may load slower than local EPUBs — timeout accommodates network latency

## Existing Patterns Reference

| Pattern | Location | Reference |
|---------|----------|-----------|
| Timeout with cleanup | BookReader.tsx | Lines 276-296 (idleTimerRef pattern) |
| Loading spinner | EpubRenderer.tsx | Lines 243-250 (loadingView) |
| Progress calculation | ReaderFooter.tsx | Line 42 (`Math.round(progress * 100)`) |
| Empty state base | TableOfContents.tsx | Lines 112-115 (enhance, don't replace) |
| Conditional chapter | ReaderHeader.tsx | Lines 95-103 (add else branch) |

## Design Guidance

See [E107-S03 Design Guidance](./E107-S03-design-guidance.md) for:
- Loading state design (spinner matching EpubRenderer)
- Empty state design (icon + two-tier messaging)
- Chapter tracking fallback (progress percentage display)
- Component props updates
- Accessibility checklist
- Visual QA checklist

## Package Dependencies

- **React**: useState, useEffect, useCallback hooks (already in use)
- **lucide-react**: BookOpen icon (already imported for empty state)
- **epubjs**: NavItem type (already in use)
- **shadcn/ui**: Sheet, ScrollArea components (already in use)

**No new dependencies required.**

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Timeout too short for slow TOC loads | Set generous 5-second timeout; consider making configurable |
| Loading state stuck if tocChanged fires late | Timeout ensures loading state clears regardless |
| Chapter fallback breaks header layout | Test with various progress percentages (0%, 50%, 100%) |

## Definition of Done

- [ ] All tasks completed
- [ ] Unit tests pass (new + existing)
- [ ] E2E tests pass (new + existing smoke tests)
- [ ] Manual testing with EPUBs that have no TOC
- [ ] Manual testing with EPUBs that have TOC
- [ ] Loading state visible when opening TOC panel
- [ ] Empty state message shows when TOC unavailable
- [ ] Header shows progress percentage when chapter name unavailable
