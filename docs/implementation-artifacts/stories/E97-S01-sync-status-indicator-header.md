---
story_id: E97-S01
story_name: "Sync Status Indicator in Header"
status: ready-for-dev
started: 2026-04-19
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 97.01: Sync Status Indicator in Header

## Story

As a Knowlune user with data syncing across devices,
I want a visible sync status indicator in the app header that reflects real-time sync health,
so that I can trust my notes, flashcards, and progress are safely replicated and know immediately when something is wrong.

## Acceptance Criteria

**AC1 — Status icon reflects current sync state**
- **Given** I am signed in and the app is mounted,
- **When** the sync engine transitions between states,
- **Then** the header renders a single status icon that updates reactively:
  - `synced` → green check (`check` / `cloud-check`) using `text-success`
  - `syncing` → animated spinner (`loader-2` with `animate-spin`) using `text-brand`
  - `error` → red X / alert (`cloud-alert` or `x-circle`) using `text-destructive`
  - `offline` → grey cloud-off (`cloud-off`) using `text-muted-foreground`
- The icon is placed in the header action cluster between `TrialIndicator` and the theme toggle, sits on a 44×44 hit target, and uses `aria-label` + `aria-live="polite"` so screen readers announce status changes.

**AC2 — Popover surfaces last-sync timestamp and queue depth**
- **Given** I see the sync status icon,
- **When** I click (or keyboard-activate) it,
- **Then** a Popover opens containing:
  - A human-readable last-sync timestamp (e.g. "Synced 2 minutes ago" from `lastSyncAt`) with an absolute timestamp in a tooltip for precision.
  - The pending queue depth ("3 changes waiting to upload" from `pendingCount`) or "All changes saved" when zero.
  - The current status label in bold.
- Popover is keyboard navigable, focus-trapped, closes on `Escape`, and respects the existing shadcn `Popover` primitive.

**AC3 — Error state shows message and Retry button**
- **Given** the status is `error`,
- **When** I open the popover,
- **Then** it shows a brief, user-safe error summary (last error class, not raw stack) and a primary **Retry now** button.
- **When** I click **Retry now**, the indicator transitions to `syncing`, `syncEngine.fullSync()` is invoked, and upon success `lastSyncAt` updates and status returns to `synced`; on failure it returns to `error` and surfaces a `toast.error` with the reason.
- The button is disabled while `status === 'syncing'` to prevent double-fires.

**AC4 — Offline detection via navigator.onLine + events**
- **Given** `navigator.onLine` becomes `false` (or an `offline` event fires),
- **When** the handler runs,
- **Then** the store transitions to `offline`, the icon updates to the cloud-off variant, and the popover copy reads "You're offline — changes will sync when you reconnect."
- **When** `navigator.onLine` returns `true` (or an `online` event fires), the existing `useSyncLifecycle` reconnection path drives status to `syncing` then `synced` without a page reload.

**AC5 — Reactive updates, no reload**
- **Given** I keep the tab open through any combination of writes, nudges, fullSync, offline/online toggles, or errors,
- **When** state transitions occur in `useSyncStatusStore`,
- **Then** the indicator re-renders via Zustand subscription without a navigation or reload.
- `pendingCount` refreshes: (a) on every successful upload cycle, (b) when the popover opens, and (c) on a `syncQueue` change event (Dexie hook or periodic refresh, whichever pattern already exists for sync data).

## Tasks / Subtasks

- [ ] Task 1: Extend `useSyncStatusStore` wiring so `pendingCount` refreshes automatically (AC5)
  - [ ] 1.1 Call `refreshPendingCount()` inside `markSyncComplete()` and after each `setStatus('syncing'|'error')` transition in `useSyncLifecycle`.
  - [ ] 1.2 Add `refreshPendingCount()` call on popover open (component-level effect).
  - [ ] 1.3 Add an explicit `lastError` field (string | null) to the store for AC3 copy.
- [ ] Task 2: Build `SyncStatusIndicator` component (AC1, AC2, AC3, AC4)
  - [ ] 2.1 Create `src/app/components/sync/SyncStatusIndicator.tsx` using `Popover`, `Button`, and `lucide-react` icons.
  - [ ] 2.2 Map `status` → icon + design-token color class (no hardcoded Tailwind colors).
  - [ ] 2.3 Render last-sync relative timestamp (use existing `formatRelativeTime` util or `date-fns` if already present; tooltip wraps exact ISO).
  - [ ] 2.4 Render pending queue depth with singular/plural copy.
  - [ ] 2.5 Render error panel + Retry button gated on `status === 'error'`.
  - [ ] 2.6 Honor `prefers-reduced-motion` — swap animated spinner for a static pulsing dot.
