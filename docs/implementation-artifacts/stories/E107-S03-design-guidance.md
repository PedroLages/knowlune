# Design Guidance: E107-S03 — Fix TOC Loading and Fallback

**Story Context**: Bug fix for EPUB reader table of contents reliability. Adds loading states, empty state messaging, and graceful fallbacks when TOC is unavailable.

**Affected Components**:
- `TableOfContents.tsx` — TOC panel (shadcn Sheet)
- `ReaderHeader.tsx` — Fixed top bar with chapter tracking
- `EpubRenderer.tsx` — EPUB content renderer with TOC callback
- `BookReader.tsx` — Parent page orchestrating reader state

---

## Design Philosophy

**Intention**: The reading experience should feel confident and reliable. When TOC is unavailable, the interface should communicate this gracefully without making the user feel something is "broken."

**Approach**: Subtle refinement over dramatic redesign. Enhance empty states with helpful context, maintain visual consistency with existing reader themes, and use loading indicators that match the current design language.

---

## 1. TOC Loading State (AC-1)

### Current State
- `EpubRenderer` has a loading spinner (`size-8 animate-spin rounded-full border-4 border-muted border-t-brand`)
- `TableOfContents` has NO loading state — it simply shows empty list until `tocChanged` fires

### Design Recommendation

**Pattern**: Match the existing EpubRenderer spinner for visual consistency.

```tsx
// In TableOfContents.tsx ScrollArea content:
{isTocLoading ? (
  <div className="flex flex-col items-center justify-center py-16 px-4" data-testid="toc-loading">
    <div
      className="size-8 animate-spin rounded-full border-4 border-muted border-t-brand"
      aria-hidden="true"
    />
    <p className="mt-4 text-sm text-muted-foreground">
      Loading table of contents…
    </p>
  </div>
) : toc.length === 0 ? (
  // Empty state (see section 2)
) : (
  // TOC list
)}
```

**Rationale**:
- Spinner matches EpubRenderer's loadingView for pattern consistency
- Centered vertical layout provides clear visual hierarchy
- Text label provides context (TOC loading takes time for large EPUBs)
- `aria-hidden` on spinner prevents redundant screen reader announcements

**Accessibility**:
- Add `role="status"` or `aria-busy="true"` to the loading container
- Ensure the loading message is visible to screen readers

---

## 2. Empty TOC State (AC-2, AC-5)

### Current State
```tsx
<p className="text-sm text-muted-foreground text-center py-8">
  No table of contents available
</p>
```

### Design Recommendation

**Pattern**: More helpful empty state with context and subtle visual interest.

```tsx
<div
  className="flex flex-col items-center justify-center py-16 px-6 text-center"
  data-testid="toc-empty-state"
>
  {/* Icon — subtle visual interest */}
  <div className="mb-4 rounded-full bg-muted/60 p-3">
    <BookOpen className="size-6 text-muted-foreground" aria-hidden="true" />
  </div>

  {/* Primary message */}
  <p className="text-base font-medium text-foreground mb-2">
    No table of contents
  </p>

  {/* Helpful explanation */}
  <p className="text-sm text-muted-foreground max-w-[250px]">
    This book doesn't have chapter navigation. You can still turn pages or use the reading settings.
  </p>
</div>
```

**Rationale**:
- Icon provides visual anchor and communicates "book/content" concept
- Two-tier messaging (primary + explanation) is more helpful than single statement
- `max-w-[250px]` prevents long text from becoming unwieldy
- Rounded background on icon creates subtle depth without being distracting

**Accessibility**:
- Icon has `aria-hidden="true"` (decorative)
- Text is descriptive and explains what the user CAN do (turn pages, settings)

---

## 3. Timeout Fallback (AC-3)

### Design Recommendation

**Pattern**: Same visual as Empty TOC State (section 2). After 5-second timeout, automatically transition from loading state to empty state.

