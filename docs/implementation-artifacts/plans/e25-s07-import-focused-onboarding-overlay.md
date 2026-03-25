# Implementation Plan: E25-S07 Import Focused Onboarding Overlay

**Story:** E25-S07 — Import Focused Onboarding Overlay
**Date:** 2026-03-23
**Complexity:** Medium (3-5 hours)
**Branch:** `feature/e25-s07-import-focused-onboarding-overlay`

## Overview

Replace the existing 3-step onboarding wizard (E10-S01) with a focused, single-action overlay that guides new users to import their first course. The existing onboarding components (`OnboardingOverlay`, `OnboardingStep`, `useOnboardingStore`) exist but are **not rendered in Layout.tsx** — and the E10-S01 review flagged critical accessibility gaps (missing focus trap, missing `prefers-reduced-motion`). This story rewrites the overlay to be import-centric, uses Radix Dialog for proper accessibility, and activates it in the app.

## Architecture Decision: Rewrite vs Modify

**Decision: Rewrite the overlay and step components; refactor the store.**

Rationale:
- The E10-S01 overlay uses a custom `<div role="dialog">` — all 3 review agents flagged missing focus trap as a **blocker**. Switching to Radix Dialog (via shadcn/ui) is mandatory.
- The 3-step wizard model (import → study → challenge) becomes a single-step model (import only). Simplifying the store is cleaner than conditional-branching the existing step logic.
- The `OnboardingStep.tsx` step configs (3 steps with icons/descriptions/CTAs) are replaced by a single import-focused layout — no value in preserving the multi-step structure.
- The localStorage key (`levelup-onboarding-v1`) and persistence model stay the same for backward compatibility.

## Detailed Steps

### Step 1: Refactor `useOnboardingStore.ts` (AC: 1, 4, 5)

**File:** `src/stores/useOnboardingStore.ts`

**Changes:**
- Remove `OnboardingStep` type (0|1|2|3) — replace with simpler boolean model
- Remove `currentStep` and `advanceStep()` — no multi-step progression
- Keep: `isActive`, `completedAt`, `skipped`, `initialize()`, `skipOnboarding()`, `completeOnboarding()`, `dismiss()`
- Add: `importTriggeredFromOverlay: boolean` flag — tracks whether the user clicked the import CTA from the overlay (so we know to show celebration on import success)
- Add: `setImportTriggered()` action — sets the flag when CTA is clicked
- Keep: same `STORAGE_KEY = 'levelup-onboarding-v1'` for backward compatibility
- Keep: same `loadPersistedState()` / `persistCompletion()` functions

**New interface:**
```typescript
interface OnboardingState {
  isActive: boolean
  completedAt: string | null
  skipped: boolean
  importTriggeredFromOverlay: boolean
}

interface OnboardingActions {
  initialize: () => void
  skipOnboarding: () => void
  completeOnboarding: () => void
  dismiss: () => void
  setImportTriggered: () => void
}
```

**Migration note:** Existing localStorage data `{ completedAt, skipped }` works unchanged. Users who completed E10-S01 onboarding won't see the new overlay.

### Step 2: Rewrite `OnboardingOverlay.tsx` (AC: 1, 2, 6, 7, 8)

**File:** `src/app/components/onboarding/OnboardingOverlay.tsx`

**Approach:** Complete rewrite using shadcn/ui `Dialog` component for proper focus trap and accessibility.

**Component structure:**
```tsx
<Dialog open={isActive} onOpenChange={handleOpenChange}>
  <DialogContent className="max-w-md rounded-[24px] p-8">
    {/* Welcome heading */}
    <DialogHeader>
      <DialogTitle>Welcome to Knowlune</DialogTitle>
      <DialogDescription>
        Import a course folder to start your learning journey.
      </DialogDescription>
    </DialogHeader>

    {/* Hero icon */}
    <div className="mx-auto size-16 rounded-full bg-brand-soft flex items-center justify-center">
      <FolderOpen className="size-8 text-brand" />
    </div>

    {/* Import CTA */}
    <Button variant="brand" size="lg" onClick={handleImport}>
      Import Your First Course
    </Button>

    {/* Skip link */}
    <button onClick={skipOnboarding}>Skip for now</button>
  </DialogContent>
</Dialog>
```

**Key behaviors:**
1. `Dialog` `open` prop controlled by `isActive` from store
2. `onOpenChange(false)` → calls `skipOnboarding()` (handles Escape + backdrop click)
3. Import CTA → calls `setImportTriggered()` + `dismiss()` + `importCourseFromFolder()`
4. On import error, overlay does NOT reappear (user dismissed it; they can import manually)
5. Animation: `motion/react` on `DialogContent`, gated by `prefers-reduced-motion`

**Radix Dialog benefits (fixing E10-S01 blockers):**
- Focus trap: automatic (B-01 from design review)
- `aria-modal`: automatic
- Escape key: handled by `onOpenChange`
- Initial focus: automatic (on first focusable element = CTA)

### Step 3: Delete `OnboardingStep.tsx` (cleanup)

**File:** `src/app/components/onboarding/OnboardingStep.tsx`

The multi-step content and step indicator components are no longer needed. Delete the file entirely. The new overlay is self-contained within `OnboardingOverlay.tsx`.

