# E21-S07: Age-Appropriate Defaults & Font Scaling — Implementation Plan

**Story:** [21-7-age-appropriate-defaults-and-font-scaling.md](../21-7-age-appropriate-defaults-and-font-scaling.md)
**Epic:** [epic-21-engagement-adaptive-experience.md](../../planning-artifacts/epic-21-engagement-adaptive-experience.md)
**Created:** 2026-03-23
**Estimated Effort:** 10h

## Architecture Overview

This story adds three capabilities:
1. **Font scaling system** — CSS variable approach scaling all rem-based typography
2. **Age range wizard** — optional first-visit overlay with age-specific defaults
3. **Settings UI** — font size picker and age range display/reset

### Key Architectural Decision: Font Scaling via `--font-size`

The codebase already has `html { font-size: var(--font-size) }` in `theme.css:344` with `--font-size: 16px` in `:root`. All Tailwind v4 text utilities (`text-sm`, `text-lg`, etc.) use `rem` units. Headings use CSS variables (`--text-2xl`, `--text-xl`, etc.) which are also rem-based.

**Approach:** Change `--font-size` on the `<html>` element to scale everything proportionally:
- Small: `14px` → 0.875x base
- Medium: `16px` → 1x base (default)
- Large: `18px` → 1.125x base
- Extra Large: `20px` → 1.25x base

This is the simplest approach — no multiplier system, no individual component changes. The entire app scales because every `rem` value derives from `html { font-size }`.

### Dependency Note: E21-S05 (User Engagement Preference Controls)

E21-S05 is `backlog`. The epic specifies age-specific defaults for gamification toggles (achievements, streaks, badges). Since E21-S05 hasn't built the toggle infrastructure, this story will:
- **Include:** Font scaling + age wizard + reduced-animations toggle (Boomer default)
- **Exclude:** Gamification toggles (achievements, streaks, badges, vibrant colors) — deferred to E21-S05
- **Future-proof:** The `ageRange` field in AppSettings enables E21-S05 to read it and apply gamification defaults later

## Step-by-Step Implementation

### Step 1: Extend AppSettings Interface (AC: 2, 3, 5, 6)

**File:** `src/lib/settings.ts`

Add three new fields to `AppSettings`:

```typescript
export type FontSizeScale = 'small' | 'medium' | 'large' | 'extra-large'
export type AgeRange = 'gen-z' | 'millennial' | 'boomer'

export interface AppSettings {
  // ... existing fields
  fontSizeScale: FontSizeScale
  ageRange?: AgeRange            // undefined = not set / cleared
  reduceAnimations: boolean
}
```

Update `defaults`:
```typescript
const defaults: AppSettings = {
  // ... existing
  fontSizeScale: 'medium',
  ageRange: undefined,
  reduceAnimations: false,
}
```

**Why separate `reduceAnimations` from `prefers-reduced-motion`:** The OS-level preference is already respected via CSS `@media (prefers-reduced-motion: reduce)` in `index.css:306-320`. This new field provides an in-app override for users who don't want to change their OS setting.

**Backward compatibility:** `getSettings()` already spreads `{ ...defaults, ...JSON.parse(raw) }`, so existing users without these fields get defaults automatically.

### Step 2: CSS Font Scaling System (AC: 3, 4)

**File:** `src/styles/theme.css`

No CSS changes needed for the scaling itself — the `--font-size` variable is already wired to `html { font-size }`. The JavaScript in Step 4 will set `--font-size` dynamically.

**File:** `src/styles/index.css`

Add an app-level reduced-animations class (complements the OS-level media query):

```css
/* App-level animation reduction (user preference, not OS-level) */
.reduce-animations,
.reduce-animations *,
.reduce-animations *::before,
.reduce-animations *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
```

**Font size → pixel mapping (constant, defined in JS):**
```typescript
export const FONT_SIZE_PX: Record<FontSizeScale, number> = {
  'small': 14,
  'medium': 16,
  'large': 18,
  'extra-large': 20,
}
```

### Step 3: Age Wizard Store (AC: 1, 6)

**New file:** `src/stores/useAgeWizardStore.ts`

Follow `useOnboardingStore.ts` pattern exactly:

```typescript
const STORAGE_KEY = 'levelup-age-wizard-v1'

interface AgeWizardState {
  isActive: boolean
  completedAt: string | null
  skipped: boolean
}

interface AgeWizardActions {
  initialize: () => void          // Check localStorage, show if not completed
  selectAgeRange: (range: AgeRange) => void  // Apply defaults + close
  skipWizard: () => void          // Close without applying
  dismiss: () => void             // Close overlay
  reset: () => void               // Clear completion (for Settings "change age range")
}
```