- [ ] Task 3: Mount indicator in `Layout.tsx` header (AC1)
  - [ ] 3.1 Import and place between `<TrialIndicator />` and the theme toggle `Button`.
  - [ ] 3.2 Verify it's hidden cleanly in `data-theater-hide` region (already inherited via `<header>`).
  - [ ] 3.3 Confirm mobile/tablet layouts still fit — indicator collapses to icon-only on all breakpoints.
- [ ] Task 4: Accessibility + i18n polish (AC1, AC4)
  - [ ] 4.1 `aria-label` template: "Sync status: {label}. {pendingCount} changes pending." recomputed on status change.
  - [ ] 4.2 Wrap icon in `role="status"` container with `aria-live="polite"` so transitions announce without stealing focus.
  - [ ] 4.3 Ensure popover trigger meets 44×44 touch target.
- [ ] Task 5: Unit + E2E tests
  - [ ] 5.1 Unit: component renders each of 4 states with correct icon + aria-label; Retry calls `syncEngine.fullSync`.
  - [ ] 5.2 Unit: store transitions update `pendingCount` when `refreshPendingCount` is spied.
  - [ ] 5.3 E2E (Playwright): seed `syncQueue` rows → assert badge count; toggle `navigator.onLine = false` via page.evaluate → indicator switches to offline; click Retry on error → spinner appears.

## Design Guidance

**Placement:** Inside the existing `<header>` action row in `src/app/components/Layout.tsx`, between `<TrialIndicator />` and the theme-toggle Button. This slot keeps related account/account-health affordances grouped and avoids disturbing the search bar's flex sizing.

**Component structure:**
```
<Popover>
  <PopoverTrigger asChild>
    <button role="status" aria-live="polite" aria-label="…" className="size-11 min-h-[44px] min-w-[44px]">
      <StatusIcon status={status} />
      {pendingCount > 0 && <Badge>{pendingCount}</Badge>}
    </button>
  </PopoverTrigger>
  <PopoverContent>
    <StatusHeader />
    <LastSyncLine />
    <QueueDepthLine />
    {status === 'error' && <ErrorPanel onRetry={…} />}
  </PopoverContent>
</Popover>
```

**Design tokens (use ONLY these — never hardcoded Tailwind colors):**
- synced → `text-success` on `bg-success-soft` hover
- syncing → `text-brand` on `bg-brand-soft` hover
- error → `text-destructive` on `bg-destructive/10` hover
- offline → `text-muted-foreground` on `bg-muted` hover

**Responsive:** Icon-only across all breakpoints. No textual label in the trigger; popover carries all textual detail. Badge only visible when `pendingCount > 0`.

**Accessibility:** WCAG 2.1 AA. Contrast verified in both light and dark themes for all four states. Keyboard: Enter/Space opens popover, Escape closes, Tab moves into popover content. Screen-reader flow announces status changes via polite live region, not intrusive.

**Motion:** Spinner uses `animate-spin`. When `prefers-reduced-motion: reduce` is active, the spinner is replaced with a static cloud + pulsing `text-brand` dot (no rotation). All popover open/close transitions must also respect reduced motion.

## Implementation Notes

- Store already exists at `src/app/stores/useSyncStatusStore.ts` (authored in E92-S07 with `E97-S01/S02 will consume` comment).
- Status transitions are already driven by `src/app/hooks/useSyncLifecycle.ts` — this story only adds a presentational consumer plus a `refreshPendingCount` wiring enhancement.
- `navigator.onLine` transitions are already wired via `online` / `offline` event listeners in `useSyncLifecycle`; no duplicate listeners needed from the new component.
- `syncEngine.fullSync()` is the correct entry point for Retry — not `nudge()`, which is upload-only and debounced 200ms.
- Extend the store with `lastError: string | null` and set it in `useSyncLifecycle`'s `.catch(err)` handlers.

## Testing Notes

- E2E patterns must follow `.claude/rules/testing/test-patterns.md`: deterministic time, IndexedDB seeding via shared helpers, no `Date.now()` in specs.
- Simulate error state by stubbing `supabase.from(...).upsert` to reject in a component test, then asserting the error panel renders and Retry works.
- Reduced-motion test via Playwright: `await page.emulateMedia({ reducedMotion: 'reduce' })` then snapshot the spinner element — assert no `animate-spin` class.
- Verify no hardcoded colors (ESLint `design-tokens/no-hardcoded-colors` will block save-time regressions).

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors (Retry path surfaces via toast)
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence (status flips only after store mutation)
- [ ] Type guards on all dynamic lookups (e.g., `STATUS_LABELS[status]`)
- [ ] `tsc --noEmit` clean
- [ ] E2E for this story passes (`story-97-01.spec.ts`)
- [ ] Touch targets ≥44×44px on the trigger
- [ ] ARIA: axe scan of popover UI
- [ ] Contrast check in both light and dark theme for all four states
- [ ] `prefers-reduced-motion` respected — verified in DevTools media emulation
- [ ] No hardcoded Tailwind colors (ESLint clean)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Populated on completion]
