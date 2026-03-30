---
story_id: E91-S03
story_name: "Theater Mode"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed:
  - build
  - lint
  - type-check
  - format-check
  - unit-tests
  - e2e-tests
  - design-review
  - code-review
  - code-review-testing
  - performance-benchmark
  - security-review
  - exploratory-qa
burn_in_validated: false
---

# Story 91.03: Theater Mode

## Story

As a learner,
I want to toggle a theater mode in the lesson player,
so that I can watch videos in a distraction-free, full-width layout with the side panel hidden.

## Acceptance Criteria

- AC1: Given the lesson player on desktop (≥1024px), when the theater mode button is clicked, then the video panel expands to full width and the side panel collapses/hides.
- AC2: Given theater mode is active, when the theater mode button is clicked again, then the layout returns to the normal split-panel layout.
- AC3: Given theater mode preference, when the user navigates to another lesson, then theater mode state is preserved (persisted to localStorage).
- AC4: Given the lesson player on mobile (<1024px), the theater mode button is hidden — mobile is already full-width.
- AC5: Given keyboard shortcut `T`, when pressed while in the lesson player, then theater mode toggles.
- AC6: The theater mode button is in `PlayerHeader` with a `Maximize2` / `Minimize2` icon toggle.
- AC7: Given theater mode is active, a `data-theater-mode="true"` attribute is set on the player layout container for CSS targeting.

## Tasks / Subtasks

- [ ] Task 1: Create `src/app/hooks/useTheaterMode.ts` (AC: 3)
  - [ ] 1.1 `const [isTheater, setIsTheater] = useLocalStorage<boolean>('lesson-theater-mode', false)`
  - [ ] 1.2 Export `{ isTheater, toggleTheater }`
- [ ] Task 2: Add theater mode toggle button to `PlayerHeader.tsx` (AC: 6)
  - [ ] 2.1 Accept `isTheater: boolean`, `onToggleTheater: () => void` props
  - [ ] 2.2 Show `Maximize2` when not in theater mode, `Minimize2` when active
  - [ ] 2.3 Hide button on mobile (`hidden lg:flex`)
  - [ ] 2.4 ARIA label: "Enter theater mode" / "Exit theater mode"
- [ ] Task 3: Wire theater mode into `UnifiedLessonPlayer.tsx` (AC: 1, 2, 4, 7)
  - [ ] 3.1 Call `useTheaterMode()` hook
  - [ ] 3.2 Pass `isTheater` / `onToggleTheater` to `PlayerHeader`
  - [ ] 3.3 On desktop: when `isTheater`, collapse `ResizablePanel` for side panel to 0 (imperatively via panel ref)
  - [ ] 3.4 Set `data-theater-mode={isTheater}` on the ResizablePanelGroup container
  - [ ] 3.5 Hide `ResizableHandle` when theater mode active
- [ ] Task 4: Add keyboard shortcut `T` (AC: 5)
  - [ ] 4.1 `useEffect` with `keydown` listener on `document`
  - [ ] 4.2 Only trigger when not focused on input/textarea
  - [ ] 4.3 `if (e.key === 't' || e.key === 'T') toggleTheater()`
  - [ ] 4.4 Cleanup on unmount
- [ ] Task 5: E2E tests
  - [ ] 5.1 Click theater button → side panel hidden, video full-width
  - [ ] 5.2 Click again → returns to split layout
  - [ ] 5.3 Navigate to another lesson → theater mode preserved
  - [ ] 5.4 Mobile viewport → theater button not visible

## Design Guidance

- Button: icon-only, `variant="ghost"`, `size="icon"` in PlayerHeader toolbar
- Icon: `Maximize2` (enter theater) / `Minimize2` (exit theater) from lucide-react
- Side panel collapse: use `panelRef.current?.collapse()` (ResizablePanel imperative API)
- Transition: `transition-all duration-300` on the panel group for smooth collapse
- `data-theater-mode="true"` enables CSS: hide ResizableHandle, adjust padding

## Implementation Notes

- `ResizablePanel` supports imperative collapse via ref: `const panelRef = useRef<ImperativePanelHandle>(null)`
- When theater mode: `panelRef.current?.collapse()` collapses side panel to 0
- When exiting theater: `panelRef.current?.expand()` restores previous size
- `useLocalStorage` hook — check if it exists in codebase or use: `import { useLocalStorage } from 'usehooks-ts'` (already a dep)
- The `ResizablePanelGroup` already has `defaultSize` on each panel — theater mode overrides this imperatively
- Mobile: already full-width (no ResizablePanelGroup on mobile — uses Sheet) — skip theater mode for mobile

## Testing Notes

- Use `page.setViewportSize({ width: 1440, height: 900 })` for desktop tests
- Check `data-theater-mode` attribute: `expect(await page.locator('[data-theater-mode]').getAttribute('data-theater-mode')).toBe('true')`
- For localStorage persistence: navigate away and back, check theater mode still active
- Skip mobile test if theater mode button is `hidden lg:flex` (not in DOM on mobile)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] Keyboard shortcut only fires when not in input/textarea
- [ ] Panel collapse/expand doesn't break ResizablePanelGroup layout
- [ ] ARIA labels on theater toggle button
- [ ] No hardcoded colors

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
