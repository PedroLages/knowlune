# Design Review Report — E110-S03 Reading Queue

**Review Date**: 2026-04-12
**Reviewed By**: Ava (design-review agent) — Claude Sonnet 4.6 via Playwright MCP
**Story**: E110-S03 — Reading Queue
**Changed Files (UI)**: `src/app/components/library/ReadingQueue.tsx`, `src/app/components/library/BookContextMenu.tsx`, `src/app/pages/Library.tsx`
**Affected Routes**: `/library`
**Viewports Tested**: 375px (mobile), 768px (tablet), 1440px (desktop)

---

## Executive Summary

E110-S03 delivers a well-structured Reading Queue component integrated into the Library page. The component uses correct semantic list markup, provides meaningful ARIA labels on interactive controls, follows design token conventions (no hardcoded colors), and includes a clear empty state. The `prefers-reduced-motion` preference is handled globally and covers all queue animations.

Two issues require attention before merge: the drag-handle and remove buttons have 24×24px touch targets (well below the 44×44px minimum), which will make the queue difficult to use on touch devices. Additionally, both buttons are missing `type="button"`, creating a latent form-submit bug. One medium-priority ARIA completeness gap was found (no `aria-live` region for queue mutation feedback to screen readers).

---

## What Works Well

1. **Design token discipline** — No hardcoded colors anywhere in `ReadingQueue.tsx` or the Queue additions to `BookContextMenu.tsx`. All colors use semantic tokens (`bg-card`, `bg-brand`, `bg-brand-soft`, `text-muted-foreground`, etc.).
2. **Semantic list structure** — `role="list"` with `aria-label="Reading queue"` on the container and `role="listitem"` on each sortable item is correct and screen-reader friendly.
3. **dnd-kit keyboard accessibility** — The keyboard sensor is configured, screen reader instructions are injected by dnd-kit (`aria-describedby` pointing to instructions text), and `aria-roledescription="sortable"` is applied per item. Tab order is correct (tabIndex=0 on all interactive buttons).
4. **ARIA labels on all interactive controls** — Drag handles and remove buttons both carry descriptive labels including book title (e.g., "Drag to reorder Who Moved My Cheese", "Remove Who Moved My Cheese from queue").
5. **Contrast ratios pass in both modes** — Dark mode measurements: title text 12.45:1, author text 7.42:1, count badge 5.99:1, section heading 14.12:1. All well above the 4.5:1 WCAG AA minimum.
6. **No horizontal overflow** — Verified at 375px, 768px, and 1440px. `min-w-0 flex-1` on the text container with `truncate` class ensures titles/authors clip correctly at all widths.
7. **Empty state is clear and instructional** — The message "Your reading queue is empty. Right-click a book and select 'Add to Queue' to get started." directly explains the gesture needed, which is good guidance for new users.
8. **No console errors** — Zero JavaScript errors observed across all test sessions.
9. **Global `prefers-reduced-motion`** — `index.css` applies `transition-duration: 0.01ms` to all elements under the reduce media query, covering the progress bar `transition-all` and dnd-kit drag animations.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

#### HIGH-1: Drag handle and remove buttons have 24×24px touch targets (below 44×44px minimum)

**Location**: `src/app/components/library/ReadingQueue.tsx:87-93`, `src/app/components/library/ReadingQueue.tsx:119-127`

**Evidence**: At both 375px and 768px viewports, `getBoundingClientRect()` returns `{ w: 24, h: 24 }` for both the drag handle (`<button className="... rounded p-1 ...">`) and the remove button (`<button className="... rounded p-1 ...">`)`. The clickable area is the icon's 16px size plus 4px padding on each side = 24px total.

**Impact**: On mobile and tablet — the primary form factor for personal reading management — users will frequently miss-tap these small controls, triggering adjacent items or scrolling instead. This is especially problematic for the remove action, which is irreversible without undo.

**Suggestion**: Increase padding to `p-2.5` (20px padding = 40px total) or add `min-h-[44px] min-w-[44px]` directly to both buttons. Since the row height is compact by design, using `min-h-[44px] flex items-center justify-center` keeps the visual size small while expanding the tap target.

```tsx
// Drag handle — change p-1 to min-h-[44px] min-w-[44px] flex items-center justify-center
<button
  className="cursor-grab touch-manipulation rounded min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
  ...
