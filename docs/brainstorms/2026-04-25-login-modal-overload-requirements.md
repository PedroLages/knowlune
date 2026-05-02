# Login Modal Overload — Requirements

## Problem Statement

On first login (or new-device login), Knowlune can present up to six overlapping UI interruptions in rapid succession: `WelcomeWizard`, `OnboardingOverlay`, `LinkDataDialog`, `InitialUploadWizard`, `NewDeviceDownloadOverlay`, and `CredentialSetupBanner`. The most critical failure is `NewDeviceDownloadOverlay`, which is non-dismissible during active sync phases (`hydrating-p3p4`, `downloading-p0p2`) for up to 60 seconds — yet sync runs silently in the background regardless of whether the modal is open. On mobile, users are trapped with no escape. The WelcomeWizard and OnboardingOverlay compound the problem by firing sequentially with a 400ms gap between them, creating the sensation of an unending tutorial gauntlet on what should be a joyful first session.

## Root Causes

1. **NewDeviceDownloadOverlay is a blocking modal for a non-blocking operation.** The sync engine downloads data regardless of modal state. The overlay's `onOpenChange` handler blocks dismiss during `hydrating-p3p4` and `downloading-p0p2` phases, trapping users for up to 60 seconds (`WATCHDOG_MS`). There is no "Continue in background" button.

2. **WelcomeWizard and OnboardingOverlay create a sequential tutorial pile-up.** WelcomeWizard fires for all new users at page load. OnboardingOverlay subscribes to `useWelcomeWizardStore.completedAt` and initializes ~400ms after WelcomeWizard resolves. Both describe "getting started" but are architecturally separate stores, creating two back-to-back first-run experiences.

3. **Race condition between NewDeviceDownloadOverlay and LinkDataDialog.** In `SyncUXShell.tsx`, `evaluateDownloadOverlay` is an async function that makes two async I/O operations (Dexie scan + Supabase HEAD counts). The guard checking `linkDialogUserId` is evaluated at the moment the effect fires, but by the time the async evaluation resolves, `linkDialogUserId` may have become non-null. The `setDownloadOverlayUserId` call then fires unconditionally, mounting the overlay on top of an already-showing LinkDataDialog.

4. **OnboardingOverlay fires for returning users on new devices.** The `importedCourses.length > 0` skip guard fails for new-device sessions because the course store is empty at initialization time even if the user has remote data being restored.

## Proposed Solution

**Decision A: Keep WelcomeWizard, delete OnboardingOverlay**

WelcomeWizard serves a real purpose (sets font size preference, 2 steps, dismissible, localStorage-persisted per device). Keeping it is correct.

OnboardingOverlay is redundant — its 3-step guide fires AFTER WelcomeWizard on the same session, even for returning users on new devices. The `importedCourses.length > 0` skip guard fails for new-device sessions. Delete it entirely.

**Decision B: Add "Continue in background" button to NewDeviceDownloadOverlay**

The overlay remains a modal (not a toast) — the visual weight correctly communicates that something important is happening with the user's data. However, it must not trap the user. A "Continue in background" button is added to both `hydrating-p3p4` and `downloading-p0p2` phase renders. Clicking it dismisses the overlay while sync continues silently. The existing `onOpenChange` guard stays blocking (prevents accidental Escape/outside-click dismiss on mobile) — the button calls `onClose()` directly, bypassing the guard.

**Decision C: Add useEffect cleanup that clears downloadOverlayUserId when linkDialogUserId becomes non-null**

A new `useEffect` in `SyncUXShell.tsx` watches `linkDialogUserId` and clears `downloadOverlayUserId` + `deferredOverlayReady` whenever it becomes non-null. This handles the race retroactively: even if the async evaluation resolved and set `downloadOverlayUserId` before `linkDialogUserId` was set, the cleanup fires on the next render cycle.

## Acceptance Criteria

1. During `hydrating-p3p4` and `downloading-p0p2` phases, a "Continue in background" button is visible below the progress bar. Clicking it dismisses the modal; sync continues.
2. Pressing Escape or clicking outside the overlay during active phases does NOT dismiss it (guard remains).
3. `OnboardingOverlay` component is deleted. `useOnboardingStore` store and `OnboardingStep` component are deleted. All imports are cleaned up.
4. `WelcomeWizard` is unchanged and continues to fire on first visit per device.
5. When `LinkDataDialog` is open, `NewDeviceDownloadOverlay` must not appear — even if `shouldShowDownloadOverlay()` resolved true in a concurrent async evaluation.
6. When a returning user logs in on a new device: they see `NewDeviceDownloadOverlay`, can dismiss it via "Continue in background", data syncs in the background, and they do NOT see `OnboardingOverlay` afterward.
7. New users (no remote data, no local data) see only `WelcomeWizard`. They do not see `OnboardingOverlay` or `NewDeviceDownloadOverlay`.
8. Build, lint, and type-check pass with zero errors after all deletions.

## Out of Scope

- `CredentialSetupBanner` — already dismissible, fires after sync, acceptable UX
- `LinkDataDialog` — intentionally non-dismissible (requires real user decision with data consequences)
- `InitialUploadWizard` — already has "Skip for now" button, correctly designed
- Redesigning WelcomeWizard content or steps
- Adding replacement onboarding tooltips or in-app discovery hints
- Changing the 2-second defer timer on `NewDeviceDownloadOverlay`

## Files to Modify

- `src/app/components/sync/NewDeviceDownloadOverlay.tsx` — add "Continue in background" button to both active phases
- `src/app/components/sync/SyncUXShell.tsx` — add race-condition cleanup useEffect
- `src/app/components/onboarding/OnboardingOverlay.tsx` — **delete**
- `src/app/components/onboarding/OnboardingStep.tsx` — **delete**
- `src/stores/useOnboardingStore.ts` — **delete**
- `src/app/components/Layout.tsx` — remove OnboardingOverlay import and mount site

## Testing Notes

**Manual — dismiss during active sync:**
1. Sign in from a fresh browser profile (clear IndexedDB) on an account with existing Supabase data
2. Wait for `NewDeviceDownloadOverlay` to appear (after 2s defer)
3. While in active phase, click "Continue in background"
4. Verify: modal closes, sync continues, data appears in app

**Manual — race condition:**
1. Add network throttle in DevTools to slow Supabase requests
2. Sign in to account where `hasUnlinkedRecords` returns true
3. Verify: `LinkDataDialog` appears, `NewDeviceDownloadOverlay` does NOT co-appear

**Manual — no OnboardingOverlay:**
1. Clear all localStorage
2. Sign in as any user, dismiss WelcomeWizard
3. Verify: no second overlay appears, app goes directly to dashboard

**E2E:**
- Add test using `window.__forceDownloadOverlay` in `hydrating-p3p4` phase — verify "Continue in background" button exists and dismisses modal
- Remove/update any E2E specs that test `OnboardingOverlay` visibility
