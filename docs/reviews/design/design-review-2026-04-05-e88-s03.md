# Design Review — E88-S03: Remote EPUB Streaming (2026-04-05)

## Scope

UI changes in `BookReader.tsx`: LoadingSkeleton parameterized message, error state with cached fallback button, hardcoded color fixes.

## Testing

- Desktop (1440px): "Book not found" state renders correctly with `bg-background` token
- Mobile (375px): Responsive, centered layout, no horizontal scroll
- Could not trigger remote error/cached fallback states (no remote books in dev store) — reviewed from code

## Findings

### GOOD

- **Hardcoded color fix**: `bg-[#FAF5EE]` replaced with `bg-background` in both LoadingSkeleton and error state. Correct design token usage.
- **Dynamic loading message**: "Loading from server..." for remote books vs "Loading book..." for local — good UX differentiation.
- **Touch targets**: Both "Read cached version" and "Retry" buttons have `min-h-[44px]` meeting WCAG touch target requirements.
- **Error state accessibility**: Error container has `role="alert"` for screen reader announcement. Error message has `data-testid` for testing.
- **Design tokens**: All colors use tokens (`bg-background`, `text-destructive`, `text-brand`, `bg-brand`, `text-brand-foreground`, `hover:bg-brand-hover`, `text-muted-foreground`).

### MEDIUM

**D1 — "Read cached version" button uses inline classes instead of shadcn Button** — `BookReader.tsx:589-595`

The cached fallback button uses raw `<button>` with inline Tailwind classes (`rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover`) instead of `<Button variant="brand">` from the component library. This works visually but diverges from component library patterns. Consistency recommendation — use `<Button>`.

### LOW

**D2 — Error state layout could use `flex-wrap` for very narrow viewports** — `BookReader.tsx:587`

The `flex gap-3` container for the two buttons doesn't have `flex-wrap`. On very narrow viewports with long button text, buttons could overflow. At current text lengths ("Read cached version" + "Retry") this is unlikely to cause issues at 375px+.

## Verdict

No blockers. 1 MEDIUM (component library consistency), 1 LOW (flex-wrap). Design token migration is a positive improvement.
