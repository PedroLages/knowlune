# E21-S04: Visual Energy Boost — Implementation Plan

**Story:** As a Gen Z learner, I want vibrant, high-contrast colors in the UI, so that the platform feels modern and energizing.

**Created:** 2026-03-23
**Estimated effort:** 4 hours

---

## Architecture Overview

This story adds a "Vibrant" color scheme as an alternative to the default "Professional" palette. The approach uses **CSS custom property overrides** via a `.vibrant` class on the `<html>` element, which is the same pattern used by `next-themes` for dark mode (`.dark` class). This ensures:

- **Zero runtime cost** — CSS cascade handles all color switching
- **No component changes needed** — existing `bg-brand`, `text-success`, etc. automatically pick up vibrant values
- **Composable with dark mode** — `.dark.vibrant` provides vibrant dark mode colors
- **Forward-compatible** with E21-S05 (User Engagement Preference Controls) which will add the Settings UI toggle

### How It Works

```
<html class="">                → Professional Light (current default)
<html class="dark">            → Professional Dark (current)
<html class="vibrant">         → Vibrant Light (new)
<html class="dark vibrant">    → Vibrant Dark (new)
```

The `.vibrant` selector in `theme.css` overrides only the tokens that change. All other tokens cascade from `:root` / `.dark` as before.

---

## Step-by-Step Plan

### Step 1: Define Vibrant Color Tokens in theme.css

**File:** `src/styles/theme.css`

**What:** Add `.vibrant` and `.dark.vibrant` blocks after the existing `:root` and `.dark` blocks. Override only the tokens that need higher saturation.

**Vibrant Light Mode (`.vibrant`):**

| Token | Professional (current) | Vibrant (target) | Strategy |
|-------|----------------------|-------------------|----------|
| `--brand` | `#5e6ad2` | Increase OKLCH chroma ~15% | More saturated indigo |
| `--brand-hover` | `#4d57b5` | Proportional increase | Darker vibrant hover |
| `--brand-soft` | `#d0d2ee` | Slightly more saturated | Softer vibrant tint |
| `--brand-soft-foreground` | `#3d46b8` | Increase chroma | Readable on soft bg |
| `--success` | `#3a7553` | Increase chroma ~15% | More vivid green |
| `--warning` | `#866224` | Increase chroma ~15% | More vivid amber |
| `--gold` | `#c49245` | Increase chroma ~10% | Richer gold |
| `--momentum-hot` | `#b84a30` | Increase chroma ~15% | More vivid red-orange |
| `--momentum-warm` | `#c49245` | Increase chroma ~15% | More vivid amber |
| `--momentum-cold` | `#4d57b5` | Increase chroma ~15% | More vivid blue |
| `--chart-1..5` | Current OKLCH | Increase chroma ~10-15% | More colorful charts |

**Vibrant Dark Mode (`.dark.vibrant`):**

Same strategy applied to dark mode token values. Dark mode already uses slightly brighter colors, so the saturation bump will be smaller (~10%) to avoid neon/eye-strain.

**WCAG Validation Process:**
1. For each vibrant token, compute contrast ratio against its foreground/background pair
2. Minimum 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold)
3. Use OKLCH color space: increase chroma (C) while keeping lightness (L) stable
4. Tool: Chrome DevTools color picker or online OKLCH contrast checker

**Color Design Approach (OKLCH):**
```
Professional brand:  oklch(0.52 0.14 275)   → Vibrant: oklch(0.52 0.18 275)
                     L     C    H                      L     C+0.04 H
```
Increasing chroma while keeping lightness and hue constant preserves contrast ratios. This is the key insight — OKLCH is perceptually uniform, so chroma changes don't affect perceived lightness.

### Step 2: Color Scheme State Management

**File:** `src/lib/settings.ts`

**What:** Add `colorScheme` property to `AppSettings`.

```typescript
export interface AppSettings {
  displayName: string
  bio: string
  theme: 'light' | 'dark' | 'system'
  profilePhotoDataUrl?: string
  colorScheme: 'professional' | 'vibrant'  // NEW
}

const defaults: AppSettings = {
  displayName: 'Student',
  bio: '',
  theme: 'system',
  profilePhotoDataUrl: undefined,
  colorScheme: 'professional',  // NEW — default preserves current experience
}
```

**Why `localStorage` (via existing `settings.ts`) instead of Zustand:**
- Consistent with existing theme/profile storage pattern
- Read synchronously on app startup (no async/hydration delay)
- Already has `getSettings()` / `saveSettings()` API
- E21-S05 will add the Settings UI toggle that writes this value

