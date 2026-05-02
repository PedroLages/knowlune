---
title: Extract SyncUXShell from App.tsx
type: refactor
status: active
date: 2026-04-21
origin: docs/brainstorms/2026-04-21-extract-sync-ux-shell-requirements.md
---

# Extract SyncUXShell from App.tsx

## Overview

`src/app/App.tsx` has absorbed sync/onboarding UI across E92–E97 and now sits at 310 lines, mounting 5 floating components plus ~150 lines of gating state, refs, effects, and callbacks. This refactor extracts all sync-UX concerns into a single co-located component `src/app/components/sync/SyncUXShell.tsx` so App.tsx returns to a pure provider + router shell. Behavior must be byte-identical — no test changes, no observable timing changes.

## Problem Frame

Every new sync-UI story edits App.tsx, forcing reviewers to re-reason about the link → upload → overlay → banner gating sequence alongside unrelated lifecycle code (vector store init, YouTube refresh, motion/theme providers). The file no longer reads as a router shell; it reads as a sync orchestrator that happens to host a router.

See origin: `docs/brainstorms/2026-04-21-extract-sync-ux-shell-requirements.md` for full symptom inventory and proposed shape.

## Requirements Trace

- **R1.** `src/app/components/sync/SyncUXShell.tsx` exists and owns all 5 items listed under "Responsibilities" in the origin doc (AC1).
- **R2.** `App.tsx` no longer imports `LinkDataDialog`, `InitialUploadWizard`, `NewDeviceDownloadOverlay`, `CredentialSetupBanner`, `MissingCredentialsProvider`, `useAuthLifecycle`, `useSyncLifecycle`, `shouldShowInitialUploadWizard`, `shouldShowDownloadOverlay`, `useDownloadStatusStore`, or `useAuthStore` (AC2).
- **R3.** `App.tsx` drops to ≤170 lines (AC3).
- **R4.** All existing E92-S08, E97-S03, E97-S04, E97-S05 E2E specs pass unchanged (AC4).
- **R5.** `window.__forceDownloadOverlay` remains available in dev/test (AC5).
- **R6.** `useAuthLifecycle`'s `onUnlinkedDetected` contract is unchanged — still fires and still defers `syncEngine.start()` until `LinkDataDialog` resolves (AC6).
- **R7.** Provider/consumer tree preserved: `MissingCredentialsProvider` remains an ancestor of `RouterProvider` and `Toaster`, and the outer provider stack (`ErrorBoundary`, `ThemeProvider`, `MotionConfig`) stays above the shell. The exact nesting depth between `MotionConfig` and `MissingCredentialsProvider` is an implementation detail — `SyncUXShell` is interposed between them — but every consumer in the tree still resolves the same providers it did before (AC7).
- **R8.** Build, lint, type-check, unit + E2E (Chromium smoke + E97 specs) all green (AC8).

## Scope Boundaries

- No redesign of individual floaters (LinkDataDialog et al.) — same props, same behavior.
- No change to `useSyncLifecycle` / `useAuthLifecycle` internals.
- No change to `MissingCredentialsProvider` contract.
- No new abstraction for "future sync UI registration" — YAGNI.
- No changes to Toaster visual behavior.

## Context & Research

### Relevant Code and Patterns

- `src/app/App.tsx` (current 310-line source; lines 77-228 encode the sync gating state machine, lines 269-305 the JSX tree inside `MissingCredentialsProvider`)
- `src/app/hooks/useAuthLifecycle.ts` — consumes `onUnlinkedDetected` callback
- `src/app/hooks/useSyncLifecycle.ts` — no external callback contract
- `src/app/hooks/useMissingCredentials.tsx` — provider component + hook
- `src/app/components/sync/LinkDataDialog.tsx`, `InitialUploadWizard.tsx`, `NewDeviceDownloadOverlay.tsx`, `CredentialSetupBanner.tsx` — destination neighbors for the new shell
- `src/app/components/sync/__tests__/` — existing RTL test pattern (component-level); the shell's orchestration logic is exercised by E2E specs already

