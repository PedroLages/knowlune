# E97-S01 — Sync Status Indicator in Header

**Date:** 2026-04-19
**Epic:** E97 — Sync UX Polish
**Story:** S01 — Sync Status Indicator in Header
**Status:** Requirements (CE orchestrator brainstorm)
**Predecessors:** E92-S07 (useSyncLifecycle + useSyncStatusStore scaffold), E92–E96 (sync engine build-out)

---

## 1. Problem Statement

Knowlune's sync engine (E92–E96) now replicates 26 Dexie tables and Storage buckets to Supabase, but users have zero visibility into the system. They cannot tell whether their latest note committed, whether the queue is draining, whether the device is offline, or whether something is broken. The only signals today are incidental: a "You are offline" banner (when `navigator.onLine === false`) and a session-expired warning dot.

This is a trust problem. A sync engine users cannot see is one they cannot rely on. When a user writes a flashcard on device A and it doesn't appear on device B, the user's mental model has no way to diagnose whether the first device finished uploading.

E97-S01 makes sync state legible via a single persistent affordance in the app header.

## 2. Scope

### 2.1 In Scope

- A `SyncStatusIndicator` React component placed in the Layout header.
- Four visual states: `synced`, `syncing`, `error`, `offline`.
- A Popover (triggered by click or keyboard activation) exposing:
  - Last successful sync timestamp (relative + absolute).
  - Pending queue depth.
  - Error message (when status === 'error').
  - Retry button (when status === 'error').
- Store-level enhancement: add `lastError: string | null` to `useSyncStatusStore`, wire `refreshPendingCount` into lifecycle transitions.
- Reactive updates driven by Zustand subscriptions — no page reload required.
- Accessibility to WCAG 2.1 AA.
- Respect for `prefers-reduced-motion` on the spinner animation.

### 2.2 Out of Scope

- Full sync settings panel (E97-S02).
- Per-table sync status or queue inspector (future).
- Exporting / manually dead-lettering queue entries (future).
- Push notifications for sync failures (future).
- Modifying the sync engine internals or conflict resolution behavior.
- Changing existing offline banner inside `<main>` — complementary, not replaced.

## 3. Goals & Success Criteria

### 3.1 Goals

- **G1** — Users can tell at a glance whether their data is safely replicated.
- **G2** — Users discover error states immediately (no silent failure).
- **G3** — Users can recover from transient errors without reloading or navigating to settings.
- **G4** — The indicator is accessible via keyboard and screen reader and never traps focus.
- **G5** — Implementation reuses existing primitives (`useSyncStatusStore`, `useSyncLifecycle`, shadcn `Popover`, `lucide-react`) without adding new infra.

### 3.2 Success Criteria

- Indicator renders in the header on every authenticated page.
- Four states are visually and programmatically distinguishable.
- Popover opens/closes via mouse AND keyboard; `Escape` closes.
- Error state shows a Retry button that calls `syncEngine.fullSync()` and reflects the resulting state within one cycle.
- Offline detection fires within 500ms of `navigator.onLine` change (governed by the existing `online`/`offline` listeners in `useSyncLifecycle`).
- Zero new hardcoded colors (ESLint clean).
- Axe DevTools reports no violations on the indicator or popover.

## 4. State to Surface

| State      | Trigger                                                                   | Icon (lucide)         | Color token              | Copy                                           |
| ---------- | ------------------------------------------------------------------------- | --------------------- | ------------------------ | ---------------------------------------------- |
| `synced`   | `markSyncComplete()` after successful `fullSync()`                        | `CloudCheck` / `Check`| `text-success`           | "All changes synced"                           |
| `syncing`  | `setStatus('syncing')` on mount, on `online`, on periodic nudge           | `Loader2` (spin)      | `text-brand`             | "Syncing changes..."                           |
| `error`    | `useSyncLifecycle` `.catch` handler sets `status='error'` + `lastError`   | `CloudAlert` / `XCircle` | `text-destructive`     | "Sync failed — {lastError}. [Retry now]"       |
| `offline`  | `window.addEventListener('offline', ...)` → `setStatus('offline')`        | `CloudOff`            | `text-muted-foreground`  | "You're offline — changes will sync when you reconnect." |

