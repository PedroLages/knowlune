---
title: Long-press card affordance + jsdom pointer-event test pattern
date: 2026-04-25
module: src/app/components/figma
component: ImportedCourseCompactCard
tags:
  - long-press
  - pointer-events
  - touch
  - jsdom
  - vitest
  - radix-ui
  - dropdown-menu
problem_type: best_practice
category: best-practices
---

## Context

E99-S04 needed a "long-press to open menu" affordance on compact course cards: a hold > 500ms (without > 10px movement) opens the overflow menu, while a short tap navigates to the course. Two pieces are non-obvious:

1. The **runtime pattern** must coexist with normal click navigation, hover affordances, and touch-device fallbacks (`@media (hover: none)`).
2. The **jsdom test pattern** for verifying the cancel-on-move branch fails silently if you use `fireEvent.pointerMove(card, { clientX, clientY })` — jsdom does not always propagate `clientX`/`clientY` through the synthetic React event, so the handler observes `undefined` deltas and never cancels the timer.

## Guidance

### Runtime pattern (in `ImportedCourseCompactCard.tsx`)

```tsx
const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const pressStartRef = useRef<{ x: number; y: number } | null>(null)
const longPressTriggeredRef = useRef(false)
const [menuOpen, setMenuOpen] = useState(false)

useEffect(() => () => {
  if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
}, [])

function handlePointerDown(e: React.PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  longPressTriggeredRef.current = false
  pressStartRef.current = { x: e.clientX, y: e.clientY }
  pressTimerRef.current = setTimeout(() => {
    longPressTriggeredRef.current = true
    setMenuOpen(true)
    pressTimerRef.current = null
  }, 500)
}

function handlePointerMove(e: React.PointerEvent) {
  const start = pressStartRef.current
  if (!start) return
  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
    pressTimerRef.current = null
    pressStartRef.current = null
  }
}

// Clear on pointerup, pointercancel, pointerleave too.
// In handleCardClick: if longPressTriggeredRef.current, swallow the click
// (preventDefault + stopPropagation + reset) so the menu-opening hold
// doesn't also navigate.
```

Wire the menu via controlled state: `<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>` so `setMenuOpen(true)` from the timer programmatically opens it.

### jsdom test pattern (in vitest)

`fireEvent.pointerMove` with `clientX`/`clientY` props does not reliably propagate the coords through React's synthetic event in jsdom. Build the event explicitly:

```ts
import { fireEvent, act } from '@testing-library/react'

vi.useFakeTimers()
fireEvent.pointerDown(card, { pointerType: 'touch', clientX: 50, clientY: 50, button: 0 })

// jsdom-safe pointermove — handler observes the actual coords:
act(() => {
  const moveEvent = new Event('pointermove', { bubbles: true })
  Object.assign(moveEvent, { pointerType: 'touch', clientX: 80, clientY: 50 })
  card.dispatchEvent(moveEvent)
})

act(() => { vi.advanceTimersByTime(600) })
expect(screen.queryByTestId('compact-delete-menu-item')).not.toBeInTheDocument()
vi.useRealTimers()
```

`fireEvent.pointerDown` *does* propagate `clientX`/`clientY` because the start handler stores them via the React synthetic event, which preserves the props passed in. The breakage is specific to `pointermove` in our setup.

## Why This Matters

- A long-press affordance that conflicts with native scroll on iOS gets pulled within a week. The 10px movement threshold is the only thing keeping the card from intercepting scroll gestures.
- A jsdom-broken cancel test silently *passes* because `Math.hypot(undefined - 50, undefined - 50) === NaN` and `NaN > 10` is false, so the timer keeps running. The test author doesn't notice because the long-press case still passes — only the cancel case is misvalidated.
- Controlled `open` on the Radix `DropdownMenu` is required to open it from a timer. The default `<DropdownMenu>` opens only on trigger interaction, which a long-press elsewhere on the card cannot satisfy.

## When to Apply

- Any touch-friendly card that wants both tap-navigates and hold-opens-menu semantics.
- Any vitest unit test that asserts a pointer-move-cancels-timer branch in jsdom.
- Any controlled menu/popover that needs to open from non-trigger gestures.

## Examples

**Failing assertion (silent false-positive direction):**
```ts
fireEvent.pointerMove(card, { clientX: 80, clientY: 50 })
// handler reads e.clientX === undefined, never cancels
```

**Passing assertion:**
```ts
const moveEvent = new Event('pointermove', { bubbles: true })
Object.assign(moveEvent, { clientX: 80, clientY: 50 })
card.dispatchEvent(moveEvent)
// handler reads e.clientX === 80, cancels as expected
```

## Related

- `src/app/components/figma/ImportedCourseCompactCard.tsx` — full implementation
- `src/app/components/figma/__tests__/ImportedCourseCompactCard.test.tsx` — full test suite
- `docs/solutions/best-practices/2026-04-25-e2e-tests-need-guest-mode-init-script-post-e92-auth-gate.md` — sister E99-S03 lesson the E2E spec applied