### Step 4: Integrate into Layout.tsx (AC: 1, 5)

**File:** `src/app/components/Layout.tsx`

**Changes:**
- Import `OnboardingOverlay` from `@/app/components/onboarding/OnboardingOverlay`
- Render `<OnboardingOverlay />` as a sibling to the main content (Radix Dialog renders via portal, so placement is flexible)
- No conditional rendering needed — the component internally checks `isActive` and renders nothing when inactive

**Integration point:**
```tsx
// In Layout.tsx, alongside existing overlays
<OnboardingOverlay />
<SearchCommandPalette />
<KeyboardShortcutsDialog />
```

### Step 5: Handle import success celebration (AC: 3)

**File:** `src/app/components/onboarding/OnboardingOverlay.tsx`

**Approach:** Subscribe to `useCourseImportStore` after import is triggered from overlay.

```typescript
useEffect(() => {
  if (!importTriggeredFromOverlay) return

  const unsub = useCourseImportStore.subscribe(state => {
    if (state.importedCourses.length > 0 && !state.isImporting) {
      completeOnboarding()
      triggerConfetti()  // reuse existing confetti pattern
    }
  })
  return unsub
}, [importTriggeredFromOverlay, completeOnboarding])
```

**Celebration options (pick one during implementation):**
- Canvas confetti (already a dependency, used in E10-S01) — gated by `prefers-reduced-motion`
- Sonner toast: `toast.success("Course imported! You're ready to learn.")`
- Recommend: Both — confetti for delight + toast for confirmation

### Step 6: Update E2E Tests (AC: all)

**File:** `tests/e2e/onboarding.spec.ts`

**Rewrite existing tests** to match new behavior:

| Test | What It Validates | AC |
|------|------------------|-----|
| Overlay appears on first visit | Dialog visible, welcome text, import CTA, skip option | AC1 |
| Import CTA triggers import flow | Click CTA → file picker opens (or demo course loads) | AC2 |
| Successful import completes onboarding | Import demo course → celebration → overlay gone → course visible | AC3 |
| Skip persists and no reappear | Click skip → localStorage set → reload → no dialog | AC4 |
| Escape key dismisses | Press Escape → dialog gone → localStorage set | AC4 |
| Pre-completed state | Seed localStorage → navigate → no dialog | AC5 |
| Focus trap | Tab cycles within dialog, doesn't escape to page | AC6 |

**Test setup (unchanged):**
```typescript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => {
    localStorage.removeItem(key)
  }, ONBOARDING_KEY)
})
```

**Demo course strategy:** For the "import CTA triggers import flow" test, the test runs in Chromium where File System Access API may not work in headless mode. Use the demo course fallback path — the overlay should detect that import completed regardless of mechanism.

## Files Changed

| File | Action | Lines (est.) |
|------|--------|-------------|
| `src/stores/useOnboardingStore.ts` | Refactor | ~70 (from 96) |
| `src/app/components/onboarding/OnboardingOverlay.tsx` | Rewrite | ~100 (from 186) |
| `src/app/components/onboarding/OnboardingStep.tsx` | Delete | -122 |
| `src/app/components/Layout.tsx` | Add import + render | +3 |
| `tests/e2e/onboarding.spec.ts` | Rewrite | ~100 (from 120) |

**Net change:** ~-130 lines (simpler is better)

## Dependencies

- **shadcn/ui Dialog**: Already in `src/app/components/ui/dialog.tsx` — no install needed
- **canvas-confetti**: Already a dependency — reuse for celebration
- **motion/react**: Already a dependency — reuse for animation
- **lucide-react**: Already a dependency — `FolderOpen` icon
- **`importCourseFromFolder()`**: From `src/lib/courseImport.ts` — triggers folder picker
- **Demo course**: From `src/data/demo-course.ts` — fallback for unsupported browsers

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing E2E tests break | High | Medium | Tests are being rewritten anyway |
| File System Access API fails in test | Medium | Low | Use demo course fallback |
| localStorage migration issue | Low | Medium | Same key + same schema = no migration needed |
| Focus trap conflicts with other dialogs | Low | Low | Radix Dialog handles nesting automatically |

## Design Tokens Used

| Token | Usage |
|-------|-------|
| `bg-card` | Dialog background |
| `bg-brand-soft` | Icon circle background |
| `text-brand` | Icon color |
| `text-foreground` | Title text |
| `text-muted-foreground` | Description, skip link |
| `rounded-[24px]` | Dialog border radius (design system standard) |
| `Button variant="brand"` | Primary CTA |

## Out of Scope

- Author detection during import (E25-S04)
- Progressive sidebar disclosure (E25-S08)
- Empty state improvements (E25-S09)
- Multi-step wizard restoration (E10-S01 approach is being replaced)
- Import wizard flow (E24-S02, E24-S03)

## Success Criteria

1. New users see a focused, single-action overlay on first visit
2. Import CTA triggers the import workflow directly from the overlay
3. Skip/Escape dismisses permanently
4. Proper focus trap (Radix Dialog) — fixing E10-S01 blocker
5. `prefers-reduced-motion` respected — fixing E10-S01 high issue
6. All E2E tests pass
7. Net reduction in code complexity (~130 fewer lines)