**Behavior**:
1. Initial state: Loading spinner (section 1)
2. After 5s: If `tocChanged` hasn't fired, transition to empty state (section 2)
3. No "error" messaging — timeout is treated as "no TOC available" rather than "something broke"

**Implementation Note**: Use a `useEffect` with timeout to set `isTocLoading = false`. The empty state component handles both "never loaded" and "loaded empty array" cases.

---

## 4. Chapter Tracking Fallback (AC-4)

### Current State
```tsx
{currentChapter && (
  <p className="text-xs opacity-60 truncate leading-tight" title={currentChapter}>
    {currentChapter}
  </p>
)}
```

**Problem**: When `currentChapter` is undefined/null, nothing displays below the book title. The user loses sense of progress.

### Design Recommendation

**Pattern**: Show progress percentage when chapter name unavailable.

```tsx
{/* In ReaderHeader.tsx title/chapter section: */}
<div className="flex-1 min-w-0 mx-3 text-center">
  <p className="text-sm font-semibold truncate leading-tight" title={title}>
    {title}
  </p>

  {/* Chapter OR progress fallback */}
  {currentChapter ? (
    <p className="text-xs opacity-60 truncate leading-tight" title={currentChapter}>
      {currentChapter}
    </p>
  ) : progressPercent != null ? (
    <p className="text-xs opacity-60 leading-tight" title={`${progressPercent}% complete`}>
      {progressPercent}%
    </p>
  ) : null}
</div>
```

**Rationale**:
- Maintains two-line layout (book title + subtitle) for visual consistency
- Progress percentage provides concrete feedback when chapter tracking unavailable
- `opacity-60` matches existing chapter subtitle styling
- Truncate not needed for percentage (short text)

**Props Addition**: ReaderHeader needs a new prop:
```tsx
interface ReaderHeaderProps {
  // ... existing props
  /** Progress percentage (0-100) for fallback display when currentChapter is unavailable */
  progressPercent?: number | null
}
```

---

## 5. TOC Panel Button Behavior (AC-5)

### Current State
- TOC menu item in dropdown calls `onTocOpen()`
- No explicit handling for "no TOC available" case

### Design Recommendation

**Pattern**: TOC button/menu item remains enabled. When clicked with no TOC:
1. Panel opens with empty state message (section 2)
2. Empty state explains "This book doesn't have chapter navigation"
3. Panel can be closed normally

**Rationale**:
- Disabled buttons are frustrating — users want to know WHY something is unavailable
- Empty state with explanation is better than a disabled control
- Maintains consistent interaction model (TOC always opens, content varies)

---

## 6. Animation & Micro-interactions

### Loading → Empty Transition

**Pattern**: Smooth fade transition when timeout occurs.

```tsx
<div
  className={cn(
    "flex flex-col items-center justify-center py-16 px-6 text-center",
    "transition-opacity duration-300",
    isTocLoading ? "opacity-0" : "opacity-100"
  )}
>
  {/* Empty state content */}
</div>
```

**Rationale**:
- `duration-300` matches existing reader header transition (`transition-all duration-200`)
- Fade-out when loading, fade-in when empty state ready
- Avoids jarring content swap

**Note**: If using this pattern, ensure the loading state has the opposite opacity classes for smooth crossfade.

### TOC Item Hover/Active States

**Current**: Already well-implemented
```tsx
className={cn(
  'w-full text-left py-2.5 px-3 rounded-lg transition-colors text-sm',
  'hover:bg-muted/60 active:bg-muted',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
  isActive ? 'text-brand font-medium bg-brand-soft/40' : 'text-foreground'
)}
```

**No changes needed** — existing states are accessible and visually clear.

---

## 7. Theme Integration

### Reading Theme Consistency

The TOC panel uses `Sheet` component which has its own background. Ensure the empty state colors work across all reader themes:

