---
title: feat: Add manual module completion with undo, unlock, and animations
type: feat
status: completed
date: 2026-05-09
---

# feat: Add manual module completion with undo, unlock, and animations

## Overview

Adds the ability to manually mark syllabus modules as completed on the learning track detail page (`/learning-tracks/:trackId`). When a module is marked complete, it visually changes state, unlocks the next module, and updates the progress sidebar. An undo toast allows reverting the completion. Subtle animations enhance the expansion/collapse and unlock transitions.

## Problem Frame

Currently, module status in the `PathTimeline` is derived solely from lesson-level video watch progress. There is no way to manually mark a module as "done" — users must watch every video to 90%+ to progress through the track. This blocks users who want to skip content they already know, use the track as a checklist, or manually control their pacing. The track timeline should support both automatic (watch-based) and manual completion to give users agency over their learning path.

## Requirements Trace

- **R1.** Users can mark any unlocked module (in-progress) as completed with a single click
- **R2.** Marking a module complete visually transforms its status indicator (status circle, card border, status badge) and unlocks the next module
- **R3.** An undo toast appears after marking complete, allowing the user to revert within a time window
- **R4.** The progress sidebar (completion %, modules completed count, estimated time) updates immediately to reflect manual completions
- **R5.** Module expansion/collapse animates smoothly (currently a hard toggle)
- **R6.** When a module unlocks (transitions from locked → in-progress), a subtle entrance animation plays

## Scope Boundaries

- Manual completion only applies within the learning track detail page — not on the `/learning-paths/:pathId` editor page
- Manual completion is stored per-track in localStorage (no schema migration needed)
- Module status reconciliation: manual completion takes precedence over auto-derived status. Undoing a manual completion falls back to the computed lesson-progress status
- This plan does NOT add bulk mark-all-complete, module-level progress sliders, or module reordering
- The existing "Start Module" / "Review" CTA buttons remain unchanged; the "Mark Complete" action is additive

## Context & Research

### Relevant Code and Patterns

- **`src/app/pages/LearningTrackDetail.tsx`** — Detail page; passes data to `PathTimeline` and `PathProgressSidebar`
- **`src/app/components/learning-path/PathTimeline.tsx`** — Syllabus timeline with `CourseTimelineEntry`, `StatusCircle`, `EntryActionButton`, expand/collapse toggle via `isExpanded` state
- **`src/app/components/learning-path/PathProgressSidebar.tsx`** — Progress ring + stats (completedCourses/totalCourses, estimated time)
- **`src/stores/useContentProgressStore.ts`** — Lesson-level completion; `setItemStatus()` with optimistic update + rollback + cascade; `deriveModuleStatus()` computes module status from children
- **`src/stores/useLearningPathStore.ts`** — `deletePathWithUndo()` pattern: 5-second Sonner toast with Undo button; removes path via `pendingDeletes` timer
- **`src/app/hooks/usePathProgress.ts`** — `PathProgressSummary` with `completionPct`, `completedCourses`, `completedLessons`, etc.
- **`src/styles/animations.css`** — CSS animation library: `fadeIn`, `badgeEntrance` (spring scale), `progress-animate`, duration standards
- **`src/lib/motion.ts`** — framer-motion variants: `staggerContainer`, `fadeUp`, `scaleIn`

### Institutional Learnings

- **Undo pattern** (`docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md`): `deletePathWithUndo` uses a `pendingDeletes` record in the Zustand store with a 5-second `setTimeout` — clean and battle-tested
- **rAF hydration guard**: `LearningTrackDetail` uses `requestAnimationFrame` after `Promise.all` to avoid flash-of-not-found on direct URL nav. Any new state initialization must respect this timing
- **Two-phase loading**: Data fetch (`isReady`) is separate from render readiness (`entriesChecked`) — manual completion state must be loaded after `isReady`

### External References

None — local patterns are sufficient.

## Key Technical Decisions

- **localStorage over Dexie table**: Manual completions are stored as a JSON array of entry IDs keyed by `trackId` (`track-manual-completions-${trackId}`). This avoids a schema migration for a UI-level feature that doesn't need sync or query capabilities. The data is small (entry IDs only), ephemeral (it augments computed progress, not replaces it), and scoped to the track detail page
- **Combined status computation**: Module status = max(auto progress, manual completion). If `completionPct >= 100` OR entry is in manual set → completed. If follows a completed entry (manual or auto) and not itself completed → in-progress (unlocked). Otherwise → locked
- **Undo via Sonner toast + setTimeout**: Follows the same pattern as `deletePathWithUndo` in the learning path store. Show a toast with "Undo" action; on expiry remove the manual completion; on undo clear the timer
- **Animations via framer-motion `AnimatePresence`**: For expand/collapse content height and unlock entrance. CSS transitions for status circle morphing and card border color changes. All respect `prefers-reduced-motion` via `useReducedMotion()`