**Key behaviors:**
- `initialize()` — called from Layout after onboarding is completed/skipped. Checks localStorage; if no `completedAt`, sets `isActive: true`
- `selectAgeRange()` — saves age range to AppSettings, applies age-specific defaults (font size, reduceAnimations), persists completion, closes wizard
- `skipWizard()` — persists completion as skipped, does NOT change any settings
- `reset()` — clears localStorage key, allowing wizard to re-trigger (used from Settings "Change age range")

**Privacy:** Only `completedAt` and `skipped` are stored in the wizard's localStorage key. The `ageRange` itself lives in `app-settings` (AppSettings), which is local-only. Both are included in `exportAllData()` / cleared by `resetAllData()`.

### Step 4: Layout Integration — Apply Font Scale (AC: 3, 4)

**File:** `src/app/components/Layout.tsx`

In the existing `useEffect` that already watches `settings`, add:

```typescript
// Apply font size scale to <html> element
useEffect(() => {
  const px = FONT_SIZE_PX[settings.fontSizeScale] ?? 16
  document.documentElement.style.setProperty('--font-size', `${px}px`)
}, [settings.fontSizeScale])

// Apply reduce-animations class to <html> element
useEffect(() => {
  document.documentElement.classList.toggle('reduce-animations', settings.reduceAnimations)
}, [settings.reduceAnimations])
```

Also render the `AgeWizardOverlay` component (after OnboardingOverlay):

```tsx
<OnboardingOverlay />
<AgeWizardOverlay />
```

**Sequencing with onboarding:** The age wizard should only show after onboarding completes. The `AgeWizardOverlay` will check `useOnboardingStore` state — if onboarding is still active, the wizard defers.

### Step 5: Age Wizard Overlay Component (AC: 1, 2)

**New file:** `src/app/components/onboarding/AgeWizardOverlay.tsx`

A simpler version of `OnboardingOverlay.tsx` — single screen, not multi-step:

**UI Structure:**
```
┌─────────────────────────────────────┐
│           Welcome!                  │
│  Help us personalize your           │
│  learning experience.               │
│                                     │
│  What's your age range?             │
│  (This stays on your device only)   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ ○ Gen Z (16-25)             │   │
│  │ ○ Millennial (26-40)        │   │
│  │ ○ Boomer (55+)              │   │
│  └──────────────────────────────┘   │
│                                     │
│  [Apply]              [Skip]    [X] │
└─────────────────────────────────────┘
```

**Key behaviors:**
- Uses `motion.div` with `AnimatePresence` for fade-in (matches onboarding pattern)
- `RadioGroup` for age selection with descriptions
- "Apply" button calls `selectAgeRange()` which applies defaults
- "Skip" button calls `skipWizard()` — no defaults applied
- X button / Escape key dismisses
- Shows privacy note: "This stays on your device only"
- Defers to onboarding: only renders when `useOnboardingStore.completedAt` is non-null

**Age-specific defaults applied on selection:**

| Setting | Gen Z | Millennial | Boomer |
|---------|-------|-----------|--------|
| `fontSizeScale` | `'medium'` | `'medium'` | `'large'` |
| `reduceAnimations` | `false` | `false` | `true` |

### Step 6: Settings Page — Font Size Picker & Age Range (AC: 3, 5)

**File:** `src/app/pages/Settings.tsx`

Add a new Card section after the "Appearance" card (theme selection):

#### 6a: Font Size Picker

```
┌─────────────────────────────────────┐
│ Display & Accessibility             │
│─────────────────────────────────────│
│ Font Size                           │
│ ○ Small    ○ Medium                 │
│ ○ Large    ○ Extra Large            │
│                                     │
│ Preview: The quick brown fox...     │
│─────────────────────────────────────│
│ Reduce Animations                   │
│ [Toggle switch]                     │
│ Minimize motion effects throughout  │
│ the app                             │
│─────────────────────────────────────│
│ Age Range                           │
│ Currently: Boomer                   │
│ [Change]  [Clear]                   │
└─────────────────────────────────────┘
```

**Font size picker:** `RadioGroup` with 4 options. On change:
1. Update `settings.fontSizeScale`
2. Call `saveSettings()`
3. Dispatch `settingsUpdated` event (triggers Layout re-read)

**Reduce animations toggle:** `Switch` component. On change:
1. Update `settings.reduceAnimations`
2. Call `saveSettings()`
3. Dispatch `settingsUpdated` event

