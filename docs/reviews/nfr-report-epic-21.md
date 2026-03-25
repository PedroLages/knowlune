# Non-Functional Requirements Report: Epic 21 — Engagement & Adaptive Experience

**Date:** 2026-03-24
**Stories Assessed:** E21-S03 through E21-S07
**Overall Assessment:** PASS

---

## Scope

| Story   | Feature                                   | Key Files                                                     |
|---------|-------------------------------------------|---------------------------------------------------------------|
| E21-S03 | Pomodoro Focus Timer                      | `usePomodoroTimer.ts`, `PomodoroTimer.tsx`, `pomodoroAudio.ts`, `pomodoroPreferences.ts` |
| E21-S04 | Visual Energy Boost (Vibrant Color Scheme)| `theme.css` (.vibrant/.dark.vibrant), `useColorScheme.ts`     |
| E21-S05 | Engagement Preference Controls            | `useEngagementPrefsStore.ts`, `EngagementPreferences.tsx`     |
| E21-S06 | Smart Dashboard Reordering                | `dashboardOrder.ts`, `useDashboardOrder.ts`, `DashboardCustomizer.tsx` |
| E21-S07 | Age-Appropriate Defaults & Font Scaling   | `useFontScale.ts`, `WelcomeWizard.tsx`, `FontSizePicker.tsx`, `settings.ts` |

---

## 1. Performance

### Build Time
- **Production build:** 13.16s — no regressions from Epic 21 features
- Zero build errors; TypeScript compiles cleanly (`tsc --noEmit` passes)

### Bundle Size Impact
- **Settings chunk:** 181 kB (54 kB gzipped) — includes EngagementPreferences, FontSizePicker, WelcomeWizard
- **Index chunk:** 287 kB (87 kB gzipped) — includes DashboardCustomizer, PomodoroTimer
- **@dnd-kit/core (v6.3.1):** Added for E21-S06 drag-and-drop; tree-shakes to only used modules
- **Total PWA precache:** 15,330 kB across 245 entries — no anomalous growth
- **Verdict:** PASS. No bundle size concerns. DnD-kit is the only new dependency and is well-contained.

### Timer Precision (E21-S03)
- Wall-clock anchoring via `Date.now()` with `endTimeRef` pattern — drift-free countdown
- `visibilitychange` listener recalculates on tab return — correct behavior when tab is backgrounded
- `setInterval(recalculate, 1000)` with `Math.floor` rounding — consistent 1-second display granularity
- **Verdict:** PASS. Same proven pattern as `useQuizTimer`.

### Rendering (E21-S06)
- `IntersectionObserver` with 0.3 threshold for section tracking — passive, no layout thrashing
- `useCallback` and `useMemo` applied to all handler functions and derived state (pinnedSectionsSet)
- `computeRelevanceScore` uses `Math.exp` and `Math.log2` — O(1) per section, negligible for 9 sections
- **Verdict:** PASS. All computations are appropriately lightweight.

### CSS Performance (E21-S04)
- Vibrant theme uses CSS class toggle (`.vibrant`) rather than runtime style injection
- OKLCH values resolved by browser natively — no JavaScript color conversion at runtime
- No reflow or repaint cascade; only CSS custom property values change
- **Verdict:** PASS. Minimal performance cost for theme switching.

---

## 2. Security

### localStorage Data (All Stories)
- **No sensitive PII stored:** Age range is a generation label (e.g., "boomer"), not a birthdate
- Keys used: `pomodoro-preferences`, `levelup-engagement-prefs-v1`, `dashboard-section-order`, `dashboard-section-stats`, `knowlune-welcome-wizard-v1`, `app-settings`
- All values are JSON with explicit field validation on read (type guards, fallback to defaults)
- **No server-side age data:** WelcomeWizard explicitly documents "Your answer stays on your device and is never sent to any server" (line 136)