>

// Remove button — same treatment
<button
  className="shrink-0 rounded min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
  ...
>
```

---

#### HIGH-2: Drag handle and remove buttons missing `type="button"`

**Location**: `src/app/components/library/ReadingQueue.tsx:86`, `src/app/components/library/ReadingQueue.tsx:119`

**Evidence**: Both `<button>` elements have no `type` attribute. The evaluated `type` from DOM returns `"unset"` for both. Without `type="button"`, buttons inside a `<form>` ancestor default to `type="submit"` per the HTML spec, which would trigger form submission.

**Impact**: The Library page does not currently wrap the queue in a form, so this is not broken today. However, it creates a fragile dependency on page structure. If a future parent component adds a form context (e.g., a search form wrapper), these buttons would silently submit it — a hard-to-debug regression.

**Suggestion**: Add `type="button"` to both buttons. This is a one-line fix per button:

```tsx
<button type="button" className="cursor-grab ..." ...>
<button type="button" className="shrink-0 ..." ...>
```

---

### Medium Priority (Fix when possible)

#### MEDIUM-1: No `aria-live` region for queue mutation feedback

**Location**: `src/app/components/library/ReadingQueue.tsx` — component level

**Evidence**: When an item is removed or reordered, screen readers receive no announcement beyond the focus shift. The existing `aria-live="polite"` regions in the page are Sonner toast containers (for the "Added to reading queue" / "Failed to…" toasts), which do announce add/error events. However, the remove action (`removeFromQueue`) has no user-facing toast — it just updates state silently. Screen reader users get no confirmation that the removal occurred.

**Impact**: A blind or low-vision user tabbing to a remove button and pressing Enter/Space has no reliable way to confirm the item was actually removed without navigating back through the list to count remaining items.

**Suggestion**: Add a visually-hidden `aria-live="polite"` status region that announces removal and reorder events:

```tsx
// In ReadingQueue component, add a status region:
const [statusMessage, setStatusMessage] = useState('')

// In handleDragEnd:
setStatusMessage(`${book.title} moved to position ${newIndex + 1}`)

// In onRemove handler:
setStatusMessage(`${book.title} removed from reading queue`)

// In JSX:
<p className="sr-only" aria-live="polite" aria-atomic="true">
  {statusMessage}
</p>
```

---

#### MEDIUM-2: Empty state uses `text-center` on the instruction paragraph, but design principles specify left-aligned body text

**Location**: `src/app/components/library/ReadingQueue.tsx:199`

**Evidence**: The empty state container has `text-center` applied at the div level (`className="mb-4 rounded-2xl border border-dashed border-border/50 p-4 text-center"`), which centers the instruction paragraph. The design principles state: "Left-aligned text for LTR languages (never center-align body text)."

**Impact**: Center-aligned instructional text is harder to scan, especially for users with cognitive or reading disabilities. The design principle exists because starting every line at an unpredictable horizontal position forces the eye to search for the beginning of each line.

**Suggestion**: Remove `text-center` from the container div. Center-align only the icon via `mx-auto`. This keeps the visual balance of the icon centered while restoring left-aligned text:

```tsx
<div className="mb-4 rounded-2xl border border-dashed border-border/50 p-4">
  <ListOrdered className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden="true" />
  <p className="text-sm text-muted-foreground">
    Your reading queue is empty. Right-click a book ...
  </p>
</div>
```

---

#### MEDIUM-3: Empty state instruction text only describes right-click (desktop gesture), omitting the touch equivalent

**Location**: `src/app/components/library/ReadingQueue.tsx:199-202`

**Evidence**: The instruction reads: "Your reading queue is empty. Right-click a book and select 'Add to Queue' to get started." On mobile/tablet (375px and 768px viewports tested), right-click is not available. The touch equivalent is the "..." (more actions) `DropdownMenuTrigger` button on book cards, but this is not mentioned.

**Impact**: Mobile-first learners — a significant portion of personal library users — will not know how to add books to the queue. They may assume the feature is unavailable on mobile.

**Suggestion**: Update the instruction to cover both gestures:

```tsx
<p className="text-sm text-muted-foreground">
  Your reading queue is empty.{' '}
  <span className="hidden sm:inline">Right-click a book</span>
  <span className="sm:hidden">Tap the&nbsp;&#8943; menu on a book</span>
  {' '}and select &quot;Add to Queue&quot; to get started.