**Age range display:**
- Shows current `settings.ageRange` if set (with label mapping)
- "Change" button: resets wizard store and opens wizard dialog inline (or re-triggers overlay)
- "Clear" button: sets `settings.ageRange = undefined` and saves

#### 6b: Live Preview

Show a small text preview that updates immediately when font size changes. This gives instant feedback without needing to look at the rest of the app.

### Step 7: E2E Tests (AC: 1-6)

**New file:** `tests/e2e/story-e21-s07.spec.ts`

Follow patterns from `tests/e2e/onboarding.spec.ts`:

**Test scenarios:**

1. **Age wizard shows on first visit (AC1)**
   - Clear localStorage
   - Complete/skip onboarding
   - Verify wizard overlay appears
   - Verify wizard can be skipped (Escape key)
   - Verify wizard doesn't appear on reload after skip

2. **Age wizard applies Boomer defaults (AC2)**
   - Select "Boomer" in wizard
   - Verify `--font-size` is `18px` on `<html>`
   - Verify `reduce-animations` class is on `<html>`

3. **Age wizard applies Gen Z defaults (AC2)**
   - Select "Gen Z" in wizard
   - Verify `--font-size` is `16px` (medium)
   - Verify no `reduce-animations` class

4. **Font size picker in Settings (AC3)**
   - Navigate to Settings
   - Select each font size option
   - Verify `--font-size` CSS property changes accordingly
   - Reload page, verify persistence

5. **Proportional scaling maintained (AC4)**
   - Set font size to Extra Large
   - Verify h1 computed font-size > h2 > h3 > body
   - (Hierarchy check via `getComputedStyle`)

6. **Age range display and reset in Settings (AC5)**
   - Complete wizard as Millennial
   - Go to Settings, verify "Millennial" displayed
   - Click "Clear", verify age range removed
   - Verify font size unchanged (overrides preserved)

7. **Privacy — data is local-only (AC6)**
   - Verify no network requests contain age data
   - Verify age range present in exported data
   - Verify "Reset All Data" clears age range

## File Inventory

### New Files (3)

| File | Purpose | Lines (est.) |
|------|---------|-------------|
| `src/stores/useAgeWizardStore.ts` | Zustand store for wizard state | ~70 |
| `src/app/components/onboarding/AgeWizardOverlay.tsx` | Wizard overlay component | ~120 |
| `tests/e2e/story-e21-s07.spec.ts` | E2E test suite | ~200 |

### Modified Files (4)

| File | Changes | Lines Changed (est.) |
|------|---------|---------------------|
| `src/lib/settings.ts` | Add `FontSizeScale`, `AgeRange` types + new fields + `FONT_SIZE_PX` constant | +20 |
| `src/styles/index.css` | Add `.reduce-animations` class | +10 |
| `src/app/components/Layout.tsx` | Apply font scale + animations class + render AgeWizardOverlay | +25 |
| `src/app/pages/Settings.tsx` | New "Display & Accessibility" card section | +120 |

### Unchanged Files (leveraged as-is)

| File | Why |
|------|-----|
| `src/styles/theme.css` | `--font-size` and `html { font-size: var(--font-size) }` already wired |
| `src/stores/useOnboardingStore.ts` | Pattern replicated; also read for sequencing |
| `src/app/components/onboarding/OnboardingOverlay.tsx` | Pattern replicated |
| `src/lib/motion.ts` | Animation variants unchanged |

## Build Sequence

Execute in this order (each step builds on the previous):

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6 → Step 7
 types    CSS      store    layout   wizard   settings  tests
```

**Rationale:** Types and CSS first (foundation). Store next (data layer). Layout integration applies the data. Wizard produces the data. Settings provides manual control. Tests validate everything.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Font scaling breaks layouts (overflow, clipping) | HIGH | Test all pages at Extra Large; spot-check sidebar, header, cards |
| Wizard timing conflict with onboarding | MEDIUM | Guard: only show wizard when `useOnboardingStore.completedAt` is truthy |
| `reduce-animations` class too aggressive | MEDIUM | Use `!important` sparingly; test that essential transitions still work |
| Settings backward compat | LOW | `getSettings()` already spreads defaults; new fields auto-populated |

## WCAG Compliance Checklist

- [ ] Font scaling maintains 4.5:1 contrast at all sizes
- [ ] Wizard overlay is keyboard-navigable (Tab, Enter, Escape)
- [ ] RadioGroup has proper ARIA labels
- [ ] Privacy note is accessible (not hidden from screen readers)
- [ ] Touch targets remain >= 44x44px at Small font size
- [ ] `reduceAnimations` complements (not replaces) `prefers-reduced-motion`