### Institutional Learnings

- `docs/solutions/` pattern: extracting coordination state into a dedicated component reduces App.tsx churn per epic — same principle already applied for `useSyncLifecycle` (E92-S07) and `useAuthLifecycle` (E43-S04).
- Mutual-exclusion effect ordering risk: the 4 useEffects in App.tsx have implicit render-cycle ordering. Moving them wholesale preserves ordering; splitting them does not. (Origin doc Risk #1.)

### Existing E2E Coverage (no changes required)

- `tests/e2e/story-97-04.spec.ts` uses `window.__forceDownloadOverlay` — must still be exposed.
- E92-S08, E97-S03, E97-S05 specs exercise LinkDataDialog / InitialUploadWizard / CredentialSetupBanner flows through normal sign-in paths.

## Key Technical Decisions

- **Name: `SyncUXShell`** — matches origin doc recommendation; communicates "floating first-run/sync UI container" rather than "sync engine wrapper". Resolves Open Question #3.
- **Toaster rendered inside `SyncUXShell` (as a child passed through from App.tsx)** — `<Toaster />` is placed in the children block that App.tsx hands to `SyncUXShell`, so it lives inside `MissingCredentialsProvider` at runtime. This keeps Toaster a descendant of `MissingCredentialsProvider` so credential-related toasts fired from hook effects inside SyncUXShell resolve the same provider context, and it keeps the shell self-contained for future sync-UI stories. The origin doc's Open Question #1 recommended keeping Toaster at App level as a sibling of `SyncUXShell`; we override that recommendation because (a) passing Toaster through as a child is functionally equivalent for generic toast consumers and (b) it avoids a subtle provider-ancestry difference for sync-originated toasts. Resolves Open Question #1.
- **`MissingCredentialsProvider` moves inside `SyncUXShell` as a wrapper of `children`** — this preserves current scope (routed pages + Toaster remain descendants). The shell renders `<MissingCredentialsProvider>{children}{floaters}</MissingCredentialsProvider>`. Resolves Open Question #2.
- **Hooks `useAuthLifecycle` + `useSyncLifecycle` move into SyncUXShell** — per origin doc, they are intrinsically tied to sync UX. `handleUnlinkedDetected` is defined inside the shell and passed to `useAuthLifecycle`. App.tsx no longer imports either hook.
- **Keep the 4 gating effects as a single contiguous block** — per Risk #1, preserve execution ordering by moving them together, not splitting or reordering.
- **Dev-only `__forceDownloadOverlay` shim moves with the overlay state** — lives inside SyncUXShell; same mount timing as before (synchronous with App mount).
- **No new test file for SyncUXShell** — the shell is a mechanical container. Existing E2E specs (story-97-04, E92-S08, E97-S03, E97-S05) provide full behavioral coverage. A unit test would duplicate E2E coverage without asserting new behavior. Include a smoke unit test only if lint/gate requires it (see Open Question below).

## Open Questions

### Resolved During Planning

- **Naming** (Open Q #3): `SyncUXShell`. Resolved.
- **Toaster placement** (Open Q #1): Stays in App.tsx, passed as children through SyncUXShell. No sync code depends on MissingCredentialsProvider being its ancestor (verified by reading toast call sites — `toast()` from sonner is context-free). Resolved.
- **MissingCredentialsProvider scope** (Open Q #2): Wraps `children` inside SyncUXShell so all routed pages + Toaster remain consumers. Resolved.

### Deferred to Implementation

- Whether to add a smoke unit test `src/app/components/sync/__tests__/SyncUXShell.test.tsx` — defer until implementation reveals whether ESLint/coverage gates require it. If added, scope: "renders children; mounts floaters when state transitions occur" at minimal depth; do not re-test gating logic already covered by E2E.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
SyncUXShell(children):
  // State (moved from App.tsx lines 79-97)
  linkDialogUserId, setLinkDialogUserId
  uploadWizardUserId, setUploadWizardUserId
  downloadOverlayUserId, setDownloadOverlayUserId
  deferredOverlayReady, setDeferredOverlayReady
  evaluationInFlightRef
  downloadEvaluationInFlightRef
  authUser = useAuthStore(...)

  // Callbacks (moved from App.tsx lines 100-130, 142-156)
  evaluateWizard
  handleUnlinkedDetected
  handleLinkDialogResolved
  evaluateDownloadOverlay

  // Effects (moved from App.tsx lines 135-228, kept in same order)
  - fast-path wizard trigger on authUser change
  - overlay evaluation gate
  - 2s deferred-mount timer + store subscription
  - sign-out reset
  - dev-only __forceDownloadOverlay shim

  // Hooks (moved from App.tsx lines 232-234)
  useAuthLifecycle({ onUnlinkedDetected: handleUnlinkedDetected })
  useSyncLifecycle()

  return (
    <MissingCredentialsProvider>
      {children}
      {linkDialogUserId && <LinkDataDialog .../>}
      <InitialUploadWizard .../>
      {downloadOverlayUserId && deferredOverlayReady && <NewDeviceDownloadOverlay .../>}
      <CredentialSetupBanner />
    </MissingCredentialsProvider>
  )

App():
  // Keep: all global hooks (useColorScheme, useReducedMotion, useFontScale, etc.)
  // Keep: all global effects (reduce-motion class, orphan sessions, welcome wizard init,
  //       notification prefs + service, vector store, YouTube metadata refresh)
  // Remove: all sync gating state/callbacks/effects/hooks listed above

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <MotionConfig>
          <SyncUXShell>
            <RouterProvider router={router} />
            <Toaster />
            <WelcomeWizard />
            {import.meta.env.PROD && <PWAUpdatePrompt />}
            <PWAInstallBanner />
            {dev && createPortal(<Agentation />, document.body)}
          </SyncUXShell>
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  )
```

## Implementation Units

- [ ] **Unit 1: Create SyncUXShell component**

**Goal:** Extract all sync-UX state, refs, callbacks, effects, hooks, and floater JSX from `App.tsx` into a new `SyncUXShell` component that wraps its children in `MissingCredentialsProvider`.

**Requirements:** R1, R6, R7

**Dependencies:** None

**Files:**
- Create: `src/app/components/sync/SyncUXShell.tsx`
- Test: (deferred — see Open Questions)

**Approach:**
- Copy verbatim from App.tsx: state declarations (lines 79-97), callbacks (lines 100-130, 142-156), all 4 gating effects (lines 135-228), and the two hook calls (lines 232-234). Preserve block ordering — the effects have implicit render-cycle dependencies (link → upload → overlay → sign-out reset → dev shim).
- Accept `children: ReactNode` prop.
- Return tree: `<MissingCredentialsProvider>{children}{floater JSX}</MissingCredentialsProvider>` where floater JSX is the current App.tsx lines 273-301 (LinkDataDialog, InitialUploadWizard, NewDeviceDownloadOverlay, CredentialSetupBanner).
- Re-use the existing prop shapes for each floater — no prop-signature changes.
- Keep the dev-only `__forceDownloadOverlay` effect (App.tsx lines 218-228) intact and in the same position relative to other effects.
- Add a brief file-header comment explaining the component's purpose and the mutual-exclusion invariants it enforces (link → upload → overlay).

**Execution note:** Mechanical extraction. No characterization tests needed — existing E2E specs (story-97-04, E92-S08, E97-S03, E97-S05) are the behavioral safety net. Run them after the move.

**Patterns to follow:**
- Same file header / import style as `src/app/components/sync/CredentialSetupBanner.tsx` and `src/app/components/sync/NewDeviceDownloadOverlay.tsx`.
- Keep comments that document non-obvious invariants (fast-path guard ref, 2s defer timer short-circuit, sign-out reset reasoning) — they are institutional knowledge.

**Test scenarios:**
- Test expectation: none — this unit is a mechanical copy-and-relocate with no behavioral change. Existing E2E specs cover all gating transitions (link dialog → upload wizard → download overlay → credential banner). Adding unit tests at this layer would duplicate E2E coverage without catching new regressions.

**Verification:**
- File `src/app/components/sync/SyncUXShell.tsx` exists and exports `SyncUXShell` as a named or default export consistent with sibling sync components.
- `tsc --noEmit` passes; no unused imports.
- Component accepts `children` prop and renders them inside `MissingCredentialsProvider` alongside the four floaters.

---

- [ ] **Unit 2: Collapse App.tsx to provider + router shell**

**Goal:** Remove all sync-UX concerns from `App.tsx` and delegate them to `SyncUXShell`. Preserve global hooks, global effects, and provider mount order.

**Requirements:** R2, R3, R4, R5, R7, R8

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/App.tsx`

**Approach:**
- Delete the 11 sync-related imports listed in R2 (lines 24-34 of current App.tsx).
- Delete sync state declarations (lines 77-98), sync callbacks (lines 100-130, 142-156), all 4 gating effects (lines 135-228), and the two sync hook calls (lines 232-234).
- Keep all global concerns: `useColorScheme`, `useReducedMotion`, `useFontScale`, `useAccessibilityFont`, `useContentDensity`, reduce-motion class effect, `recoverOrphanedSessions`, `initWizard`, notification prefs init, notification service init/destroy, vector store loadAll, YouTube `refreshStaleMetadata`.
- Update JSX tree per origin doc "New App.tsx shape":
  ```tsx
  <ErrorBoundary>
    <ThemeProvider ...>
      <MotionConfig ...>
        <SyncUXShell>
          <RouterProvider router={router} />
          <Toaster />
          <WelcomeWizard />
          {import.meta.env.PROD && <PWAUpdatePrompt />}
          <PWAInstallBanner />
          {dev && createPortal(<Agentation />, document.body)}
        </SyncUXShell>
      </MotionConfig>
    </ThemeProvider>
  </ErrorBoundary>
  ```
- Import only: `SyncUXShell` from the new path.
- Verify provider mount order is unchanged: ErrorBoundary → ThemeProvider → MotionConfig → (SyncUXShell wraps) MissingCredentialsProvider → RouterProvider. The nesting change is that `MissingCredentialsProvider` now lives inside `SyncUXShell` rather than directly in App, but its position in the render tree is the same.

**Execution note:** Verify behavior before and after with the targeted E2E set: `story-92-08`, `story-97-03`, `story-97-04`, `story-97-05`. If any diverges, inspect effect ordering inside `SyncUXShell` — do not reorder.

**Patterns to follow:**
- Keep the in-line comments that describe WHY each remaining global effect exists (e.g., "E51-S02: Toggle .reduce-motion class"); these survive across epics.

**Test scenarios:**
- Happy path (regression): Existing smoke E2E still navigates home without console errors — verified by running Chromium smoke spec.
- Integration (regression): `story-92-08.spec.ts` — first sign-in with local data still triggers `LinkDataDialog`; resolving it still evaluates the wizard gate.
- Integration (regression): `story-97-03.spec.ts` — `InitialUploadWizard` still mounts on first-run with backup-eligible data.
- Integration (regression): `story-97-04.spec.ts` — `window.__forceDownloadOverlay` still toggles `NewDeviceDownloadOverlay`; 2s defer timer still prevents flashes on fast restores.
- Integration (regression): `story-97-05.spec.ts` — `CredentialSetupBanner` still surfaces after first sync when credentials are missing.
- Edge case (regression): Sign-out while overlay is mounted still resets `downloadOverlayUserId` and `deferredOverlayReady` to their initial states.

**Verification:**
- `App.tsx` line count ≤170 (R3).
- `App.tsx` no longer contains any of the 11 imports listed in R2 (R2).
- `npm run build` succeeds.
- `npm run lint` succeeds with no new warnings.
- `npx tsc --noEmit` passes.
- Unit test suite passes unchanged.
- E2E specs for E92-S08, E97-S03, E97-S04, E97-S05 pass on Chromium with no modifications to the spec files (R4).
- Manual smoke: sign-in flow surfaces expected dialog/wizard/overlay/banner in the correct order based on local state; no toast regressions (R8).

## System-Wide Impact

- **Interaction graph:** `useAuthLifecycle` now invokes `onUnlinkedDetected` inside `SyncUXShell` rather than `App`. Functionally identical — the callback sets the same state that controls `LinkDataDialog`. No other components consume this callback.
- **Error propagation:** Unchanged. Both `evaluateWizard` and `evaluateDownloadOverlay` retain their `silent-catch-ok` pattern (log + skip; best-effort detection).
- **State lifecycle risks:** The 4 gating effects must move as a block. Splitting or reordering them would alter render-cycle ordering and could cause the overlay to flash before the wizard is evaluated (or vice versa). The plan keeps them contiguous.
- **API surface parity:** No public API changes. All floater prop signatures unchanged. `window.__forceDownloadOverlay` dev shim preserved.
- **Integration coverage:** E2E specs cover all gating transitions end-to-end. This refactor's correctness is ultimately validated by running them post-move; no new integration tests required.
- **Unchanged invariants:**
  - Provider mount order (R7).
  - `MissingCredentialsProvider` scope — still an ancestor of `RouterProvider` and `Toaster`.
  - `useAuthLifecycle`'s deferred `syncEngine.start()` behavior (R6).
  - Toast consumers — `Toaster` still rendered inside `MissingCredentialsProvider` (via children pass-through).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Effect-ordering regression from accidental reordering during the move | Move the block verbatim as a single copy; do not split across units. Unit 1's approach explicitly preserves ordering. |
| Dev shim `__forceDownloadOverlay` not mounting before E2E test triggers it | SyncUXShell mounts synchronously with App (same render tree depth). Verify `story-97-04.spec.ts` passes without any test changes. |
| `useAuthLifecycle` / `useSyncLifecycle` timing regression | Both currently run at App mount. After the move, they run at SyncUXShell mount — synchronously the same point. Verify targeted E2E set. |
| Line-count target (R3) missed if hidden dependencies surface | Expected delta: ~140 lines removed from App.tsx, net diff ~300 LOC (new file + App modifications). If App.tsx exceeds 170 lines post-extraction, re-check whether any non-global state leaked back in. |
| Missing import cleanup leaving unused symbols | ESLint `no-unused-vars` catches this at commit time; also surfaces in `tsc --noEmit`. |

## Documentation / Operational Notes

- No docs updates required — this is an internal refactor with no external contract change.
- Update the relevant entry in sprint-status.yaml if this work is tracked as a story (per-project convention).
- Future sync-UI stories (e.g., E93 conflict overlay) should edit `SyncUXShell.tsx`, not `App.tsx`.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-21-extract-sync-ux-shell-requirements.md](../brainstorms/2026-04-21-extract-sync-ux-shell-requirements.md)
- Related code: `src/app/App.tsx`, `src/app/components/sync/` (4 floaters), `src/app/hooks/useAuthLifecycle.ts`, `src/app/hooks/useSyncLifecycle.ts`, `src/app/hooks/useMissingCredentials.tsx`
- Related review: `docs/reviews/code/E97-deep-report-2026-04-21.md` (Architectural Concern #4)
- Related E2E specs: `tests/e2e/story-92-08.spec.ts`, `tests/e2e/story-97-03.spec.ts`, `tests/e2e/story-97-04.spec.ts`, `tests/e2e/story-97-05.spec.ts`