## Open Questions

### Resolved During Planning

- **Where to store manual completion state**: localStorage, keyed by `trackId`. No Dexie migration needed
- **How undo interacts with lesson-level progress**: Manual completion is independent. Undoing a manual completion reverts to the lesson-derived status
- **Whether to show the Mark Complete button on locked modules**: No — locked modules cannot be interacted with. Only in-progress modules get the Mark Complete action

### Deferred to Implementation

- Exact localStorage key format — resolved during hook implementation
- Toast duration (3s vs 5s) — use 5s to match existing undo pattern, adjust if user feedback differs
- Animation easing curves for expand/collapse — start with `cubic-bezier(0.16, 1, 0.3, 1)` (matches `animate-slide-up`), tune visually

## Implementation Units

- [ ] **Unit 1: Manual completion state hook (`useManualModuleCompletion`)**

**Goal:** Create a reusable hook that manages the set of manually completed entry IDs, persisted to localStorage

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Create: `src/app/hooks/useManualModuleCompletion.ts`
- Test: `src/app/hooks/__tests__/useManualModuleCompletion.test.ts`

**Approach:**
- Hook accepts `trackId: string` and returns `{ completedIds: Set<string>, markComplete, undoComplete, isManuallyCompleted }`
- Initialize from localStorage on mount: `JSON.parse(localStorage.getItem(\`track-manual-completions-${trackId}\`) ?? '[]')`
- `markComplete(entryId)`: add to Set, persist to localStorage, return a cleanup function (for the undo timer)
- `undoComplete(entryId)`: remove from Set, persist to localStorage
- `isManuallyCompleted(entryId)`: O(1) lookup
- Handle missing/corrupt localStorage gracefully — fall back to empty set

**Execution note:** Write the hook test-first — verify localStorage read/write, add/remove/check operations, and corrupt data fallback

**Patterns to follow:**
- `src/app/hooks/usePathProgress.ts` — hook structure, reactive state
- `src/stores/useLearningPathStore.ts` — `deletePathWithUndo` undo pattern (timer + toast)

**Test scenarios:**
- Happy path: `markComplete` adds entry ID to set and persists to localStorage
- Happy path: `undoComplete` removes entry ID from set and updates localStorage
- Happy path: `isManuallyCompleted` returns true for added IDs, false for others
- Edge case: Empty trackId — returns empty set, operations are no-ops
- Edge case: Corrupt localStorage JSON — falls back to empty set without crashing
- Edge case: Multiple entries for the same track — all tracked independently

**Verification:**
- Hook compiles and passes all unit tests
- localStorage read/write verified in tests

---

- [ ] **Unit 2: Add Mark Complete / Undo Complete actions to PathTimeline**

**Goal:** Add completion toggle buttons to `CourseTimelineEntry` and wire status computation to include manual completions

**Requirements:** R1, R2, R3

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/learning-path/PathTimeline.tsx`
- Test: `src/app/components/learning-path/__tests__/PathTimeline.test.tsx`

**Approach:**
- Add `manuallyCompletedIds?: Set<string>` and `onMarkComplete?: (entryId: string) => void` props to `PathTimeline` and `CourseTimelineEntry`
- Add a "Mark as Complete" button (CheckCircle2 icon) to in-progress entries in `EntryActionButton`. Place it after the existing CTA button
- For manually completed entries, show an "Undo" button (RotateCcw icon) that calls `onMarkComplete` (toggles off)
- Adjust status computation in the parent `PathTimeline`:
  ```
  isCompleted = (info?.completionPct >= 100) || manuallyCompletedIds.has(entry.id)
  isLocked = !isCompleted && !isInProgress
  // isInProgress logic: entry follows the last completed entry in sequence
  ```
- Finding "next unlocked" module: iterate entries in order; the first non-completed, non-gap entry after the last completed one is in-progress
- Locked card gets `pointer-events-none opacity-60` (existing behavior) — manually completed entries should never be locked

**Execution note:** Update component tests for the new button rendering and status logic

**Patterns to follow:**
- `EntryActionButton` existing pattern — add button variants for the new actions
- `deletePathWithUndo` undo toast pattern — Sonner `toast()` with `action` prop

**Test scenarios:**
- Happy path: In-progress module shows "Mark as Complete" button
- Happy path: Clicking "Mark as Complete" calls `onMarkComplete` with the entry ID
- Happy path: Manually completed entry shows checkmark status circle and "Completed" badge
- Happy path: Manually completed entry unlocks the next module (next entry becomes in-progress)
- Happy path: Undo button appears on manually completed modules
- Edge case: Last module in track — marking complete shows "All courses completed" banner
- Edge case: Locked modules do not show completion button
- Edge case: Gap entries are unaffected by manual completion logic
- Integration: Module marked complete → progress sidebar updates count

**Verification:**
- Component renders correct buttons per module state
- Status circles and card borders reflect manual completion
- Undo restores previous state
- Component tests pass

---

- [ ] **Unit 3: Wire manual completion into LearningTrackDetail page**

**Goal:** Integrate the `useManualModuleCompletion` hook into the detail page, pass data to child components, and manage undo toasts

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/app/pages/LearningTrackDetail.tsx`
- Test: `src/app/pages/__tests__/LearningPathDetail.test.tsx`

