# Login Modal Overload Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 3 UX bugs that cause up to 6 overlapping modals on first login: add a dismiss button to the sync overlay, delete the redundant OnboardingOverlay, and fix a race condition that lets two sync dialogs co-appear.

**Architecture:** Three independent surgical changes sharing a single commit group. No new abstractions — pure subtraction (OnboardingOverlay deleted) and minimal addition (one button, one useEffect).

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS v4, Radix UI Dialog

---

## Context

The app stacks up to 6 modals/overlays on first login. The screenshot shows `NewDeviceDownloadOverlay` ("Finishing sync — fetching your content…") with no close button, visible to the user BEFORE they can interact with the app. Three distinct bugs:

1. `NewDeviceDownloadOverlay` has no escape during 60-second watchdog window
2. `WelcomeWizard` + `OnboardingOverlay` fire back-to-back — redundant tutorial pile-up
3. Race condition: async `shouldShowDownloadOverlay()` can resolve after `linkDialogUserId` is set, mounting two dialogs simultaneously

**Last-green SHA:** `3b54b3ec840687835d8b63dd1d7d8765d950492a`

---

## Task 1: Add "Continue in background" button — hydrating-p3p4 phase

**File:** `src/app/components/sync/NewDeviceDownloadOverlay.tsx`

Inside the `{visualPhase === 'hydrating-p3p4' && (...)}` block, inside `div.space-y-2`, after the `<p>` progress text, add:

```tsx
<div className="flex justify-center pt-1">
  <Button
    variant="ghost"
    size="sm"
    className="text-muted-foreground text-xs"
    onClick={onClose}
    data-testid="new-device-download-background-hydrating"
  >
    Continue in background
  </Button>
</div>
```

`Button` is already imported (line 29). No new imports needed. `onOpenChange` guard is intentionally left unchanged — Escape/outside-click remain blocked; the button provides intentional dismiss only.

---

## Task 2: Add "Continue in background" button — downloading-p0p2 phase

**File:** `src/app/components/sync/NewDeviceDownloadOverlay.tsx`

Same pattern, inside the `{visualPhase === 'downloading-p0p2' && (...)}` block, inside `div.space-y-2`, after the `<p>` progress text:

```tsx
<div className="flex justify-center pt-1">
  <Button
    variant="ghost"
    size="sm"
    className="text-muted-foreground text-xs"
    onClick={onClose}
    data-testid="new-device-download-background-downloading"
  >
    Continue in background
  </Button>
</div>
```

---

## Task 3: Add race-condition cleanup effect to SyncUXShell

**File:** `src/app/components/sync/SyncUXShell.tsx`

After the wizard fast-path effect (around line 165), before the `// E97-S04: New-device download overlay gate.` comment, insert:

```typescript
  // Race-condition guard: if linkDialogUserId becomes non-null after
  // shouldShowDownloadOverlay resolved (async network gap), clear the
  // overlay state so the two dialogs never co-appear.
  useEffect(() => {
    if (!linkDialogUserId) return
    setDownloadOverlayUserId(null)
    setDeferredOverlayReady(false)
  }, [linkDialogUserId])
```

All three identifiers are already in scope. No new imports or state needed.

**Commit tasks 1-3:**
```bash
git add src/app/components/sync/NewDeviceDownloadOverlay.tsx src/app/components/sync/SyncUXShell.tsx
git commit -m "fix(sync): add 'Continue in background' button + race-condition guard"
```

---

## Task 4: Delete OnboardingOverlay, OnboardingStep, useOnboardingStore

**Step 1: Find all references**
```bash
grep -rn "OnboardingOverlay\|useOnboardingStore\|OnboardingStep" src/ --include="*.tsx" --include="*.ts" -l
```

**Step 2: Delete source files**
```bash
rm src/app/components/onboarding/OnboardingOverlay.tsx
rm src/app/components/onboarding/OnboardingStep.tsx
rm src/stores/useOnboardingStore.ts
rmdir src/app/components/onboarding 2>/dev/null || true
```

**Step 3: Remove from Layout.tsx**
- Remove import: `import { OnboardingOverlay } from './onboarding/OnboardingOverlay'`
- Remove mount: `<OnboardingOverlay />` and its comment

**Step 4: Check test files**
```bash
grep -rn "OnboardingOverlay\|useOnboardingStore\|OnboardingStep" tests/ --include="*.ts" --include="*.spec.ts" -l 2>/dev/null
```
Delete or update any matching test files.

**Step 5: Verify zero remaining references**
```bash
grep -rn "OnboardingOverlay\|useOnboardingStore\|OnboardingStep" src/ tests/ --include="*.tsx" --include="*.ts" 2>/dev/null
```
Expected: zero results.

**Commit:**
```bash
git add -A
git commit -m "feat(ux): remove redundant OnboardingOverlay and useOnboardingStore"
```

---

## Task 5: Build, lint, type-check

```bash
lsof -ti:5173 | xargs kill 2>/dev/null || true
npm run build
npm run lint
npx tsc --noEmit
```

Expected: all three pass with zero errors.

---

## Task 6: Manual verification

**Dismiss button test:**
```javascript
// In browser console (dev server running):
window.__forceDownloadOverlay('any-user-id')
// Verify: overlay appears with "Continue in background" button
// Click button → overlay closes
// Escape key and outside-click should NOT close the overlay
```

**Race condition test:** Clear IndexedDB, set Slow 3G throttle, sign in to account with local unlinked data. Verify LinkDataDialog appears without NewDeviceDownloadOverlay co-appearing.

**No OnboardingOverlay test:** `localStorage.clear()` → reload → sign in → dismiss WelcomeWizard → verify no second overlay appears.

---

## Verification

- `npm run build` — zero errors
- `npm run lint` — zero errors
- `npx tsc --noEmit` — zero type errors
- All 3 manual tests pass

**Post-fix invariants:**
- `NewDeviceDownloadOverlay` always has an intentional escape hatch
- `LinkDataDialog` and `NewDeviceDownloadOverlay` can never co-appear
- First login = WelcomeWizard (if new device) + sync overlay (if returning user) — nothing else
- `OnboardingOverlay`, `OnboardingStep`, `useOnboardingStore` fully removed
