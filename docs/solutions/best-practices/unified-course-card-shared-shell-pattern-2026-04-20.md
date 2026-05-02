---
title: Unified course-card shared-shell pattern (frameless album-art with touch-safe z-stacking)
date: 2026-04-20
category: docs/solutions/best-practices/
module: knowlune-web
problem_type: best_practice
component: frontend_stimulus
related_components:
  - testing_framework
severity: high
applies_when:
  - building card components that share visual language across variants
  - integrating optimistic-update stores with click handlers that navigate
  - layering interactive controls over media on touch devices
  - two near-duplicate components diverge on each change
tags:
  - react
  - component-design
  - touch-accessibility
  - z-index
  - optimistic-updates
  - shared-primitives
  - design-tokens
  - keyboard-a11y
---

# Unified course-card shared-shell pattern (frameless album-art with touch-safe z-stacking)

## Context

Knowlune had two course-card components (`CourseCard`, `ImportedCourseCard`) that had drifted apart in markup, hover affordances, and status handling while trying to express the same "album-art tile" visual language already established by `BookCard`. We consolidated them onto a shared shell of four frameless primitives (`CardCover`, `CoverProgressBar`, `PlayOverlay`, `CompletionOverlay`) and ran a full review pass that surfaced 28 findings (1 BLOCKER, 7 HIGH, 10 MEDIUM, 11 LOW). Fixing all 28 in one pass via four parallel sub-agents — with 6313/6313 unit tests still green — turned a cosmetic refactor into a durable set of patterns for any hover-driven, optimistic-update card UI.

This doc is a concrete instance of the meta-rule documented in [`extract-shared-primitive-on-second-consumer-2026-04-18.md`](./extract-shared-primitive-on-second-consumer-2026-04-18.md). The optimistic-update peek pattern is a card-flavored sibling of [`audiobook-cover-search-async-timing-2026-04-16.md`](../logic-errors/audiobook-cover-search-async-timing-2026-04-16.md).

## Guidance

### 1. Frameless album-art card with touch-safe z-stacking

A frameless cover-as-button card relies on a full-bleed `PlayOverlay` that fades in on hover. The trap: corner controls (status dropdown, info button, completion badge) sit visually above the cover but live underneath the overlay in z-order, and **touch devices never fire `:hover`** so the overlay's `opacity-0` would make corner buttons untappable.

Two rules fix this once and forever:

1. Lift corner controls to `z-30`; keep the overlay at `z-20`.
2. Add `[@media(hover:none)]:opacity-100` so anything that fades in on hover is permanently visible on touch.

```tsx
// PlayOverlay (shared primitive)
<button
  type="button"
  className="absolute inset-0 z-20 flex items-center justify-center
             bg-foreground/60 opacity-0 transition-opacity
             group-hover:opacity-100 group-focus-visible:opacity-100
             motion-reduce:transition-none"
  onClick={onPlay}
>
  <Play className="size-10 text-background" />
</button>

// Corner control (status dropdown, info, completion badge)
<div className="absolute top-2 right-2 z-30
                opacity-0 group-hover:opacity-100
                [@media(hover:none)]:opacity-100">
  <StatusDropdown ... />
</div>
```

Use `bg-foreground/60` rather than `bg-black/50` — the design-token ESLint rule blocks raw colors and the token automatically inverts in dark mode (see [`design-token-cheat-sheet.md`](../../implementation-artifacts/design-token-cheat-sheet.md)).

### 2. Optimistic-update store + UI: peek at the error field, don't rely on throw

`useCourseImportStore.updateCourseStatus` is optimistic: it mutates state, awaits the persistence call, and on failure rolls state back and writes an `importError` field — it **never throws**. The original card called `await updateCourseStatus(...)` then unconditionally navigated, so a rolled-back failure still routed the user to a course they hadn't actually started.

Peek at the store after `await`, and add an in-flight ref to swallow the double-click race where two clicks both navigate before the first commit lands:

```tsx
const startingRef = useRef(false)

async function handleStartStudying(e: React.MouseEvent<HTMLButtonElement>) {
  // stopPropagation must run synchronously before the first await
  e.stopPropagation()
  if (startingRef.current) return          // swallow the second click
  startingRef.current = true
  try {
    await updateCourseStatus(course.id, 'active')
    // Safe to peek because: (1) startingRef prevents concurrent calls,
    // (2) updateCourseStatus clears importError at the start of each call.
    // Don't copy this pattern to stores that lack those two invariants —
    // use a returned discriminated result instead: { ok: true } | { ok: false, error: string }
    const { importError } = useCourseImportStore.getState()
    if (importError) {
      toast.error(importError)
      return
    }
    navigate(`/courses/${course.id}/overview`)
  } finally {
    startingRef.current = false
  }
}
```

The `useRef` (not `useState`) avoids a re-render between click and navigation, which is what made the race observable in the first place. See [`engineering-patterns.md` § Optimistic UI with Rollback](../../engineering-patterns.md) (L87-103) for the store-side discipline this UI complements.

### 3. Mutual exclusion via derived state, not boolean tangles

Both `PlayOverlay` and `CompletionOverlay` rendered on a 100% course because each had its own ad-hoc condition. Stop chaining boolean checks at every call site — derive the slot decisions once at the top of the component:

