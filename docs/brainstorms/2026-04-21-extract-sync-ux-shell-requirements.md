# Extract SyncUXShell from App.tsx — Requirements

**Date:** 2026-04-21
**Scope:** Lightweight refactor
**Origin:** `docs/reviews/code/E97-deep-report-2026-04-21.md` — Architectural Concern #4
**Status:** Ready for planning

## Problem

`src/app/App.tsx` (310 lines) has absorbed sync/onboarding UI across E92–E97. It currently mounts 5 root-level floating components plus ~150 lines of coordination state, refs, effects, and callbacks that gate them. Each new sync epic (E93+ conflict UI, future multi-device status, etc.) adds another floater and more gating logic. `App.tsx` no longer reads as a router shell — it reads as a sync orchestrator that happens to host a router.

**Symptoms:**
- 5 floating components mounted directly in App's JSX (LinkDataDialog, InitialUploadWizard, NewDeviceDownloadOverlay, CredentialSetupBanner, Toaster)
- 4 useState hooks and 2 useRef guards purely for sync-UI gating (`linkDialogUserId`, `uploadWizardUserId`, `downloadOverlayUserId`, `deferredOverlayReady`, + refs)
- 2 `useCallback` + 4 `useEffect` blocks encoding the mutual-exclusion rules (link → upload → overlay → banner)
- Dev-only `window.__forceDownloadOverlay` test shim lives in App.tsx
- `useAuthLifecycle` callback (`onUnlinkedDetected`) is App-defined; App becomes the glue between auth lifecycle and sync UI

**Carrying cost:** Every new sync-UI story edits App.tsx, forcing reviewers to re-reason about the gating sequence and risking regressions in unrelated lifecycle code (vector store init, YouTube refresh, motion/theme providers).

## Goals

1. `App.tsx` returns to a ~pure provider + router shell: global providers (ErrorBoundary, ThemeProvider, MotionConfig), global app-wide hooks (theming/accessibility/vector-store/notifications/YouTube refresh), and `<RouterProvider />`.
2. All sync/onboarding floating UI and its gating state live in a single `SyncUXShell` component.
3. Behavior is byte-identical — no visible or observable change to users, tests, or timing.

## Non-Goals

- No redesign of the individual floaters (LinkDataDialog et al.) — same props, same behavior.
- No change to `useSyncLifecycle` / `useAuthLifecycle` internals.
- No change to `MissingCredentialsProvider` contract or placement relative to router.
- No new abstraction for "future sync UI registration" — YAGNI; the shell is simply a co-located home, not a plugin system.
- No changes to Toaster's visual behavior (but see Open Question 1 on whether it moves).

## Proposed Shape

**New file:** `src/app/components/sync/SyncUXShell.tsx`

**Responsibilities of `SyncUXShell`:**
- Owns: `linkDialogUserId`, `uploadWizardUserId`, `downloadOverlayUserId`, `deferredOverlayReady`, `evaluationInFlightRef`, `downloadEvaluationInFlightRef`.
- Owns: `evaluateWizard`, `evaluateDownloadOverlay`, `handleUnlinkedDetected`, `handleLinkDialogResolved` callbacks.
- Owns: the 4 effects coordinating mutual exclusion + the 2s deferred overlay timer + sign-out reset + dev-only `__forceDownloadOverlay` shim.
- Calls `useAuthLifecycle({ onUnlinkedDetected })` and `useSyncLifecycle()` internally — these hooks are intrinsically tied to sync UX, so they move with it.
- Renders: `LinkDataDialog`, `InitialUploadWizard`, `NewDeviceDownloadOverlay`, `CredentialSetupBanner`.
- Wraps children in `MissingCredentialsProvider` so banner + any future credential-aware UI can consume it.