### Step 3: Create useColorScheme Hook

**File:** `src/hooks/useColorScheme.ts` (new file)

**What:** Custom hook that:
1. Reads `colorScheme` from settings on mount
2. Applies/removes `.vibrant` class on `<html>`
3. Listens for `settingsUpdated` event (same pattern used by Layout.tsx for profile name updates)
4. Cleans up on unmount

```typescript
export function useColorScheme() {
  const [colorScheme, setColorScheme] = useState<'professional' | 'vibrant'>(() => {
    return getSettings().colorScheme ?? 'professional'
  })

  useEffect(() => {
    const root = document.documentElement
    if (colorScheme === 'vibrant') {
      root.classList.add('vibrant')
    } else {
      root.classList.remove('vibrant')
    }

    return () => {
      root.classList.remove('vibrant')
    }
  }, [colorScheme])

  // Listen for settings changes from other components (e.g., Settings page toggle)
  useEffect(() => {
    const handler = () => {
      setColorScheme(getSettings().colorScheme ?? 'professional')
    }
    window.addEventListener('settingsUpdated', handler)
    return () => window.removeEventListener('settingsUpdated', handler)
  }, [])

  return colorScheme
}
```

**Why a hook instead of direct App.tsx logic:**
- Encapsulates the DOM manipulation (classList) in a testable unit
- Reusable by E21-S05 Settings page toggle
- Clean separation of concerns

### Step 4: Wire Up in App.tsx

**File:** `src/app/App.tsx`

**What:** Call `useColorScheme()` at the app root level so the class is always applied.

```tsx
export default function App() {
  useColorScheme()  // Applies .vibrant class based on settings
  // ... existing code
}
```

This is a single-line addition. The hook handles all the logic.

### Step 5: MomentumBadge Verification

**File:** `src/app/components/figma/MomentumBadge.tsx`

**What:** Verify that `MomentumBadge` already uses design tokens (`text-momentum-hot`, `bg-momentum-hot-bg`, etc.) — it does. No component changes needed. The vibrant overrides in theme.css will automatically flow through.

**Action:** No code change. Verify in E2E test that colors actually change.

### Step 6: Unit Tests

**File:** `src/hooks/__tests__/useColorScheme.test.ts` (new file)

**Tests:**
1. **Default state:** Hook returns `'professional'`, no `.vibrant` class on `document.documentElement`
2. **Vibrant setting:** When settings have `colorScheme: 'vibrant'`, hook returns `'vibrant'` and `.vibrant` class is added
3. **Settings event:** When `settingsUpdated` event fires with new colorScheme, hook updates class
4. **Cleanup:** On unmount, `.vibrant` class is removed
5. **Missing setting:** When `colorScheme` is undefined (old settings format), defaults to `'professional'`

**File:** `src/lib/__tests__/settings.test.ts` (existing — add test)

**Tests:**
1. `colorScheme` defaults to `'professional'` when not set
2. `saveSettings({ colorScheme: 'vibrant' })` persists and reads back correctly

### Step 7: E2E Tests

**File:** `tests/e2e/regression/story-e21-s04.spec.ts` (new file)

**Tests:**
1. **Default professional mode:** Navigate to app → verify `<html>` does NOT have `.vibrant` class → verify `--brand` CSS property matches professional value
2. **Vibrant mode activation:** Set `colorScheme: 'vibrant'` in localStorage → reload → verify `<html>` has `.vibrant` class → verify `--brand` CSS property matches vibrant value
3. **Momentum badge colors:** In vibrant mode → navigate to page with momentum badges → verify badge has vibrant-colored background via `getComputedStyle`
4. **Dark + vibrant:** Set dark theme + vibrant → verify `.dark.vibrant` both present → verify dark vibrant token values
5. **Professional unchanged:** With default settings → verify all current color tokens are unchanged (regression guard)

**Test data seeding:** Use localStorage seeding (no IDB needed for this story).

---

## File Change Summary

| File | Action | Lines (est.) |
|------|--------|-------------|
| `src/styles/theme.css` | Edit — add `.vibrant` + `.dark.vibrant` blocks | ~60-80 |
| `src/lib/settings.ts` | Edit — add `colorScheme` to interface + defaults | ~5 |
| `src/hooks/useColorScheme.ts` | **New** — color scheme hook | ~35 |
| `src/app/App.tsx` | Edit — call `useColorScheme()` | ~2 |
| `src/hooks/__tests__/useColorScheme.test.ts` | **New** — unit tests | ~80 |
| `tests/e2e/regression/story-e21-s04.spec.ts` | **New** — E2E tests | ~100 |
| `src/app/pages/__tests__/Settings.test.tsx` | Edit — update mock to include colorScheme | ~2 |