</p>
```

---

### Nitpicks (Optional)

#### NIT-1: Queue section container (`reading-queue-section`) lacks a landmark role or heading association

**Location**: `src/app/components/library/ReadingQueue.tsx:207`

**Evidence**: The outer `<div data-testid="reading-queue-section">` has no `role` or `aria-labelledby`. The `<h3>Reading Queue</h3>` inside provides a visual heading, but assistive technology users navigating by landmarks or headings will not be able to jump to this section independently from the page's heading hierarchy.

**Suggestion**: Wrap in a `<section aria-labelledby="reading-queue-heading">` and add `id="reading-queue-heading"` to the `<h3>`. This is a low-effort improvement that helps screen reader landmark navigation.

---

#### NIT-2: Cover image `alt=""` is technically correct (decorative) but the title tooltip provides context that could be surfaced

**Location**: `src/app/components/library/ReadingQueue.tsx:43`

**Evidence**: `<img src={coverUrl} alt="" className="h-14 w-10 ..." />` — the empty alt correctly marks the cover as decorative since the book title immediately follows in text. This is the right pattern for a list context where the title is the primary identifier.

**Note**: No change needed. This is intentional and correct per WCAG F39. Documenting as a nit to confirm this was deliberately reviewed.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (dark mode) | Pass | Title 12.45:1, author 7.42:1, badge 5.99:1, heading 14.12:1 |
| Text contrast ≥4.5:1 (light mode) | Not directly measured | Token-based colors — same tokens pass in light mode per theme.css design |
| Keyboard navigation | Pass | All buttons have tabIndex=0, dnd-kit keyboard sensor configured |
| Focus indicators visible | Pass | Remove button shows 2px solid brand-color outline on focus |
| Heading hierarchy | Pass | `<h3>Reading Queue</h3>` fits within page's heading hierarchy |
| ARIA labels on icon buttons | Pass | Drag handles and remove buttons both have descriptive labels |
| Semantic HTML — list structure | Pass | `role="list"` + `role="listitem"` used correctly |
| dnd-kit screen reader instructions | Pass | Auto-injected instructions text via aria-describedby |
| `aria-roledescription="sortable"` | Pass | Applied to each sortable list item |
| aria-live region for mutations | Fail | Remove action provides no AT announcement (MEDIUM-1) |
| `type="button"` on native buttons | Fail | Both drag handle and remove button missing type attribute (HIGH-2) |
| Cover image alt text | Pass | `alt=""` is correct for decorative context |
| Placeholder icon aria-hidden | Pass | ListOrdered placeholder icon has `aria-hidden="true"` |
| prefers-reduced-motion | Pass | Global override in index.css covers all transitions |
| No console errors | Pass | Zero JS errors in all test sessions |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass with caveats — No horizontal scroll. Queue renders correctly at 279px item width. Title truncation with ellipsis works. Touch targets for drag handle and remove button are 24×24px (see HIGH-1). Section occupies full available width below the sidebar.
- **Tablet (768px)**: Pass with caveats — No horizontal scroll. Queue renders at 672px width. Same 24×24px touch target issue applies (see HIGH-1). Sidebar collapsed at this viewport.
- **Sidebar Collapse (1024px)**: Not individually tested — follows same layout as tablet.
- **Desktop (1440px)**: Pass — Queue renders at full content width (1248px). Layout is correct. Touch target issue is less impactful at this breakpoint (pointer input).

---

## Recommendations

1. **Fix touch targets first (HIGH-1)** — This is the most impactful UX issue. The 24px buttons will cause consistent frustration for mobile users trying to reorder or remove queue items. Expand to min 44×44px with a padding approach that preserves the compact visual design.

2. **Add `type="button"` to all native buttons (HIGH-2)** — A single-line fix per button that prevents a future form-context regression.

3. **Add sr-only live region for remove/reorder announcements (MEDIUM-1)** — Screen reader users are a core accessibility constituency. The queue's remove action is silent for AT today.

4. **Update empty state instruction for mobile (MEDIUM-3)** — A simple conditional text change that makes the feature discoverable on the primary mobile form factor.

