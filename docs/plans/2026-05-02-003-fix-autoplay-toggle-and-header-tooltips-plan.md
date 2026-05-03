---
title: fix: Auto-play toggle visual feedback, immediate playback, and header tooltips (deepened)
type: fix
status: active
date: 2026-05-02
deepened: 2026-05-03, 2026-05-03-r2, 2026-05-03-r3, 2026-05-03-r4
origin: docs/plans/2026-05-02-002-feat-course-lesson-player-polish-plan.md
---

# fix: Auto-play toggle visual feedback, immediate playback, and header tooltips

## Overview

Three fixes to the lesson player header toolbar:

1. **Auto-play toggle** has almost no visual feedback — the icon dims slightly when off, but users can't tell the button's state or whether it even works
2. **Toggling auto-play ON** has no effect on the currently loaded video — it only influences the *next* lesson navigation. Users expect the current video to start playing when they enable auto-play
3. **Some toolbar icons lack tooltips** — only auto-play and reading mode have tooltips; theater mode, pomodoro, and QA chat don't

## Problem Frame

The auto-play toggle in `LessonHeaderTools` only modifies a localStorage + Zustand boolean. The `UnifiedLessonPlayer` reads this boolean **only** from React Router navigation state (set by auto-advance), never from the store directly. This means:

- On initial page load with auto-play ON in localStorage, the video does not auto-play
- When the user toggles auto-play ON while viewing a video, nothing happens — the current video stays paused
- The toggle's visual state change is imperceptible (`text-muted-foreground` on the icon when off)

The theater toggle, pomodoro timer, and QA chat panel also lack hover tooltips, making them less discoverable than the reading mode and auto-play toggles which do have tooltips.

## Requirements Trace

- **R1** — Auto-play toggle has clear on/off visual state (not just a dimmed icon)
- **R2** — Toggling auto-play ON immediately starts the current video (local videos only)
- **R3** — When a lesson page loads with auto-play ON in the store, the video auto-plays (no router state needed)
- **R4** — Every icon-only button in the header toolbar has a tooltip on hover (text-labeled buttons like "Notes" and completion status are self-describing and excluded)

## Scope Boundaries