### XSS Prevention
- No `dangerouslySetInnerHTML` or `innerHTML` in any Epic 21 component
- All user-facing text rendered through React JSX (auto-escaped)
- CSS custom properties set only via class toggle (`.vibrant`), not user input

### Input Validation
- `useEngagementPrefsStore`: Validates each field type (`typeof parsed.achievements === 'boolean'`)
- `useColorScheme`: Falls back to `'professional'` for any non-vibrant value (`?? 'professional'`)
- `pomodoroPreferences`: Spreads `defaults` first, then overrides — corrupted fields get safe values
- `dashboardOrder.getOrderConfig`: Adds missing sections, removes stale sections — forward-compatible
- `settings.ts`: `saveSettings` does **not** wrap `localStorage.setItem` in try/catch (see Concern C1 below)

### Verdict: PASS with advisory note (C1).

---

## 3. Reliability

### Error Handling & Graceful Degradation

| Component                  | localStorage full | Corrupted JSON | Missing keys      |
|----------------------------|-------------------|----------------|-------------------|
| `pomodoroPreferences`      | Silent fallback   | Returns defaults | Returns defaults  |
| `useEngagementPrefsStore`  | Silent fallback   | Returns defaults | Per-field defaults |
| `dashboardOrder`           | Silent fallback   | Returns defaults | Auto-fills missing |
| `useWelcomeWizardStore`    | Silent fallback   | Returns `null`   | Shows wizard      |
| `pomodoroAudio` (playChime)| N/A               | N/A            | Silent catch      |
| `settings.saveSettings`    | **THROWS** (C1)   | N/A            | N/A               |

#### Concern C1: `saveSettings` lacks try/catch

`src/lib/settings.ts:59` calls `localStorage.setItem()` without a try/catch. If localStorage is full, this will throw and could crash the calling component (Settings page, WelcomeWizard). Every other localStorage write in Epic 21 code handles this gracefully.

**Severity:** MEDIUM (advisory). In practice, settings data is small (~200 bytes) and unlikely to exceed quota, but it breaks the consistency pattern established by all other stores.

#### Audio Notification (E21-S03)
- `playChime` wraps all Web Audio API calls in try/catch — audio failure never blocks timer flow
- Volume clamped to [0, 1] via `Math.min(1, Math.max(0, volume))`
- `AudioContext.close()` failure caught separately
- **Verdict:** PASS. Robust error isolation.

#### Dashboard Auto-Reorder (E21-S06)
- Auto-reorder only fires when `hasInteractions` is true (at least one section has views > 0)
- When all scores are 0, preserves default order — prevents confusing reorder on first visit
- `getOrderConfig` handles schema evolution (adds missing sections, removes stale ones)
- **Verdict:** PASS.

---

## 4. Maintainability

### Code Quality
- **TypeScript:** Full type coverage. No `any` types in Epic 21 code. All hooks have explicit return types.
- **ESLint:** Zero errors or warnings in Epic 21 source files (1 error in unrelated file)
- **Design tokens:** All colors use theme tokens — no hardcoded values detected in Epic 21 components
- **Separation of concerns:** Clean hook/component/lib boundary across all 5 stories

### Test Coverage

| Story   | Unit Tests | E2E Tests | Total Lines | Coverage Quality |
|---------|-----------|-----------|-------------|------------------|
| E21-S03 | 241 lines (usePomodoroTimer.test.ts) | 215 lines (8 tests) | 456 | Excellent — covers timer lifecycle, phase transitions, pause/resume, accessibility |
| E21-S04 | 95 lines (useColorScheme.test.ts) | 372 lines (9 tests) | 467 | Excellent — includes WCAG contrast ratio validation with canvas pixel readback |
| E21-S05 | 0 (store logic inline) | 343 lines (10 tests) | 343 | Good — covers all ACs including toggle visibility, persistence, defaults |
| E21-S06 | 0 (pure functions in lib) | 328 lines (10 tests) | 328 | Good — covers pin/unpin, reset, auto-reorder, manual order, persistence, keyboard |
| E21-S07 | 207 lines (settings.test.ts) | 211 lines (5 tests) | 418 | Excellent — covers wizard flow, font persistence, proportional scaling hierarchy |