**Approach:**
- Import and use `useManualModuleCompletion(trackId!)` in the page component
- Compute enhanced progress summary: `completedCourses` should include manually completed entries not already counted in `pathProgress.completedCourses`
- Create a derived `enhancedProgress` object that merges manual completions with `pathProgress`:
  - `completedCourses = pathProgress.completedCourses + manualEntriesNotInAutoProgress`
  - `completionPct = (completedCourses / totalCourses) * 100`
- Pass `manuallyCompletedIds` and an `onMarkComplete` handler to `PathTimeline`
- Pass `enhancedProgress` to `PathProgressSidebar` instead of raw `pathProgress`
- `onMarkComplete` handler:
  1. Call `markComplete(entryId)` from the hook
  2. Show Sonner toast with "Module marked as complete" and "Undo" action
  3. On toast dismiss (timeout), keep the completion
  4. On "Undo" click, call `undoComplete(entryId)` and dismiss the toast
- Handle the edge case where manual completion causes "All courses completed" banner to appear

**Patterns to follow:**
- Existing toast handling in `LearningTrackDetail.tsx` (catch blocks use `toast.error()`)
- `deletePathWithUndo` in `useLearningPathStore.ts` for the setTimeout + undo pattern

**Test scenarios:**
- Happy path: Marking a module complete updates the progress sidebar immediately
- Happy path: Undoing a completion reverts sidebar and timeline status
- Edge case: Manual completion after all modules auto-completed — no double-counting
- Edge case: Track with only gap entries — manual completion is a no-op
- Edge case: Rapid mark/undo/mark — no state corruption

**Verification:**
- Progress ring updates within one render cycle of mark/undo
- "Modules Completed" count increments/decrements correctly
- Toast appears and Undo works
- Page tests updated

---

- [ ] **Unit 4: Add animations for expand/collapse and unlock**

**Goal:** Add smooth height animation to module expand/collapse and a subtle entrance animation when a module unlocks

**Requirements:** R5, R6

**Dependencies:** Unit 2 (PathTimeline modifications)

**Files:**
- Modify: `src/app/components/learning-path/PathTimeline.tsx`
- Modify: `src/styles/animations.css` (add unlock keyframes if needed)

**Approach:**
- **Expand/collapse**: Wrap the expanded lesson list content in `<AnimatePresence>` + `motion.div` with height animation (`animate: { height: 'auto', opacity: 1 }`, `exit: { height: 0, opacity: 0 }`). Replace the current hard `{isExpanded && ...}` conditional render
- **Unlock animation**: When a module transitions from locked → in-progress (determined by comparing current vs previous `isLocked` state via `useRef`), apply a `scaleIn` variant to the card. Use `motion.div` with `key={entry.id + (isLocked ? 'locked' : 'unlocked')}` to trigger re-mount animation
- **Completion animation**: The `StatusCircle` already handles visual state via props. Add a CSS transition on `background-color` and `border-color` for smooth status changes (`transition-all duration-300`)
- Respect `prefers-reduced-motion` — all animations disabled when the user's OS setting is active (existing `useReducedMotion()` pattern)
- Add CSS keyframe `@keyframes unlockGlow` — a brief (600ms) box-shadow pulse from brand-soft to transparent for the unlock effect

**Execution note:** Verify animations in browser — CSS-only unit tests can't validate animation quality

**Patterns to follow:**
- `src/lib/motion.ts` — `scaleIn` variant (scale 0.96→1, 0.4s) for unlock entrance
- `src/styles/animations.css` — `badge-entrance` spring pattern (200ms, `cubic-bezier(0.34, 1.56, 0.64, 1)`)
- framer-motion `AnimatePresence` usage in `src/app/components/course/TemplateCard.tsx`