Badge on trigger: `pendingCount` when > 0 (except in `offline` state where it reads as informational, not alarming).

## 5. Store Shape (existing + additions)

Existing `src/app/stores/useSyncStatusStore.ts`:

```ts
status: 'synced' | 'syncing' | 'offline' | 'error'
pendingCount: number
lastSyncAt: Date | null
setStatus(s): void
markSyncComplete(): void
refreshPendingCount(): Promise<void>
```

Additions in this story:

```ts
lastError: string | null          // cleared by markSyncComplete; set by setStatus('error', msg)
setStatus(status, error?: string) // extended signature; passes error through when status === 'error'
```

`useSyncLifecycle` wiring adjustments:

- On `.catch(err)` paths (initial fullSync, reconnect fullSync): call `setStatus('error', friendlyMessage(err))`.
- After every successful fullSync: call `refreshPendingCount()` in addition to `markSyncComplete()`.
- After upload cycles complete (via a new hook into `syncEngine.nudge`'s completion): call `refreshPendingCount()` — can be piggy-backed on the existing 30s nudge interval.

## 6. Where in the Header

`src/app/components/Layout.tsx` renders:

```
<div className="flex items-center gap-4">
  <TrialIndicator />
  /* NEW: SyncStatusIndicator goes here */
  <Button>theme toggle</Button>
  <NotificationCenter />
  {authUser ? <Dropdown… /> : <SignInButton />}
</div>
```

Rationale: Account-health cluster. The sync indicator belongs to the same mental bucket as the trial indicator ("is my account in good standing?") and sits before the notification center so it's visually associated with system status rather than content notifications.

On mobile (<640px), keep the icon; drop any inline text (current inline design is icon-only regardless).

## 7. Component API

```tsx
// Zero props — it's a leaf consumer of the store.
export function SyncStatusIndicator(): JSX.Element
```

Internal structure:

- Zustand selector pulls `status`, `pendingCount`, `lastSyncAt`, `lastError`.
- `useMemo` for aria-label derived from status + pendingCount.
- `useEffect` on popover open → `refreshPendingCount()`.
- `useReducedMotion` hook (or inline media query) for spinner fallback.

## 8. Accessibility Requirements

**WCAG 2.1 AA:**

- Contrast ≥ 4.5:1 in both themes for all four states (tokens already verified in theme.css).
- Trigger is a real `<button>`, focusable, 44×44 minimum.
- `aria-label` dynamic: `"Sync status: {label}. {pendingCount} changes pending."`
- `role="status"` + `aria-live="polite"` on a wrapper so status transitions are announced without stealing focus.
- Popover content uses shadcn's `Popover` primitive which already handles focus trap + Escape.
- Error message in popover wrapped in `role="alert"` so screen readers announce on open.
- Retry button has explicit `aria-label="Retry sync now"` to disambiguate.

## 9. Animation Guidance

- Default spinner: `Loader2` + `animate-spin` — Tailwind built-in 1s linear infinite.
- Duration: under 500ms for state-change crossfades (use `transition-colors duration-200`).
- `prefers-reduced-motion: reduce`:
  - Spinner replaced with static `Cloud` icon + a pulsing dot (`bg-brand/50 animate-pulse` is still allowed — `animate-pulse` is opacity-only and WCAG-safe per MDN). If the team wants to be maximally conservative, swap to a static state with no animation at all.
  - Popover open/close transitions fall back to instant (shadcn respects reduced motion by default).
- No parallax, no shake/bounce on error state — color + icon change alone is sufficient signal.

## 10. Design-Token & Component Reuse

Per `.claude/rules/styling.md`:

- Use `text-success`, `text-brand`, `text-destructive`, `text-muted-foreground` — never `text-green-600`, etc.
- Use `Popover`, `Button` variants from `src/app/components/ui/`.
- Use `lucide-react` icons exclusively.
- Any badge visual: reuse `Badge` component from ui library.
- Relative time: if `date-fns` is available in the codebase, use `formatDistanceToNow`; otherwise inline a compact formatter (minutes, hours, days). [Confirm via `package.json` during implementation; prefer existing util in `src/lib/textUtils.ts` or similar.]

## 11. Edge Cases

1. **First mount with empty queue and no prior sync** — `lastSyncAt === null`. Render "Not synced yet" in popover, status icon defaults to `synced` (per store initial state — acceptable).
2. **Offline with pending writes** — Indicator shows offline icon + badge count; popover copy says "{n} changes will upload when you reconnect."
3. **Rapid toggle online/offline** — Store handles via existing listeners; indicator re-renders without flicker (React batches via Zustand).
4. **Retry while already syncing** — Button disabled when `status === 'syncing'`; prevents double fullSync.
5. **Retry failure** — Status returns to `error`, `lastError` updated, toast surfaces reason. User can retry again.
6. **Dead-letter entries in queue** — Not currently surfaced here (E97-S02 settings panel territory). `pendingCount` reads only `status === 'pending'` rows, which is correct for this indicator.
7. **Unauthenticated session** — Indicator can render but status stays `offline`/`synced` trivially. If `useAuthStore.user` is null, optionally hide the indicator; decision: **render it anyway** for consistency, showing `synced` with zero queue (the engine isn't running; technically true).
8. **`navigator.onLine` lies** — Browsers sometimes report online when network is flaky. The `error` state from a real fullSync failure will correct this; the indicator will surface the error.

## 12. Risks & Mitigations

| Risk                                                                            | Likelihood | Impact | Mitigation                                                                                  |
| ------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------- |
| `pendingCount` drifts from reality between refreshes                            | Medium     | Low    | Refresh on lifecycle transitions + on popover open; 30s periodic via nudge completion hook. |
| Spinner violates reduced-motion preferences                                     | Medium     | Medium | Explicit media-query check + fallback static icon.                                          |
| Error messages expose raw Supabase/JWT details to users                         | Medium     | Medium | Classify error into friendly bucket ("Network", "Auth expired", "Server error") before display. |
| Popover trigger overflows header on small tablets                               | Low        | Low    | Icon-only trigger + Popover auto-positioning handles this.                                  |
| Status announcements too chatty for screen readers (status flips every 30s)     | Medium     | Medium | Only announce `status` changes to `error` and `offline`; `synced` ↔ `syncing` announced only when transitioning from error/offline. |

## 13. Open Questions (resolved in plan or deferred)

- Should the indicator also appear in the mobile `BottomNav`? → No; header is shown on mobile too (it's the top bar).
- Should the popover show per-table status or a single unified view? → Single unified view for S01. Per-table drill-down is S02 territory.
- Should Retry also call `syncEngine.nudge()` or only `fullSync()`? → `fullSync()` is correct — it flushes queue AND pulls server changes, which is the user's mental model of "retry".
- Do we need optimistic UI for the Retry click? → No; the store flip to `syncing` handles visual feedback instantly.

## 14. Dependencies

- None beyond what's already in the codebase:
  - `src/app/stores/useSyncStatusStore.ts` (extend)
  - `src/app/hooks/useSyncLifecycle.ts` (extend `.catch` handlers)
  - `src/lib/sync/syncEngine.ts` (consume `fullSync` — no change)
  - `src/app/components/ui/popover.tsx` (existing shadcn primitive)
  - `src/app/components/ui/button.tsx` (existing)
  - `src/app/components/ui/badge.tsx` (existing)
  - `lucide-react` (existing)

## 15. Test Strategy

- **Unit:** Component renders each of 4 states with correct icon, aria-label, and color class. Retry invokes `syncEngine.fullSync`. Store extensions (`lastError`) behave as specified.
- **Integration:** `useSyncLifecycle` error path sets `lastError` and `setStatus('error')` together.
- **E2E (Playwright):** Seed `syncQueue` with N pending entries → assert badge count. Toggle `navigator.onLine = false` via `page.evaluate` + dispatch `offline` event → assert offline icon. Click Retry after a stubbed failure → spinner appears then resolves.
- **A11y:** axe scan on both closed and open popover states. Reduced-motion verified via Playwright `emulateMedia`.

## 16. Definition of Done

- All ACs (AC1-AC5) verified via test or manual review.
- Design review passes (token usage, contrast, motion).
- Code review passes (no silent catches, useEffect cleanups, no hardcoded colors).
- E2E spec `story-97-01-sync-status-indicator.spec.ts` green on chromium.
- No regressions in existing Layout tests.
- Story file moved to `reviewed: true` and merged.
