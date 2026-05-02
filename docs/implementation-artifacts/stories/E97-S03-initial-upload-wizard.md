---
story_id: E97-S03
story_name: "Initial Upload Wizard"
status: ready-for-dev
started: 2026-04-19
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 97.03: Initial Upload Wizard

## Story

As a Knowlune user who has been using the app locally (or on another device) before signing in,
I want a friendly one-time wizard that walks me through the initial upload of my local learning data (notes, flashcards, books, progress, etc.) to the cloud the first time sync runs on this device,
so that I understand why my device is temporarily busy, I can see real progress, and I have the choice to defer the upload if it is not a good moment.

## Acceptance Criteria

**AC1 — Wizard shown once per device on first authenticated sync**
- **Given** I sign in on a device where `hasUnsyncedLocalData() === true` (i.e. `db.syncQueue.where('status').equals('pending').count() > 0` OR any syncable table has rows with `userId === null`),
- **And** the wizard has not been completed or permanently dismissed for this device + userId,
- **When** the auth lifecycle transitions to SIGNED_IN / INITIAL_SESSION and `syncEngine.start()` would be called,
- **Then** the Initial Upload Wizard modal is rendered by `App.tsx` (same rendering level as `LinkDataDialog`) before or alongside the first `fullSync()`.
- The wizard is shown exactly once per `{deviceId, userId}` tuple once it reaches the "complete" state (persisted in localStorage under `sync:wizard:complete:<userId>`).
- The wizard never co-appears with `LinkDataDialog`: if unlinked records trigger the link dialog, the upload wizard waits until the link dialog resolves, then evaluates its own open condition fresh.