**No changes to:** MomentumBadge.tsx, badge.tsx, any page components, or the `@theme inline` block (Tailwind picks up CSS custom properties automatically).

---

## Build Order

1. **Step 1** (theme.css) — Define the vibrant tokens. This is the core creative work and the largest risk area (contrast validation).
2. **Step 2** (settings.ts) — Add the settings property. Trivial change, but needed before the hook.
3. **Step 3** (useColorScheme.ts) — Create the hook. Depends on Step 2.
4. **Step 4** (App.tsx) — Wire up. Depends on Step 3.
5. **Step 5** (MomentumBadge verification) — Manual check, no code change.
6. **Step 6** (Unit tests) — Test Steps 2-3.
7. **Step 7** (E2E tests) — Integration validation of Steps 1-5.

---

## Key Design Decisions

### Decision 1: CSS Override Layer vs. CSS-in-JS Runtime

**Chosen:** CSS custom property overrides via `.vibrant` class
**Rejected:** Runtime theme switching with JavaScript/React context

**Why:** The existing theme system (next-themes + CSS custom properties) already uses class-based switching for dark mode. Adding another CSS class (`.vibrant`) follows the same zero-cost pattern. No runtime JS needed for color switching — just CSS cascade.

### Decision 2: Default Color Scheme

**Chosen:** `'professional'` (current colors unchanged)
**Why:** The epic planning doc specifies this is an opt-in feature. E21-S05 adds the toggle. Existing users see no change until they explicitly enable vibrant mode.

### Decision 3: OKLCH Color Space for Saturation Boost

**Chosen:** Modify chroma (C) in OKLCH while keeping lightness (L) and hue (H) constant
**Why:** OKLCH is perceptually uniform — increasing chroma doesn't shift perceived lightness, so contrast ratios are preserved. This is safer than modifying HSL saturation, which can unpredictably change perceived brightness.

### Decision 4: Scope Boundary with E21-S05

**E21-S04 provides:** Vibrant color tokens + state management + hook + application in App.tsx
**E21-S05 provides:** Settings page UI toggle for color scheme selection

For testing E21-S04 without the UI toggle, we seed `localStorage` directly. The hook + settings infrastructure is ready for E21-S05 to consume.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Vibrant colors fail WCAG AA contrast | Blocker — accessibility regression | Validate every token pair before committing. Use OKLCH chroma-only changes. |
| `.vibrant` class conflicts with `next-themes` `.dark` class | Visual bugs in dark+vibrant mode | Test `.dark.vibrant` combination explicitly. CSS specificity is equal (both single class). |
| ESLint `no-hardcoded-colors` flags vibrant hex values in theme.css | False positive build errors | theme.css is a CSS file, not TSX — ESLint rule only applies to JSX className attributes. No risk. |
| Settings migration — existing users without `colorScheme` key | Undefined reads | `getSettings()` already merges with defaults: `{ ...defaults, ...JSON.parse(raw) }`. Missing key gets default `'professional'`. |

---

## WCAG Compliance Checklist

Before any vibrant color is committed:

- [ ] `--brand` vibrant on `--brand-foreground` (#fff): ≥4.5:1
- [ ] `--brand-soft-foreground` vibrant on `--brand-soft` vibrant: ≥4.5:1
- [ ] `--success` vibrant on `--success-foreground` (#fff): ≥4.5:1
- [ ] `--warning` vibrant on `--warning-foreground`: ≥4.5:1
- [ ] `--momentum-hot` vibrant on `--momentum-hot-bg` vibrant: ≥4.5:1
- [ ] `--momentum-warm` vibrant on `--momentum-warm-bg` vibrant: ≥4.5:1
- [ ] `--momentum-cold` vibrant on `--momentum-cold-bg` vibrant: ≥4.5:1
- [ ] `--destructive` vibrant on `--destructive-foreground`: ≥4.5:1
- [ ] Same checks for `.dark.vibrant` variants

---

## Dependencies

- **Upstream:** None — all prerequisite epics (5, 8, 9B) are complete
- **Downstream:** E21-S05 (User Engagement Preference Controls) depends on this story for the vibrant tokens and `useColorScheme` hook
- **E21-S05 integration point:** Settings page will import `saveSettings({ colorScheme })` and dispatch `settingsUpdated` event. The hook created here handles the rest.