| Theme | Empty State Text | Icon Background |
|-------|------------------|----------------|
| Light | `text-foreground` (default dark) | `bg-muted/60` |
| Sepia | Inherits from Sheet | `bg-muted/60` |
| Dark | Inherits from Sheet | `bg-muted/60` |

**No theme-specific code needed** — shadcn Sheet and design tokens handle theme adaptation automatically.

---

## 8. Accessibility Checklist

### TOC Loading State
- [ ] `role="status"` or `aria-busy="true"` on loading container
- [ ] `aria-live="polite"` if loading persists > 3s (optional)
- [ ] Loading message is screen reader visible

### Empty TOC State
- [ ] Icon has `aria-hidden="true"` (decorative)
- [ ] Explanation text is descriptive and actionable
- [ ] Empty state is keyboard accessible (focus management not needed for static content)

### Chapter Tracking Fallback
- [ ] Progress percentage has `title` attribute for screen readers
- [ ] Fallback text has same `opacity-60` as chapter name (consistent hierarchy)

### General
- [ ] All TOC panel interactions are keyboard navigable
- [ ] Focus visible on TOC items (already implemented: `focus-visible:ring-2`)
- [ ] Close button has clear `aria-label` (already implemented)

---

## 9. Component Props Updates

### TableOfContents
```tsx
interface TableOfContentsProps {
  open: boolean
  onClose: () => void
  toc: NavItem[]
  currentHref?: string
  rendition: Rendition | null
  /** NEW: Loading state for TOC data */
  isTocLoading?: boolean
}
```

### ReaderHeader
```tsx
interface ReaderHeaderProps {
  title: string
  currentChapter: string
  theme: ReaderTheme
  visible: boolean
  onTocOpen?: () => void
  onSettingsOpen?: () => void
  onHighlightsOpen?: () => void
  onReadAloud?: () => void
  onSwitchToListening?: () => void
  /** NEW: Progress percentage (0-100) for fallback when currentChapter unavailable */
  progressPercent?: number | null
}
```

### BookReader (Parent)
```tsx
// Add state tracking:
const [isTocLoading, setIsTocLoading] = useState(true)
const [tocLoadTimeout, setTocLoadTimeout] = useState<NodeJS.Timeout | null>(null)

// In handleTocLoaded callback:
const handleTocLoaded = (toc: NavItem[]) => {
  setToc(toc)
  setIsTocLoading(false)
  if (tocLoadTimeout) clearTimeout(tocLoadTimeout)
}

// Timeout effect:
useEffect(() => {
  const timeout = setTimeout(() => {
    setIsTocLoading(false)
  }, 5000) // 5 seconds
  setTocLoadTimeout(timeout)
  return () => clearTimeout(timeout)
}, [])
```

---

## 10. Visual QA Checklist

### Desktop (1440px+)
- [ ] Loading spinner centers properly in 320px-wide Sheet panel
- [ ] Empty state icon and text fit within panel width
- [ ] Chapter progress percentage doesn't overflow header

### Tablet (768px)
- [ ] TOC panel slides in from left smoothly
- [ ] Empty state text wraps appropriately
- [ ] Touch targets remain ≥44x44px

### Mobile (375px)
- [ ] Loading spinner doesn't feel cramped
- [ ] Empty state icon (with padding) fits within narrow panel
- [ ] Progress percentage is readable at small sizes

---

## Summary

**Design Approach**: Subtle refinement maintaining existing patterns. Loading states use the spinner pattern from EpubRenderer. Empty states are more helpful with icon and two-tier messaging. Chapter tracking fallback shows progress percentage for continuity. No theme-specific code needed — design tokens handle adaptation.

**Key Changes**:
1. Add `isTocLoading` prop to `TableOfContents` with spinner UI
2. Enhance empty state with icon, primary message, and explanation
3. Add `progressPercent` prop to `ReaderHeader` for fallback display
4. Implement 5-second timeout in `BookReader` with state management

**No Breaking Changes**: All additions are new props or conditional rendering. Existing behavior preserved when TOC loads successfully.