**`SyncUXShell` does NOT own:**
- `Toaster` — it's used by non-sync flows too (generic toasts). Keep in App.tsx as a sibling to `<RouterProvider />`. (See Open Question 1.)
- `WelcomeWizard` — it's onboarding but not sync; already separate, leave alone.
- `PWAUpdatePrompt` / `PWAInstallBanner` / `Agentation` — PWA/dev concerns, not sync. Leave in App.tsx.

**New App.tsx shape:**
```tsx
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
```

Non-sync App-level effects (vector-store, YouTube refresh, notification service, welcome wizard init, orphan-session recovery, font/motion/density hooks) stay in App.tsx — they are global, not sync-specific.

## Acceptance Criteria

1. `src/app/components/sync/SyncUXShell.tsx` exists and owns all 5 items listed under "Responsibilities".
2. `App.tsx` no longer imports `LinkDataDialog`, `InitialUploadWizard`, `NewDeviceDownloadOverlay`, `CredentialSetupBanner`, `MissingCredentialsProvider`, `useAuthLifecycle`, `useSyncLifecycle`, `shouldShowInitialUploadWizard`, `shouldShowDownloadOverlay`, `useDownloadStatusStore`, or `useAuthStore`.
3. `App.tsx` line count drops by ~140 lines (≤170 lines total, down from 310).
4. All existing E92-S08, E97-S03, E97-S04, E97-S05 E2E specs pass unchanged.
5. `window.__forceDownloadOverlay` remains available in dev/test (tests depend on it).
6. `useAuthLifecycle`'s `onUnlinkedDetected` contract is unchanged — still fires and still defers `syncEngine.start()` until `LinkDataDialog` resolves.
7. No change to mount order of providers (ErrorBoundary → ThemeProvider → MotionConfig → MissingCredentialsProvider → RouterProvider).
8. Build, lint, type-check, unit + E2E (Chromium smoke + E97 specs) all green.

## Open Questions

1. **Toaster placement** — Currently inside `MissingCredentialsProvider`. Should it move out (App-level) or stay wrapped? Recommendation: move to App.tsx as sibling of SyncUXShell since toast consumers are not sync-scoped. Planning should verify no sync code depends on MissingCredentialsProvider being an ancestor of Toaster.
2. **MissingCredentialsProvider scope** — It currently wraps `RouterProvider`, meaning all routed pages can consume it. If we move it inside `SyncUXShell` as a wrapper of children (including `RouterProvider`), scope is unchanged. If we move it inside SyncUXShell without wrapping children, routed pages lose access. Planning must preserve current scope.
3. **Naming** — `SyncUXShell` vs. `SyncOverlays` vs. `SyncOnboardingShell`. Pick one in planning; the name should communicate "floating first-run/sync UI container", not "sync engine wrapper".

## Risks

- **Effect ordering regression** — The 4 useEffects have an implicit dependency on execution order (link → upload → overlay gates). Moving them wholesale to SyncUXShell is safe; splitting them is not. Keep the block intact.
- **Dev shim coverage** — Playwright tests use `window.__forceDownloadOverlay`. Ensure the shim still mounts before tests run (same component tree position is sufficient).
- **Hook dispatch timing** — `useAuthLifecycle` and `useSyncLifecycle` currently run at App mount; moving them into SyncUXShell means they run once SyncUXShell mounts, which is the same point in practice (SyncUXShell mounts synchronously with App). Verify no test relies on these hooks firing before `RouterProvider` mounts — they shouldn't, but confirm.

## Success Signal

- `App.tsx` reads top-to-bottom as "global providers + router + global PWA/dev shims" in under 170 lines.
- Next sync UI story (E93 conflict overlay, future multi-device status, etc.) edits only `SyncUXShell.tsx`, not `App.tsx`.
- Reviewer can reason about provider composition without scrolling past sync gating logic.

## Handoff to Planning

This is a mechanical extraction, no product decisions pending. `/ce:plan` should produce 1 story (or 1 quick-spec) covering the move + the 3 Open Questions resolved by code reading. Estimated effort: 1 session, ≤300 LOC diff (net reduction in App.tsx).