```tsx
// Lock statuses to a union so new variants (archived, failed) are caught at compile-time
type CourseStatus = 'not-started' | 'active' | 'completed' | 'archived' | 'failed'

const isCompleted =
  course.status === 'completed' || completionPercent === 100
const showPlay =
  // !isCompleted guards the completionPercent === 100 edge case where status
  // hasn't been written yet but the card should already show as complete
  course.status === 'not-started' && !isCompleted && !readOnly

return (
  <CourseCardShell heightClass="h-48">
    {showPlay && <PlayOverlay onPlay={handleStartStudying} />}
    {isCompleted && <CompletionOverlay />}
  </CourseCardShell>
)
```

This collapses the truth table into two named booleans that read like the spec ("a play button shows only on not-started, never on completed"), and any future state (`'archived'`, `'failed'`) extends one place.

### 4. Shared-shell extraction yields review-quality jumps

Pulling the four primitives into `CourseCardShell.tsx` paid for itself three ways:

- **Drift elimination.** The two cards can no longer disagree on cover markup, focus ring, or overlay color.
- **Function shrinkage.** Once `COVER_WIDTHS`, `buildSrcSet()`, and `<EmptyCoverFallback />` were lifted alongside the primitives, `renderThumbnailContent` collapsed from ~91 to ~52 lines and stopped being a review hotspot.
- **Single enforcement point.** `type="button"` on every overlay, the `ring-offset-2 ring-offset-foreground/50` focus ring, `motion-reduce:transition-none`, and a required `heightClass` prop all live in one file.

Rename with git so history follows the file:

```bash
git mv src/.../courseCardShell.tsx src/.../CourseCardShell.tsx
```

Plain delete + add hides the lineage and makes the next reviewer hunt for blame.

## Why This Matters

- **Touch z-stacking** — Hover-only overlays silently break a third of users (mobile + tablet). z-order plus `(hover:none)` is the cheapest fix and the easiest to forget. This was the lone BLOCKER in the 28-finding review.
- **Silent stores** — Optimistic stores that expose `error` fields instead of throwing are great for UX but let callers march on as if the write succeeded. Peeking the field after `await` closes a class of "navigated to a state that was rolled back" bugs. (Knowlune's `useCourseImportStore`, `useBookStore`, and other Zustand stores all use this rollback-with-error-field shape — apply the peek wherever a click triggers navigation.)
- **Render races** — Booleans-at-every-call-site lets two mutually-exclusive UI states render together. Deriving the decision once makes the impossible state un-typeable.
- **Near-duplicate drift** — Two cards that "look the same" diverge on every change. A shared shell turns drift bugs into compile-time props. This is the same lesson as `extract-shared-primitive-on-second-consumer`, instantiated for cards.

## When to Apply

- A card or tile uses a hover-revealed full-bleed overlay **and** has tappable corner controls.
- A Zustand/Redux store performs optimistic updates and surfaces failures via an `error` field instead of throwing.
- Two visual states are conceptually exclusive (play vs. completion, idle vs. loading, draft vs. published).
- Two components share a body/shell but diverge only in metadata or a header strip — extract the shell before the third variant lands.
- A click handler navigates after `await` — add an in-flight `useRef` guard before the first user reports double-clicking through to a half-committed state.

## Examples

Type the click handler against the React element, not the bare DOM event. `MouseEvent` without a namespace resolves to the DOM lib type — React synthetic events are a distinct wrapper type that carries the element generic:

```tsx
// before — DOM MouseEvent, loses the element type and React event pooling contract
function handleStart(e: MouseEvent) { ... }
// after — React synthetic event tied to the button element
function handleStart(e: React.MouseEvent<HTMLButtonElement>) { ... }
```

Reserve vertical space so swapping metadata doesn't shift layout:

```tsx
// library variant
<div className="min-h-32 px-3 py-2">{...}</div>
// overview variant
<div className="min-h-24 px-3 py-2">{...}</div>
```

Give tests a stable hook without changing the rendered tree:

```tsx
<div data-testid="completion-progress-bar" className="contents">
  <CoverProgressBar value={completionPercent} />
</div>
```

Assert behavior, not Tailwind classes:

```tsx
// avoid
expect(button).toHaveClass('bg-foreground/60')
// prefer
await user.click(screen.getByRole('button', { name: /start studying/i }))
expect(navigate).toHaveBeenCalledWith('/courses/abc/overview')
expect(toast.error).not.toHaveBeenCalled()
```

Track renames in git so blame survives:

```bash
git mv src/app/components/figma/courseCardShell.tsx \
       src/app/components/figma/CourseCardShell.tsx
```

## Related

- [`extract-shared-primitive-on-second-consumer-2026-04-18.md`](./extract-shared-primitive-on-second-consumer-2026-04-18.md) — the meta-rule that justified `CourseCardShell`.
- [`audiobook-cover-search-async-timing-2026-04-16.md`](../logic-errors/audiobook-cover-search-async-timing-2026-04-16.md) — sibling pattern for `useRef` in-flight guard + post-await state peek.
- [`single-write-path-for-synced-mutations-2026-04-18.md`](./single-write-path-for-synced-mutations-2026-04-18.md) — store-side mutation discipline that complements the UI peek.
- [`engineering-patterns.md`](../../engineering-patterns.md) § Optimistic UI with Rollback (L87-103).
- [`design-token-cheat-sheet.md`](../../implementation-artifacts/design-token-cheat-sheet.md) — rationale for `bg-foreground/60` over `bg-black/50`.
- [`.claude/rules/styling.md`](../../../.claude/rules/styling.md) — token enforcement and `variant="brand"` discipline.
- Implementation: commit `cc25c85d` on `refactor/unified-course-card-visual-language` (28 findings resolved, 5 files +299/-143).