**Gap identified:** `dashboardOrder.ts` pure functions (computeRelevanceScore, computeAutoOrder) lack unit tests. Currently only covered by E2E integration tests. This is acceptable but unit tests would improve confidence in scoring edge cases.

**Verdict:** PASS. 2,012 total test lines across 8 test files, with comprehensive E2E coverage for all 5 stories.

---

## 5. Accessibility

### Font Scaling (E21-S07)
- Root font-size driven by `--font-size` CSS custom property on `<html>` — all `rem` values scale proportionally
- Range: 14px (small) to 20px (extra-large) — 4 discrete steps
- E2E test confirms heading hierarchy maintained at all sizes (`h1 > body` font size)
- Font size picker uses `role="radiogroup"` with `aria-checked` for keyboard navigation
- Live preview with `aria-live="polite"` for screen reader feedback
- **Verdict:** PASS.

### WCAG Contrast (E21-S04)
- Vibrant tokens use OKLCH with increased chroma only — lightness and hue stable
- WCAG AA 4.5:1 compliance verified by E2E tests using canvas pixel readback for:
  - Brand foreground on brand background (light vibrant)
  - Brand-soft-foreground on brand-soft background (light vibrant)
  - Brand foreground on brand background (dark vibrant)
- CSS comments document the WCAG compliance rationale inline
- **Verdict:** PASS. Automated contrast validation in test suite.

### Keyboard Navigation
- **PomodoroTimer:** All controls are `<Button>` elements with `aria-label`; countdown has `role="timer"`; phase indicator has `aria-live="polite"`; preferences toggle has `aria-expanded` and `aria-controls`
- **DashboardCustomizer:** Toggle has `aria-expanded`/`aria-controls`; panel has `role="region"` with `aria-label`; section list uses `role="list"`/`role="listitem"`; DnD uses `KeyboardSensor` with `sortableKeyboardCoordinates`; drag handles have descriptive `aria-label`; pin/unpin buttons have contextual labels
- **EngagementPreferences:** Feature toggles grouped with `role="group"` and `aria-label`; all switches have `aria-label`; radio group for color scheme uses proper `RadioGroup`/`RadioGroupItem`
- **WelcomeWizard:** Age selection uses `role="radiogroup"` with `aria-checked`; touch targets meet 44x44px minimum (`min-h-[44px]`)
- **FontSizePicker:** `role="radiogroup"` with `aria-checked`; preview has `aria-live="polite"`

### Focus Indicators
- Global `*:focus-visible` rule with `outline: 2px solid var(--brand)` and `outline-offset: 2px` — 3:1 contrast ratio maintained across all themes including vibrant

**Verdict:** PASS. Comprehensive ARIA attributes across all components.

---

## Summary

| Category        | Verdict | Notes                                                          |
|-----------------|---------|----------------------------------------------------------------|
| Performance     | PASS    | No bundle regressions; drift-free timer; passive observers     |
| Security        | PASS    | No PII leaks; age range local-only; validated inputs           |
| Reliability     | PASS*   | *C1: `saveSettings` missing try/catch (MEDIUM advisory)        |
| Maintainability | PASS    | 2,012 test lines; clean types; design token compliance         |
| Accessibility   | PASS    | WCAG AA contrast verified; full keyboard nav; proper ARIA      |

**Overall: PASS**

### Advisory Items (non-blocking)

1. **C1 (Reliability/MEDIUM):** Add try/catch to `saveSettings` in `src/lib/settings.ts:59` to match the error handling pattern used by all other localStorage writers in the codebase.
2. **C2 (Maintainability/LOW):** Add unit tests for `dashboardOrder.ts` pure functions (`computeRelevanceScore`, `computeAutoOrder`, `pinSection`, `unpinSection`) to cover scoring edge cases without relying solely on E2E tests.