**AC2 — Progress bar and item count as upload proceeds**
- **Given** the wizard is open and the user has clicked "Start upload" (or the wizard auto-started),
- **When** `fullSync()` (or the wizard's own orchestrator around the existing upload phase) is running,
- **Then** the wizard shows:
  - A `Progress` bar rendered from `@/app/components/ui/progress` reflecting `processed / total` items.
  - A live "Uploading X of Y items" count, where `total` is the snapshot of pending queue size + unlinked-row count taken at wizard open, and `processed` increments as queue entries transition from `pending` → `synced` / are removed.
  - A short per-phase label (e.g. "Uploading notes", "Uploading flashcards") derived from the `tableName` of the most recently drained queue entry.
- The progress source is a new `useSyncProgress()` hook or `useSyncProgressStore` that subscribes to `syncQueue` count changes (polled every 500ms while wizard is open) — no new primitives inside `syncEngine.ts` are required.

**AC3 — "Skip for now" dismissal persists per device**
- **Given** the wizard is visible and upload has not yet completed,
- **When** I click "Skip for now",
- **Then** the modal closes, `localStorage.setItem('sync:wizard:dismissed:<userId>', <iso-timestamp>)` is written, and `syncEngine.start()` proceeds normally in the background (sync is NOT cancelled — dismissing only hides UI).
- **When** I sign in again later (same device, same userId) and the device still has unsynced local data, the wizard is shown again (dismissal is session-scoped, not permanent — it only persists across the current sign-in session so users are not nagged between reloads of the same session).
- The dismissed state is cleared automatically once `sync:wizard:complete:<userId>` is set.

**AC4 — Auto-complete with success state**
- **Given** the wizard is open and progress has reached `processed === total` (or `pendingCount === 0` AND no unlinked rows remain),
- **When** the upload completes successfully,
- **Then** the wizard transitions to a success view showing a checkmark, "All caught up — uploaded N items" (N = original snapshot total), and a "Done" primary `Button` that closes the modal.
- `localStorage.setItem('sync:wizard:complete:<userId>', <iso-timestamp>)` is written so the wizard never reappears for this user on this device.
- A `toast.success('Initial upload complete')` fires alongside the success view (mirrors the existing "Sync complete" toast pattern from E97-S02).
- If the upload errors out (`setStatus('error', ...)` fires during the session), the wizard transitions to an error view with the classified error, a "Retry" button (re-invokes `syncEngine.fullSync()`), and a "Close" secondary button. The completion flag is NOT written on error.

**AC5 — Silent no-op when no local data exists**
- **Given** I sign in on a fresh device where `db.syncQueue.count() === 0` AND every syncable table (per `tableRegistry`) is empty OR every row already has `userId === <currentUserId>` and no pending queue entries,
- **When** the auth lifecycle resolves,
- **Then** the Initial Upload Wizard is never mounted — no modal flashes, no toast, no localStorage write. `syncEngine.start()` proceeds exactly as today.
- The guard is implemented in a single `shouldShowInitialUploadWizard(userId)` helper so tests can assert the condition directly.

**AC6 — Upload uses existing syncEngine.fullSync()**
- **Given** the wizard is instructed to begin upload,
- **When** it needs to transmit local data,
- **Then** it calls the existing `syncEngine.fullSync()` (or lets the already-running `syncEngine.start()` drive uploads) — no new sync primitives, no new upload functions, no bypass of `syncableWrite`/`syncQueue`.
- All observability is read-only: the wizard subscribes to `useSyncStatusStore` (`status`, `pendingCount`, `lastError`) and polls `db.syncQueue.count()` — it never writes to the queue or engine state directly.

## Tasks / Subtasks

- [ ] Task 1: Guard helper + detection (AC1, AC5)
  - [ ] 1.1 Create `src/lib/sync/shouldShowInitialUploadWizard.ts` exporting `shouldShowInitialUploadWizard(userId: string): Promise<boolean>`.
  - [ ] 1.2 Logic: return `false` if `localStorage.getItem('sync:wizard:complete:<userId>')` is set; otherwise return `true` iff `db.syncQueue.where('status').equals('pending').count() > 0` OR `hasUnlinkedRecords(userId) === true`.
  - [ ] 1.3 Unit-test the helper against seeded Dexie fixtures (fake-indexeddb) covering: empty DB → false; pending queue → true; unlinked rows → true; completion flag set → false.
- [ ] Task 2: Progress source (AC2)
  - [ ] 2.1 Create `src/app/hooks/useInitialUploadProgress.ts` that: snapshots `{ total, startedAt, recentTable }` on first call, polls `db.syncQueue.where('status').equals('pending').count()` every 500ms, derives `processed = total - pending`, and exposes `{ processed, total, recentTable, done }`.
  - [ ] 2.2 Include a cleanup that cancels the interval on unmount.
  - [ ] 2.3 Treat `total === 0` as `done` immediately (belt-and-suspenders for AC5).
- [ ] Task 3: `InitialUploadWizard` component (AC1–AC4)
  - [ ] 3.1 Create `src/app/components/sync/InitialUploadWizard.tsx` using `Dialog` primitives (non-dismissible via overlay click — only "Skip" and "Done" buttons close it).
  - [ ] 3.2 States: `intro` (explains what will happen + "Start upload" + "Skip for now"), `uploading` (progress bar + counts + "Skip for now"), `success` (checkmark + Done), `error` (message + Retry + Close).
  - [ ] 3.3 Subscribe to `useSyncStatusStore` for error transitions; use `useInitialUploadProgress` for counts.
  - [ ] 3.4 On mount, read snapshot from Task 2; on "Start upload", call `syncEngine.fullSync()` (swallow errors — the status store already surfaces them).
  - [ ] 3.5 On success transition, call `toast.success('Initial upload complete')` and set `localStorage['sync:wizard:complete:<userId>']`.
- [ ] Task 4: Mount from App.tsx alongside LinkDataDialog (AC1)
  - [ ] 4.1 Add `InitialUploadWizard` render block in `src/app/App.tsx` next to `LinkDataDialog`, gated by a local `showInitialUploadWizard` state.
  - [ ] 4.2 In `useAuthLifecycle.onUnlinkedDetected` handler (or a new `onPostAuthReady` hook), evaluate `shouldShowInitialUploadWizard(userId)` after the link dialog resolves (or immediately if the link dialog is not shown) and set the state.
  - [ ] 4.3 Ensure wizard does not co-appear with `LinkDataDialog` — evaluation deferred until link dialog onResolved fires.
- [ ] Task 5: "Skip for now" handling (AC3)
  - [ ] 5.1 On skip, write `localStorage['sync:wizard:dismissed:<userId>']` and close modal without touching `syncEngine`.
  - [ ] 5.2 On next sign-in within the same device, re-evaluate; dismissed flag does NOT block re-display if completion flag is absent (per AC3 semantics — dismissal is session-scoped).
  - [ ] 5.3 Clear `sync:wizard:dismissed:<userId>` whenever `sync:wizard:complete:<userId>` is written (Task 3.5).
- [ ] Task 6: Tests
  - [ ] 6.1 Unit: `shouldShowInitialUploadWizard` truth table.
  - [ ] 6.2 Unit: `useInitialUploadProgress` hook with fake timers + seeded syncQueue count drops to 0.
  - [ ] 6.3 Unit: wizard renders `intro` → `uploading` → `success` transitions; `error` state on setStatus('error').
  - [ ] 6.4 Unit: skip writes dismissal flag and calls no engine methods.
  - [ ] 6.5 Unit: success writes completion flag and fires toast.
  - [ ] 6.6 Unit: wizard returns `null` (never mounts) when `shouldShowInitialUploadWizard` resolves to `false`.
  - [ ] 6.7 E2E (`tests/e2e/story-97-03.spec.ts`): seed Dexie with pending queue entries → sign in → wizard appears → click "Start upload" → assert progress updates → mock queue drain → assert success + completion flag; reload → wizard does not reappear.
  - [ ] 6.8 E2E: fresh DB + sign in → wizard never appears.
  - [ ] 6.9 E2E: wizard + LinkDataDialog ordering (seed unlinked rows + pending queue → resolve link dialog → wizard appears).

## Design Guidance

**Layout (modal, 480px max-width):**
```
<Dialog>
  <DialogContent>
    <header>
      <CloudUpload className="text-brand" />
      <h2>Welcome back — let's back up your learning data</h2>
    </header>

    {state === 'intro' && (
      <>
        <p>We found N items on this device that haven't been uploaded yet…</p>
        <p className="text-muted-foreground">This usually takes under a minute.</p>
        <footer>
          <Button variant="ghost" onClick={handleSkip}>Skip for now</Button>
          <Button variant="brand" onClick={handleStart}>Start upload</Button>
        </footer>
      </>
    )}

    {state === 'uploading' && (
      <>
        <Progress value={(processed / total) * 100} />
        <p className="text-sm">Uploading {processed} of {total} items</p>
        {recentTable && <p className="text-xs text-muted-foreground">Currently: {humanizeTable(recentTable)}</p>}
        <footer>
          <Button variant="ghost" onClick={handleSkip}>Skip for now — continue in background</Button>
        </footer>
      </>
    )}

    {state === 'success' && (
      <>
        <CheckCircle2 className="text-success" />
        <h3>All caught up</h3>
        <p>Uploaded {total} items.</p>
        <Button variant="brand" onClick={handleDone}>Done</Button>
      </>
    )}

    {state === 'error' && (
      <>
        <AlertTriangle className="text-destructive" />
        <p>{lastError}</p>
        <footer>
          <Button variant="ghost" onClick={handleDone}>Close</Button>
          <Button variant="brand" onClick={handleRetry}>Retry</Button>
        </footer>
      </>
    )}
  </DialogContent>
</Dialog>
```

**Design tokens:** `text-brand`, `text-success`, `text-destructive`, `text-muted-foreground`, `bg-brand`, `bg-brand-soft`. No hardcoded Tailwind colors. Progress bar uses existing shadcn `Progress` which respects theme tokens.

**Accessibility:**
- Dialog uses shadcn primitives with focus trap and Escape (Escape fires Skip, not hard close).
- Progress bar announces updates via `aria-live="polite"` on the counts text (not on the bar itself — screen readers get verbose double-announcements otherwise).
- All buttons ≥44×44px.
- Success view reduces motion for the checkmark when `prefers-reduced-motion`.

**Responsive:** Dialog becomes full-height sheet on <640px (same convention as other modals in the app); buttons stack vertically with full width.

## Implementation Notes

- Wizard is orthogonal to `LinkDataDialog` — link dialog runs first (if unlinked records exist), wizard runs second (if post-link the queue still has items OR there were no unlinked records but there are pending queue entries).
- `syncEngine.fullSync()` is fire-and-forget from the wizard's perspective; the wizard observes `useSyncStatusStore` for completion/error signals.
- "Processed" count is derived from `total - pending` to avoid needing a new event hook inside the engine. Accepting a tiny inaccuracy during the 500ms poll window is a worthwhile simplicity tradeoff (explicitly per AC6: no new sync primitives).
- localStorage keys scoped by `userId` so multi-account users on the same device each see the wizard once.
- Dismissed flag is session-scoped (cleared on sign-out via `useAuthStore` SIGNED_OUT handler — a one-line addition).
- Do NOT block `syncEngine.start()` on wizard interaction — sync always proceeds; wizard is purely observational + explanatory.
- Reuse `classifyError` for the error view message so it matches what the header indicator shows.

## Testing Notes

- E2E patterns per `.claude/rules/testing/test-patterns.md`: deterministic time via `FIXED_DATE`, IndexedDB seeding through shared helpers.
- Mock `syncEngine.fullSync` at the module boundary for happy-path E2E so tests do not hit real Supabase; drive the queue-drain by manually deleting `syncQueue` rows to simulate successful upload.
- Seed scenarios required:
  1. Empty DB, authenticated → no wizard.
  2. 5 pending queue entries → wizard appears, progresses 0→5, shows success.
  3. Unlinked rows present → LinkDataDialog first; after "Link to my account", wizard evaluates fresh.
  4. `fullSync` throws → wizard shows error state with retry.
  5. User clicks Skip → modal closes, localStorage dismissal flag set, sync continues (pending count eventually drops to 0 offscreen).
- Verify `tsc --noEmit` clean before review.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — wizard error state surfaces `lastError` via `classifyError`
- [ ] useEffect hooks have cleanup (interval cleared on unmount, ignore flags for async)
- [ ] No optimistic UI updates — state transitions driven by observed `useSyncStatusStore` + Dexie poll
- [ ] Type guards on `userId` before reading/writing localStorage keys (no `null` userId paths)
- [ ] Wizard does NOT call any engine mutation beyond `syncEngine.fullSync()` (AC6 invariant)
- [ ] `shouldShowInitialUploadWizard` returns `false` on fresh DB (AC5 invariant)
- [ ] `tsc --noEmit` clean
- [ ] E2E: `tests/e2e/story-97-03.spec.ts` passes
- [ ] Touch targets ≥44×44px on all buttons
- [ ] ARIA: axe scan of Dialog + Progress
- [ ] Contrast check in light and dark themes (brand, success, destructive tokens)
- [ ] `prefers-reduced-motion` respected in success/error state animations
- [ ] No hardcoded Tailwind colors (ESLint clean)
- [ ] Wizard + LinkDataDialog do NOT co-appear (ordering test)
- [ ] Completion flag cleared on sign-out so wizard re-appears for next account on shared device
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Populated on completion]