**Test scenarios:**
- Happy path: Expanding a module shows smooth height transition
- Happy path: Collapsing a module shows smooth height transition
- Happy path: When a module unlocks (previous module marked complete), it animates in with scale+fade
- Edge case: `prefers-reduced-motion` disables all new animations
- Edge case: Rapid expand/collapse clicks don't cause animation glitches

**Verification:**
- Visual check: expand/collapse is smooth (not instant)
- Visual check: unlock animation plays once when next module becomes available
- Automated: animation classes applied; `prefers-reduced-motion` respected

---

- [ ] **Unit 5: Update progress sidebar count for manual completions**

**Goal:** Ensure the `PathProgressSidebar` "Modules Completed" count and progress ring reflect manual completions

**Requirements:** R4

**Dependencies:** Unit 3

**Files:**
- Modify: `src/app/components/learning-path/PathProgressSidebar.tsx` (minor — verify no changes needed since Unit 3 passes `enhancedProgress`)
- Test: `src/app/components/learning-path/__tests__/PathProgressSidebar.test.tsx`

**Approach:**
- The sidebar already accepts a `progress: PathProgressSummary` prop and renders `completedCourses` and `completionPct`
- Unit 3 computes `enhancedProgress` with inflated `completedCourses` count — the sidebar should render correctly without internal changes
- Verify that the progress ring `PathProgressRing` animates smoothly to the new percentage (it already uses `transition-[stroke-dashoffset] duration-500`)
- If the sidebar shows "Estimated Time Left", consider whether manual completions should reduce it proportionally — yes, recompute as `estimatedRemainingHours * (remainingCourses / totalCourses)`

**Patterns to follow:**
- Same prop interface — no breaking changes to `PathProgressSidebar`

**Test scenarios:**
- Happy path: After manual completion, "Modules Completed" shows correct count
- Happy path: Progress ring percentage matches `(completedCourses / totalCourses) * 100`
- Edge case: All modules completed manually — shows 100% and "All courses completed" state
- Edge case: Mixed manual + auto completion — no double-counting

**Verification:**
- Sidebar test updated to cover manual completion scenarios
- Progress ring percentage is always `completedCourses / totalCourses * 100`

## System-Wide Impact

- **Interaction graph:** `LearningTrackDetail` → `useManualModuleCompletion` (new hook) → `PathTimeline` + `PathProgressSidebar` (modified props). No changes to stores, sync layer, or routes
- **Error propagation:** Manual completion failures (localStorage write errors) are non-critical — catch silently, show toast warning, state remains in-memory for the session
- **State lifecycle risks:** localStorage can be cleared by the browser; manual completions are ephemeral and don't affect the source-of-truth lesson progress. If localStorage is cleared, modules revert to their lesson-derived status — no data loss
- **API surface parity:** Not applicable — this is a UI-layer feature in the tracks detail page only. The `/learning-paths/:pathId` editor page does not share this behavior
- **Integration coverage:** The mark-complete → unlock → update-sidebar flow spans the hook, timeline, and sidebar. Test this integration in Unit 3's page tests
- **Unchanged invariants:** Lesson-level progress in `useContentProgressStore` is untouched. The `usePathProgress` hook is unchanged. The `PathTimeline` is backward-compatible — all new props are optional with sensible defaults

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Manual completion conflicts with auto-progress (user marks complete, then watches a video that would have completed it) | Manual completion is additive — it only raises status, never lowers it. If auto-progress also completes, status stays completed. No conflict |
| localStorage quota exceeded | Entry IDs are short strings (~36 chars); a track with 100 modules uses ~4KB. localStorage quota is 5-10MB. Extremely unlikely to be an issue |
| Undo timer fires after component unmount (user navigates away) | The `markComplete` function returns a cleanup callback. Use `useEffect` cleanup to call it on unmount — but actually, we want completion to persist across navigation. Only clear the timer callback, not the completion itself |

## Verification

1. **Unit tests pass**: `npm run test:unit` — all 5 implementation unit test files
2. **Build succeeds**: `npm run build` — no type errors or import issues
3. **Manual browser testing**:
   - Navigate to `/learning-tracks/:trackId` with a track that has multiple courses
   - Verify "Mark as Complete" button appears on in-progress modules
   - Click it — verify status circle changes to checkmark, card border turns green, next module unlocks
   - Verify undo toast appears — click Undo, verify status reverts
   - Verify progress sidebar updates immediately (ring + modules count)
   - Click to expand a module — verify smooth height animation
   - Mark a module complete — verify next module has unlock entrance animation
4. **E2E tests**: Update `tests/e2e/learning-tracks.spec.ts` to cover the mark-complete flow