- No changes to how auto-advance (next-lesson navigation) works — that flow is unchanged
- No changes to YouTube auto-play behavior (YouTube doesn't receive the autoplay prop)
- No changes to PDF content (autoplay only applies to local video)
- Tooltips are added only to the lesson header toolbar icons, not to every icon in the app

### Deferred to Separate Tasks

- YouTube video auto-play support: separate enhancement (YouTube iframe API has its own autoplay semantics)
- Reading Mode icon removal from the lesson header toolbar: cosmetic UX preference, not a bug fix. The feature remains accessible via `Cmd+Option+R` and BottomNav. Will be addressed in a follow-up plan focused on toolbar simplification

## Context & Research

### Relevant Code and Patterns

- **Toggle button**: [src/app/components/course/LessonHeaderTools.tsx](src/app/components/course/LessonHeaderTools.tsx) lines 168-185 (desktop inline) and 220-226 (tablet kebab)
- **Store**: [src/stores/useLessonChromeStore.ts](src/stores/useLessonChromeStore.ts) — `autoPlay` boolean and `toggleAutoPlay()` action, persisted to localStorage key `lesson-auto-play`, defaults to `true`
- **Player page**: [src/app/pages/UnifiedLessonPlayer.tsx](src/app/pages/UnifiedLessonPlayer.tsx) line 97 — `shouldAutoPlay` reads only from `location.state`, not from the store. Line 385 — passes `autoplay={shouldAutoPlay}` to `LessonContentRenderer`
- **Content renderer**: [src/app/components/course/LessonContentRenderer.tsx](src/app/components/course/LessonContentRenderer.tsx) line 130 — passes `autoplay` to `LocalVideoContent` only (not YouTube)
- **Video player**: [src/app/components/figma/VideoPlayer.tsx](src/app/components/figma/VideoPlayer.tsx) lines 224-241 — autoplay `useEffect` watches `[autoplay, src]`. Tries unmuted first; falls back to muted if browser blocks
- **Completion flow**: [src/app/hooks/useCompletionFlow.ts](src/app/hooks/useCompletionFlow.ts) lines 147-154 — `handleAutoAdvance()` reads `autoPlay` from store and passes it as router state when navigating to next lesson
- **Test file**: [src/app/components/course/__tests__/LessonHeaderTools.test.tsx](src/app/components/course/__tests__/LessonHeaderTools.test.tsx) — existing tests don't cover auto-play toggle or tooltips
- **Tooltip component**: [src/app/components/ui/tooltip.tsx](src/app/components/ui/tooltip.tsx) — shadcn/ui `Tooltip`, `TooltipTrigger`, `TooltipContent` already used for reading mode and auto-play toggles
- **Existing toolbar pattern**: Theater mode toggle changes icon (`Maximize2`/`Minimize2`) based on state; Reading mode toggle uses `aria-pressed`; Auto-play dims icon via `cn('size-5', !autoPlay && 'text-muted-foreground')`

### Institutional Learnings

None directly relevant to this fix.

## Key Technical Decisions

- **Brand-ghost variant for ON state**: Use `variant="brand-ghost"` when auto-play is ON, `variant="ghost"` when OFF. This is consistent with the design token system and provides clear visual distinction without being overly prominent. Removes the `text-muted-foreground` class-based dimming in favor of variant-based styling.
- **Prop-driven playback via VideoPlayer's existing effect**: The `shouldAutoPlay` value (OR-combined from router state + store) is passed as the `autoplay` prop to `LessonContentRenderer` → `LocalVideoContent` → `VideoPlayer`. VideoPlayer's existing `useEffect` watches `[autoplay, src]` (lines 224-241) and calls `play()` when either changes. This single mechanism handles all three scenarios: (1) initial load with store ON — `shouldAutoPlay` is `true` on mount, effect fires; (2) toggle ON mid-page — `shouldAutoPlay` transitions `false→true`, prop changes, effect re-fires; (3) auto-advance navigation — router state carries `autoPlay: true`, OR-combine produces `true`, effect fires on mount. No additional effects or ref-based `play()` calls needed in UnifiedLessonPlayer.
- **OR-combine store + router state**: `shouldAutoPlay` = `parseLocationFlag(location.state, 'autoPlay') || store.autoPlay`. The router state is a one-shot transient signal set by auto-advance only when the user's stored autoPlay preference is ON (see `useCompletionFlow.ts:149-152` — `handleAutoAdvance` reads `useLessonChromeStore.getState().autoPlay` and navigates with `{ autoPlay: true }` only when the store says ON). The store is the persistent user preference. Combining them means: auto-advance auto-plays only when the user prefers it (via router state reflecting the store), AND manual navigation auto-plays if the user prefers it (via the store directly). Both paths respect the same preference — there is no override.

## Implementation Units

- [ ] **Unit 1: Improve auto-play toggle visual feedback**

**Goal:** Make the auto-play toggle clearly show on/off state with brand coloring and proper ARIA

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/components/course/LessonHeaderTools.tsx`
- Modify: `src/app/components/course/__tests__/LessonHeaderTools.test.tsx`

**Approach:**
- Desktop inline toggle (lines 168-185): Replace `variant="ghost"` + `text-muted-foreground` class hack with `variant={autoPlay ? 'brand-ghost' : 'ghost'}`, remove the `cn` className from the icon, add `aria-pressed={autoPlay}`
- Tablet kebab item (lines 220-226): No visual change needed — kebab items already show text "Auto-play: On/Off"
- Remove `text-muted-foreground` import from `cn` usage for this icon (the `cn` import itself stays since it's used elsewhere)

**Patterns to follow:**
- Theater mode toggle (icon swap pattern) for `aria-label` dynamic text
- Reading mode toggle for `aria-pressed` usage

**Test scenarios:**
- Happy path: Renders auto-play toggle with `aria-pressed="true"` when autoPlay is ON
- Happy path: Renders auto-play toggle with `aria-pressed="false"` when autoPlay is OFF
- Happy path: Toggle button uses `variant="brand-ghost"` when ON
- Happy path: Toggle button uses `variant="ghost"` when OFF
- Happy path: Clicking the toggle calls `toggleAutoPlay()` on the store
- Happy path: Tooltip shows "Auto-play: On" when ON
- Happy path: Tooltip shows "Auto-play: Off" when OFF
- Edge case: Tablet kebab item shows current state as text

**Verification:**
- The auto-play toggle icon is visibly brand-colored when ON and default ghost when OFF
- `aria-pressed` reflects the current state
- Existing tests for other toolbar buttons still pass

---

- [ ] **Unit 2: Wire auto-play toggle to current video playback**

**Goal:** When auto-play is toggled ON, the currently loaded video starts playing. On initial page load with auto-play ON, the video auto-plays without needing router state.

**Requirements:** R2, R3

**Dependencies:** None (Independent of Unit 1 — touches disjoint files. Both units depend on the existing `useLessonChromeStore` Zustand store, which is unchanged by either)

**Files:**
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx`

**Approach:**
1. Add a new `const storeAutoPlay = useLessonChromeStore(s => s.autoPlay)` subscription (the store is already imported at line 72, but `autoPlay` is not currently subscribed in this component)
2. Derive `shouldAutoPlay` from both sources: `parseLocationFlag(location.state, 'autoPlay') || storeAutoPlay`
3. **Fix the router state clearing effect (lines 100-104):** The existing effect checks `shouldAutoPlay && location.state` before clearing. After the change, `shouldAutoPlay` is the OR-combined value — when `storeAutoPlay` is ON, `shouldAutoPlay` is always `true`, and `{}` (the cleared state) is truthy. This creates an infinite loop: `shouldAutoPlay && location.state` → `true && {}` → `true` → `navigate({state:{}})` → new `{}` ref → effect re-fires. **Fix:** scope the clearing condition to the parsed flag only: `parseLocationFlag(location.state, 'autoPlay') && location.state`. After clearing, `parseLocationFlag({}, 'autoPlay')` returns `false`, and the loop terminates. The dependency array stays `[shouldAutoPlay, location.pathname, location.state, navigate]` — harmless since `shouldAutoPlay` is stable (constant `true` when store is ON).
4. No additional effect needed for toggle-to-playback: VideoPlayer's existing `useEffect` watches `[autoplay, src]` (lines 224-241) and calls `play()` when either changes. When the user toggles autoPlay ON mid-page, `shouldAutoPlay` transitions from `false` → `true`, the `autoplay` prop changes, and VideoPlayer's effect re-fires and starts playback. Same for initial load — if `storeAutoPlay` is ON, `shouldAutoPlay` is `true` on mount, VideoPlayer's effect fires, and playback begins. No ref-based `play()` calls or `playPendingRef` flags needed.
5. Do NOT watch `storeAutoPlay` for other transitions — toggling OFF does NOT pause the video. Only `false→true` triggers playback (via the prop change and VideoPlayer's existing effect).

**Patterns to follow:**
- Existing `useLessonChromeStore` subscriptions in the same file (lines 133-135) for selector pattern
- VideoPlayer's autoplay `useEffect` (lines 224-241) already handles browser autoplay policy (tries unmuted, falls back to muted)

**Test approach:** Since the implementation relies on prop-driven behavior (VideoPlayer's existing `useEffect([autoplay, src])` handles playback), unit tests should verify that `shouldAutoPlay` computes correctly from both sources and that the `autoplay` prop passed to `LessonContentRenderer` reflects the expected value under different store + router state combinations. Full browser autoplay behavior (unmuted-fallback-to-muted) is covered by VideoPlayer's existing tests.

**Test prerequisites:** The `UnifiedLessonPlayer` test file has no existing `useLessonChromeStore` mock. A new mock must be created from scratch providing `autoPlay: boolean` and `toggleAutoPlay: vi.fn()` selectors with exposed setters for test control. The component currently reads `notesOpen`/`toggleNotes`/`setNotesOpen` from the store (lines 133-135) — those selectors must also be included in the new mock to avoid breaking existing tests.

**E2E coverage:** The auto-advance → next-lesson → auto-play integration path is an E2E test scenario (Chromium). The test should: (1) seed a course with autoPlay ON in localStorage, (2) complete a lesson and let auto-advance fire, (3) verify the next lesson's video element starts playing. This is described here for traceability; the implementer should add it to the existing `tests/e2e/lesson-header-toolbar-merge.spec.ts` or create `tests/e2e/lesson-player.spec.ts` as appropriate.

**Test scenarios:**
- Happy path: `shouldAutoPlay` is `true` when store autoPlay is ON and no router state — verify `autoplay` prop is `true`
- Happy path: `shouldAutoPlay` is `false` when store autoPlay is OFF and no router state — verify `autoplay` prop is `false`
- Happy path: `shouldAutoPlay` is `true` when router state has `autoPlay: true` (auto-advance with store ON)
- Happy path: `shouldAutoPlay` is `false` when router state has no autoPlay flag and store is OFF
- Edge case: When store autoPlay is OFF, auto-advance navigates without the autoPlay flag, so `shouldAutoPlay` is `false` (consistent with `handleAutoAdvance` reading the store at `useCompletionFlow.ts:149`)
- Edge case: Page refresh with autoPlay ON doesn't re-trigger playback — the clearing effect scoped to `parseLocationFlag` removes router state without looping
- Edge case: Router state clearing effect does NOT infinite-loop when `storeAutoPlay` is ON (verify `parseLocationFlag` condition breaks the loop)
- Integration: Auto-advance → `shouldAutoPlay` is true (router state) → `autoplay` prop is `true` → VideoPlayer's effect handles playback

**Verification:**
- Manually navigate to a video lesson with auto-play ON → video starts playing without clicking Play
- While watching a video, toggle auto-play OFF then ON → video resumes playing
- Auto-advance countdown → navigate to next lesson → video auto-plays (existing flow preserved)

---

- [ ] **Unit 3: Add tooltips to remaining toolbar icons**

**Goal:** Every icon button in the lesson header toolbar has a hover tooltip

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/app/components/course/LessonHeaderTools.tsx`
- Modify: `src/app/components/course/__tests__/LessonHeaderTools.test.tsx`
- Modify: `src/app/components/figma/PomodoroTimer.tsx` — accept optional `tooltipLabel` prop, render `<Tooltip>` internally around trigger button
- Modify: `src/app/components/figma/QAChatPanel.tsx` — accept optional `tooltipLabel` prop, render `<Tooltip>` internally around trigger button

**Approach:**
- **Theater mode toggle**: Wrap in `<Tooltip>` + `<TooltipTrigger asChild>` + `<TooltipContent>` directly in LessonHeaderTools (simple button, no compound component issue). Tooltip text: "Enter theater mode" / "Exit theater mode" based on `isTheater` state
- **PomodoroTimer and QAChatPanel**: External `<TooltipTrigger asChild>` wrapping was investigated and found problematic. While Radix `TooltipTrigger` with `asChild` is designed to compose with other Radix primitives (e.g., `<TooltipTrigger asChild><PopoverTrigger asChild><Button/></PopoverTrigger></TooltipTrigger>` works when all triggers are in the same render tree), both components encapsulate compound `<Popover>` / `<Sheet>` as their root element. The TooltipTrigger's `asChild` clone would land on the `Popover` context provider or `Sheet` wrapper, not the internal trigger `<Button>`. Ref-forwarding through the compound component would require a non-trivial API change to both components. The prop-based approach is simpler and avoids ref-forwarding complexity:
  - Add an optional `tooltipLabel?: string` prop to both components
  - When the prop is provided, each component wraps its own internal trigger `<Button>` in `<Tooltip>` + `<TooltipTrigger asChild>` + `<TooltipContent>`
  - Pass `tooltipLabel="Focus Timer"` and `tooltipLabel="Ask AI"` from LessonHeaderTools
  - The tooltip must wrap only the trigger button, not the entire Popover/Sheet, to avoid the tooltip appearing on top of the open panel
- All icon-only buttons retain or add `aria-label` attributes for touch device accessibility (hover tooltips never fire on touch)

**Patterns to follow:**
- Auto-play toggle tooltip (lines 169-185) for the `<Tooltip>`, `<TooltipTrigger asChild>`, `<TooltipContent>` structure

**Test scenarios:**
- Happy path: Theater mode button has tooltip "Enter theater mode" when inactive
- Happy path: Theater mode button has tooltip "Exit theater mode" when active
- Happy path: Pomodoro timer has tooltip "Focus Timer" (rendered internally by PomodoroTimer)
- Happy path: QA chat button has tooltip "Ask AI" (rendered internally by QAChatPanel)
- Happy path: Auto-play toggle still has tooltip "Auto-play: On/Off"
- Edge case: All icon-only buttons have descriptive `aria-label` attributes for touch device users

**Verification:**
- Hovering over each toolbar icon shows a tooltip with descriptive text
- No icon is left without a tooltip
- Tooltips do not layer on top of open popovers/sheets
- Touch devices can still identify buttons via `aria-label`

## System-Wide Impact

- **Interaction graph:** The store-based auto-play read in `UnifiedLessonPlayer` adds a new subscription. `toggleAutoPlay()` now has a downstream effect (immediate video playback) it didn't have before.
- **Error propagation:** Browser autoplay policy may still block playback — VideoPlayer's existing fallback (muted retry) handles this gracefully. No additional error handling needed in UnifiedLessonPlayer since all playback is delegated to VideoPlayer's existing `useEffect([autoplay, src])`.
- **State lifecycle risks:** The `autoPlay` store value is never reset by `reset()`, so it persists across route changes. This is intentional — it's a user preference, not a transient UI state.
- **Unchanged invariants:** Auto-advance flow (`useCompletionFlow`) is not modified — it continues to read the store before navigating (line 149). Router state-based auto-play still works. YouTube video behavior unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Browser blocks unmuted autoplay on initial load (no user gesture) | VideoPlayer already handles this — falls back to muted autoplay. User can unmute via the volume control |
| Store subscription in UnifiedLessonPlayer causes unnecessary re-renders | Zustand selectors are reference-stable for primitive values — `autoPlay` is a boolean, so re-renders only happen when it actually changes |

## Sources & References

- **Origin document:** [docs/plans/2026-05-02-002-feat-course-lesson-player-polish-plan.md](2026-05-02-002-feat-course-lesson-player-polish-plan.md) (R4-R6 for auto-play context)
- Related code: [src/app/components/course/LessonHeaderTools.tsx](src/app/components/course/LessonHeaderTools.tsx)
- Related code: [src/stores/useLessonChromeStore.ts](src/stores/useLessonChromeStore.ts)
- Related code: [src/app/pages/UnifiedLessonPlayer.tsx](src/app/pages/UnifiedLessonPlayer.tsx)
- Related code: [src/app/components/figma/VideoPlayer.tsx](src/app/components/figma/VideoPlayer.tsx)
- Related PR: #484 (lesson toolbar merge into Layout header)
