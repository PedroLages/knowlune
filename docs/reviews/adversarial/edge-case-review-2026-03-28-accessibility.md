# Edge Case Review: Accessibility Phase 1 (E51)

**Date:** 2026-03-28
**Epic:** E51 — Display & Accessibility Settings
**Stories:** E51-S01 through E51-S04
**Reviewer:** Edge Case Hunter (automated)

---

## Summary

23 unhandled edge cases identified across 9 focus areas. 6 rated HIGH severity, 11 MEDIUM, 6 LOW. The most critical gaps are: (1) 17 local `MotionConfig reducedMotion="user"` overrides that will shadow the root-level MotionConfig, (2) 12+ components that check `prefers-reduced-motion` via `matchMedia` but ignore the app-level setting, and (3) no handling for corrupted/invalid localStorage values in the new accessibility fields.

---

## Findings

### 1. Reduced Motion: Local MotionConfig Overrides Shadow Root

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Likelihood** | Certain |
| **Impact** | User sets "Reduce motion" in app, but animations still play on 17 pages/components |
| **Location** | CourseOverview.tsx:142, Flashcards.tsx:303/446, CareerPathDetail.tsx:333, QualityScoreDialog.tsx:41, ReviewQueue.tsx:136, Reports.tsx:238, AILearningPath.tsx:185, LearningPaths.tsx:636, RetentionDashboard.tsx:48, QuizAnalyticsTab.tsx:168, Overview.tsx:424, CareerPaths.tsx:271, LearningPathDetail.tsx:724, InterleavedCard.tsx:79, FlashcardReviewCard.tsx:39, InterleavedSummary.tsx:25 |

**Scenario:** E51-S02 adds a root-level `<MotionConfig reducedMotion={shouldReduceMotion ? 'always' : 'never'}>` in App.tsx. However, 17 components already have local `<MotionConfig reducedMotion="user">` that wraps their content. Framer Motion's MotionConfig uses React context — the nearest ancestor wins. These local overrides will shadow the root setting, meaning "Reduce motion" in Settings has no effect on these components.

**Mitigation:** E51-S02 must include a task to remove (or conditionally override) all 17 local `MotionConfig` instances. Either: (a) remove all local `MotionConfig reducedMotion="user"` and rely on the root, or (b) have local instances read from the `useReducedMotion` hook. The spec mentions this risk in "High-Risk Items" but does not include it as a task or AC.

**Suggested guard:** Add a task to E51-S02: "Audit and remove local MotionConfig overrides in 17 components (see list). Add E2E test verifying animation suppression on Flashcards page."

---

### 2. Reduced Motion: Confetti/Canvas Animations Ignore App Setting

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Likelihood** | Certain |
| **Impact** | Confetti fires even when user has "Reduce motion" enabled in app (but OS setting is OFF) |
| **Location** | StreakMilestoneToast.tsx:22, CompletionModal.tsx:36, ChallengeMilestoneToast.tsx:26, AchievementBanner.tsx:52, OnboardingOverlay.tsx:14 |

**Scenario:** These components check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` directly. When a user selects "Reduce motion" in the app (not OS-level), the `.reduce-motion` CSS class is added to `<html>` and MotionConfig is set to `always` — but neither of these affect the `matchMedia` query. The `canvas-confetti` library and these components will still fire animations because the OS media query is still `false`.

**Mitigation:** These components need to also check the app-level setting. Options: (a) create a shared `shouldReduceMotion()` utility that checks both OS preference AND app setting from localStorage, or (b) have these components import the setting from a shared store/hook. The `.reduce-motion` CSS class on `<html>` could also be checked: `document.documentElement.classList.contains('reduce-motion')`.

**Suggested guard:** `const appReduceMotion = document.documentElement.classList.contains('reduce-motion'); if (prefersReducedMotion || appReduceMotion) return;`

---

### 3. Reduced Motion: Scroll Behavior and Non-Framer Animations Ignore App Setting

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Likely |
| **Impact** | Smooth scrolling and CSS-based animations continue when user selects "Reduce motion" in app |
| **Location** | src/lib/scroll.ts:7, src/app/components/notes/search-replace/SearchReplaceExtension.ts:21, src/hooks/useCourseCardPreview.ts:11, src/app/components/AnimatedCounter.tsx:35 |

**Scenario:** These files check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` to decide scroll behavior or animation approach. They will not respond to the app-level "Reduce motion" toggle because it only adds a CSS class and sets MotionConfig — it does not change the OS media query result.

**Mitigation:** Same as finding #2 — check `document.documentElement.classList.contains('reduce-motion')` as a fallback. For the CSS-class-based suppression (`.reduce-motion * { transition-duration: 0.01ms }`), CSS transitions are covered, but JavaScript-driven scroll behavior and counter animations are not.

---

### 4. Reduced Motion: QualityScoreRing Shows Empty Ring When Motion Suppressed

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Likely |
| **Impact** | Score ring appears empty (no filled arc) — functional information lost, not just visual |
| **Location** | src/app/components/session/QualityScoreRing.tsx:53-65 |

**Scenario:** QualityScoreRing uses `motion.circle` with `initial={{ strokeDashoffset: circumference }}` and `animate={{ strokeDashoffset: circumference - progress }}`. When MotionConfig is set to `always` (reduce motion), Framer Motion skips the animation and may render at the `initial` state (fully empty ring) rather than jumping to the `animate` state. The numeric score text also uses `initial={{ opacity: 0, scale: 0.8 }}` — it may render invisible.

**Mitigation:** When reduced motion is active, render the SVG circle with the final `strokeDashoffset` value directly (no motion component), or use `animate` values as the `initial` values so the component starts at the final state.

**Suggested guard:** `const shouldAnimate = !shouldReduceMotion; return shouldAnimate ? <motion.circle initial={...} animate={...} /> : <circle strokeDashoffset={circumference - progress} />`

---

### 5. Font Loading: FOUT on Page Reload with Font Enabled

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Certain |
| **Impact** | Text renders in DM Sans, then snaps to Atkinson Hyperlegible ~100-500ms later |
| **Location** | E51-S03 useAccessibilityFont hook (planned) |

**Scenario:** On page reload with `accessibilityFont: true`, the hook runs in a `useEffect` (post-render). The sequence is: (1) HTML renders with `--font-body: DM Sans` from theme.css, (2) React hydrates, (3) useEffect fires, (4) dynamic import loads font CSS (~40KB), (5) CSS variable updated. Steps 1-4 cause a visible flash of DM Sans text. The spec acknowledges this ("acceptable brief swap") but provides no mitigation.

**Mitigation:** Add a blocking script in `index.html` `<head>` that reads localStorage and sets `--font-body` to the Atkinson fallback stack immediately (before React renders). The font files won't be loaded yet, but the browser will try to use the fallback chain. Alternatively, cache the font CSS in a service worker for instant second-load. For Phase 1, document this as a known limitation.

**Suggested guard:** `<script>try{const s=JSON.parse(localStorage.getItem('app-settings'));if(s&&s.accessibilityFont)document.documentElement.style.setProperty('--font-body',"'Atkinson Hyperlegible',system-ui,sans-serif")}catch(e){}</script>` in index.html head.

---

### 6. Font Loading: Dynamic Import Fails Silently on Subsequent Toggles

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Likelihood** | Unlikely |
| **Impact** | CSS variable set to Atkinson but font not actually loaded — text renders in system-ui fallback |
| **Location** | E51-S03 accessibilityFont.ts (planned), loadAccessibilityFont() |

**Scenario:** After first successful load, if the user toggles OFF then ON again, the dynamic import resolves from module cache (no network request). But if the initial load partially succeeded (CSS imported but font files failed to download), the `@font-face` rule exists but the actual `.woff2` file is missing. `document.documentElement.style.setProperty('--font-body', "'Atkinson Hyperlegible', ...")` would set the variable, but the browser falls through to `system-ui`. No error is thrown because the `import()` succeeded (it was the font file fetch that failed).

**Mitigation:** After setting the CSS variable, use `document.fonts.check('16px "Atkinson Hyperlegible"')` or `document.fonts.load('16px "Atkinson Hyperlegible"')` to verify the font is actually available. If not, revert and show error toast.

---

### 7. Font Loading: No Loading State During First Enable

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Likelihood** | Certain |
| **Impact** | Switch toggles ON, 100-500ms gap before font appears — no visual feedback during load |
| **Location** | E51-S03 DisplayAccessibilitySection font toggle (planned) |

**Scenario:** User enables font toggle. Dynamic import takes 100-500ms (first time, depending on network). During this time, the switch shows ON but text hasn't changed. No loading spinner or "Loading font..." indicator. User may think it's broken and toggle again.

**Mitigation:** Add a brief loading state to the Switch (e.g., disabled with spinner) while `loadAccessibilityFont()` is in-flight. The `useAccessibilityFont` hook could expose an `isLoading` state.

---

### 8. Preference Persistence: Corrupted/Invalid localStorage Values

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Likelihood** | Possible |
| **Impact** | App crashes or silently behaves incorrectly with invalid setting values |
| **Location** | src/lib/settings.ts:49-56, getSettings() |

**Scenario:** `getSettings()` does `{ ...defaults, ...JSON.parse(raw) }`. If localStorage contains `{"reduceMotion":"invalid"}` or `{"contentDensity":42}` or `{"accessibilityFont":"yes"}`, these invalid values overwrite defaults and propagate throughout the app. The `useReducedMotion` hook would receive `preference: "invalid"` — none of the `if ('system')` / `if ('on')` / `if ('off')` branches match, leaving `shouldReduceMotion` undefined or its initial state.

**Mitigation:** Add validation in `getSettings()` for the new fields:
```typescript
const validated = { ...defaults, ...JSON.parse(raw) }
if (!['system', 'on', 'off'].includes(validated.reduceMotion)) validated.reduceMotion = 'system'
if (!['default', 'spacious'].includes(validated.contentDensity)) validated.contentDensity = 'default'
if (typeof validated.accessibilityFont !== 'boolean') validated.accessibilityFont = false
```

---

### 9. Preference Persistence: Reset Doesn't Unload Font or Remove CSS Classes

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Likelihood** | Likely |
| **Impact** | After reset, Atkinson font still active, .spacious/.reduce-motion classes still on html |
| **Location** | E51-S01 DisplayAccessibilitySection reset handler (planned) |

**Scenario:** The reset handler sets `accessibilityFont: false, contentDensity: 'default', reduceMotion: 'system'` via `onSettingsChange()` which calls `saveSettings()` + dispatches `settingsUpdated`. This should trigger the hooks to react. However, the timing matters: if hooks have stale closures or if the event dispatch happens before the hooks re-read settings, the CSS variable (`--font-body`), CSS classes (`.spacious`, `.reduce-motion`), and MotionConfig may not revert.

**Mitigation:** Ensure reset calls `saveSettings()` with all three fields in a single call, then dispatches one `settingsUpdated` event. The hooks must handle this correctly. Add an E2E test: "Reset → verify .spacious removed AND .reduce-motion removed AND --font-body reverted to DM Sans."

---

### 10. Preference Persistence: Storage Event from Another Tab

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Possible |
| **Impact** | A11y settings changed in one tab not reflected in another until reload |
| **Location** | E51-S02/S03/S04 hooks (planned) |

**Scenario:** `useFontScale` already listens for `storage` events (cross-tab sync). The spec for `useReducedMotion` mentions listening for `storage` events. But the specs for `useAccessibilityFont` and `useContentDensity` only mention `settingsUpdated` events — not `storage` events. If user changes settings in Tab A, Tab B won't update density or font until refresh.

**Mitigation:** All three new hooks must listen for both `settingsUpdated` (same tab) and `storage` (cross-tab) events, following the `useFontScale` pattern exactly.

---

### 11. OS Preference Detection: System Preference Changes Mid-Session

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Possible |
| **Impact** | User switches OS reduced-motion while app is open; "Follow system" doesn't react |
| **Location** | E51-S02 useReducedMotion hook, Task 1.4 |

**Scenario:** The spec says the hook should "listen for changes" on the `matchMedia` query when set to `'system'`. This requires `mediaQuery.addEventListener('change', handler)`. If only checked once on mount, changing the OS setting while the app is open won't take effect. The spec covers this in Task 1.4 but there's no AC that tests this specifically.

**Mitigation:** Add an AC or test case: "Given 'Follow system' is selected, when the OS reduced-motion preference changes mid-session, then the app responds within 1 second without page reload." Ensure the `matchMedia` listener is added/removed correctly when switching between 'system' and 'on'/'off'.

---

### 12. OS Preference Detection: prefers-contrast Not Addressed

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Likelihood** | Possible |
| **Impact** | Users with high-contrast OS settings get no benefit from a11y features |
| **Location** | Epic scope |

**Scenario:** The epic only addresses `prefers-reduced-motion`. Users with `prefers-contrast: more` set at the OS level get no enhanced experience. This is explicitly out of scope ("High contrast mode / WCAG AAA" listed under Out of Scope), but worth noting for Phase 2 that `prefers-contrast` detection infrastructure could be added alongside the existing `matchMedia` pattern.

**Mitigation:** Document in Phase 2 backlog. No action needed for E51.

---

### 13. Multi-User: All Preferences Tied to Single localStorage Key

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Possible |
| **Impact** | Two users on shared device get each other's a11y preferences |
| **Location** | src/lib/settings.ts:3 (`const STORAGE_KEY = 'app-settings'`) |

**Scenario:** All settings are stored under a single `app-settings` key in localStorage. If User A (needs reduced motion + large font) and User B (default preferences) share a device, User B gets User A's accessibility settings. There's no per-user scoping. The app has Supabase auth (E19), but settings aren't user-scoped in localStorage.

**Mitigation:** This is a pre-existing limitation (affects theme, font size, etc. too — not new to E51). For Phase 2 with Supabase sync, settings should be loaded per-user. For Phase 1, document that a11y preferences are device-scoped, not user-scoped. If auth is active, consider prefixing the storage key with user ID: `app-settings-${userId}`.

---

### 14. Theme Interaction: Spacious Mode Tokens Not Overridden in .dark or .vibrant

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Likelihood** | Unlikely |
| **Impact** | Minimal — spacing tokens are theme-independent |
| **Location** | E51-S04 theme.css additions |

**Scenario:** The `.spacious` override block is added at the root level. If `.dark.spacious` or `.vibrant.spacious` needed different spacing values, there's no override. Currently spacing tokens are color-independent, so this is fine. But if future density tokens include color-dependent values (e.g., border widths that look different in dark mode), they'd need `.dark.spacious` overrides.

**Mitigation:** No action needed for Phase 1. The spacing tokens (`--content-padding`, `--content-gap`, `--content-line-height`, `--table-cell-padding`) are purely dimensional and don't interact with color themes.

---

### 15. Theme Interaction: Font Preview Panel Contrast in Dark/Vibrant Mode

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Possible |
| **Impact** | Preview panel text may have insufficient contrast in dark mode |
| **Location** | E51-S03 font preview panel (planned): `bg-surface-sunken/30 border-border/50` |

**Scenario:** The font preview panel uses `bg-surface-sunken/30` (30% opacity) and `border-border/50`. In dark mode, `--surface-sunken` and `--border` tokens have different values. If `surface-sunken` in dark mode is very dark and the text inherits default foreground color, contrast may be fine. But the `/30` opacity means the background is mostly transparent, inheriting the parent Card's background. This could reduce contrast if the Card background is similar to the text color in dark/vibrant modes.

**Mitigation:** Test the preview panel in all three themes (light/dark/vibrant) during implementation. Use `bg-surface-sunken` (full opacity) if contrast is insufficient at `/30`.

---

### 16. SSR/Hydration: Motion Preference Flash on Initial Load

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Likelihood** | Certain |
| **Impact** | Animations play for ~50-200ms before useEffect applies .reduce-motion class |
| **Location** | E51-S02 AC6, useReducedMotion hook (planned) |

**Scenario:** AC6 requires "saved motion preference applied before first paint (no flash of animations)." However, `useReducedMotion` runs in `useEffect` (post-render). On page load: (1) HTML renders, (2) CSS animations start, (3) React hydrates, (4) useEffect fires, (5) `.reduce-motion` class added. Between steps 2 and 5, animations are visible. This is the same FOUT problem as fonts, but worse because animation flashes are more noticeable to users with vestibular sensitivity.

**Mitigation:** Add a blocking `<script>` in `index.html` `<head>`:
```html
<script>
try {
  const s = JSON.parse(localStorage.getItem('app-settings'));
  if (s) {
    if (s.reduceMotion === 'on' || (s.reduceMotion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      document.documentElement.classList.add('reduce-motion');
    }
    if (s.contentDensity === 'spacious') {
      document.documentElement.classList.add('spacious');
    }
  }
} catch(e) {}
</script>
```
This applies CSS classes before any rendering occurs, preventing animation flash. The `useEffect` hooks then manage subsequent changes reactively.

---

### 17. Performance: Density Token Swap Causes Layout Thrashing

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Possible |
| **Impact** | Jank/stutter when toggling spacious mode on pages with many cards |
| **Location** | E51-S04, useContentDensity hook + 10-15 component updates |

**Scenario:** Toggling spacious mode adds/removes `.spacious` class on `<html>`, which changes 4 CSS custom properties. The browser must recalculate styles for every element that references these properties, then relayout. On the Overview page with 15+ cards, Courses with 20+ cards, and Reports with a large table, this could cause a visible frame drop.

**Mitigation:** CSS custom property changes on `:root` trigger a single style recalculation pass (not per-element), so this should be fast. However, if performance is an issue, wrap the class toggle in `requestAnimationFrame` to batch with the next frame. Monitor with Performance panel during implementation. The spec's approach (CSS variables, not inline styles) is already the most performant option.

---

### 18. Performance: Font Toggle Triggers Full Repaint

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Likelihood** | Certain (but low impact) |
| **Impact** | Brief layout shift when font metrics change (DM Sans vs Atkinson have different metrics) |
| **Location** | E51-S03, loadAccessibilityFont / unloadAccessibilityFont |

**Scenario:** Atkinson Hyperlegible has different character widths than DM Sans. When `--font-body` changes, all text reflows. On content-heavy pages, this causes a visible layout shift (text wrapping changes, card heights change, scroll position may jump).

**Mitigation:** Consider using `font-size-adjust` CSS property to normalize x-height between fonts, reducing layout shift. Alternatively, accept this as expected behavior for a font swap. The shift happens only on toggle, not continuously.

---

### 19. Content Density: Accordion/Collapsible Components May Clip Content

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Possible |
| **Impact** | Text or buttons cut off inside accordions/collapsibles in spacious mode |
| **Location** | Any component using fixed-height containers with `overflow-hidden` |

**Scenario:** Components with `max-h-*` or explicit `h-*` classes combined with `overflow-hidden` won't expand when spacious mode increases `--content-line-height` from 1.6 to 1.8 and `--content-padding` from 1rem to 1.25rem. Content that barely fits at default density may be clipped at spacious density.

**Mitigation:** Audit content-area components for fixed-height constraints. Replace `h-*` with `min-h-*` where possible. Ensure `overflow-hidden` containers use `overflow-auto` or have no height constraint. The E51-S04 spec calls for "visual QA across all pages" which should catch these, but specific test cases for accordion content in spacious mode would be more reliable.

---

### 20. Content Density: Sidebar Leak via Shared Components

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Possible |
| **Impact** | Sidebar spacing accidentally increases if shared components use density tokens |
| **Location** | E51-S04 Task 4 |

**Scenario:** The spec says to update content-area components but not sidebar/header. However, if a shared component (e.g., Card, Badge) is used in both the sidebar and content area, and that shared component is updated to use `p-[var(--content-padding)]`, the sidebar would also get spacious padding. The spec says "Only touch components rendered inside the `<Outlet />`" but some UI primitives are shared.

**Mitigation:** Do NOT update shared UI primitives (Card, Badge, etc.) to use density tokens. Only update page-level layout containers (grid gaps, page padding). For table cells, update only the Reports-specific table, not the generic Table component. E51-S04 AC3 tests for this, but the implementation guidance should be more explicit: "Never modify files in `src/app/components/ui/` for density tokens."

---

### 21. Content Density: Font Scale Interaction

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Possible |
| **Impact** | "Extra Large" font + spacious mode together may cause overflow or unusable layouts |
| **Location** | Interaction between useFontScale and useContentDensity |

**Scenario:** A user with `fontSize: 'extra-large'` (20px root) and `contentDensity: 'spacious'` gets both increased font size AND increased spacing. Since density tokens use `rem` units (which scale with root font size), spacious `--content-gap: 2rem` becomes `2 * 20 = 40px` instead of `2 * 16 = 32px`. Combined with larger text, content cards on the Overview page may require excessive scrolling, or card grids may collapse from 3 columns to 1.

**Mitigation:** Test the combination of extra-large font + spacious mode on all pages during implementation. Consider capping density token values in `rem` terms that are reasonable at all font scales, or use `px` units for density tokens (so they don't compound with font scale). The current approach of `rem` values is intentional (accessibility users may want both), but the interaction should be tested.

---

### 22. Reduced Motion: Overview.tsx Has Conditional MotionConfig That Conflicts

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Likelihood** | Certain |
| **Impact** | Overview page has its own animation toggle that will conflict with root MotionConfig |
| **Location** | src/app/pages/Overview.tsx:424 |

**Scenario:** Overview.tsx uses `<MotionConfig reducedMotion={showAnimations ? 'user' : 'always'}>` where `showAnimations` comes from the engagement preferences store. This creates a 3-way conflict: (1) root MotionConfig from E51-S02, (2) local MotionConfig in Overview.tsx, (3) engagement preferences `animations` toggle. The local MotionConfig will shadow the root, and the engagement preferences toggle operates independently from the new "Reduce motion" setting.

**Mitigation:** After E51-S02, remove the local MotionConfig from Overview.tsx. The root MotionConfig should be the single source of truth. The engagement preferences `animations` toggle (from a previous epic) needs to be reconciled with the new "Reduce motion" setting — either deprecate it in favor of the new 3-state control, or have the new control take precedence.

---

### 23. Reduced Motion: Engagement Preferences "Animations" Toggle Conflict

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Likelihood** | Certain |
| **Impact** | Two independent animation controls that don't know about each other |
| **Location** | src/app/components/settings/EngagementPreferences.tsx, src/stores/useEngagementPrefsStore, StreakMilestoneToast.tsx:17 |

**Scenario:** The app already has an "animations" toggle in Engagement Preferences (separate from Display & Accessibility). `StreakMilestoneToast` checks `const animationsEnabled = useEngagementPrefsStore(s => s.animations)` before firing confetti. The new "Reduce motion" setting in E51-S02 is a separate mechanism. A user could have "Allow all motion" in Display & Accessibility but "animations off" in Engagement Preferences (or vice versa). The two settings don't interact.

**Mitigation:** Either: (a) have the new "Reduce motion" setting override engagement preferences animations when set to "Reduce motion", or (b) document that Engagement Preferences controls celebrations/confetti while Display & Accessibility controls page transitions/Framer Motion. Option (a) is cleaner — add a note to E51-S02 that when `reduceMotion === 'on'`, confetti components should also be suppressed regardless of engagement preference.

---

## Edge Cases JSON (Raw Findings)

```json
[
  {
    "location": "CourseOverview.tsx:142, Flashcards.tsx:303/446, +14 more files",
    "trigger_condition": "17 local MotionConfig reducedMotion='user' overrides shadow root MotionConfig",
    "guard_snippet": "Remove all local <MotionConfig reducedMotion='user'> — let root MotionConfig in App.tsx govern all pages",
    "potential_consequence": "User selects 'Reduce motion' but animations still play on 17 pages"
  },
  {
    "location": "StreakMilestoneToast.tsx:22, CompletionModal.tsx:36, +3 files",
    "trigger_condition": "Confetti/canvas animations check OS matchMedia but ignore app setting",
    "guard_snippet": "const appReduce = document.documentElement.classList.contains('reduce-motion'); if (prefersReducedMotion || appReduce) return;",
    "potential_consequence": "Confetti fires with app 'Reduce motion' ON but OS preference OFF"
  },
  {
    "location": "src/lib/scroll.ts:7, AnimatedCounter.tsx:35, +2 files",
    "trigger_condition": "Scroll/counter animations check OS matchMedia, not app setting",
    "guard_snippet": "Add || document.documentElement.classList.contains('reduce-motion') to matchMedia checks",
    "potential_consequence": "Smooth scrolling and counter animations ignore app Reduce motion"
  },
  {
    "location": "QualityScoreRing.tsx:53-65",
    "trigger_condition": "motion.circle initial state is empty ring; reduced motion may freeze at initial",
    "guard_snippet": "When reducedMotion active, render static <circle strokeDashoffset={circumference - progress} /> instead of motion.circle",
    "potential_consequence": "Score ring appears empty — functional data lost, not just animation"
  },
  {
    "location": "E51-S03 useAccessibilityFont (planned)",
    "trigger_condition": "Font loaded in useEffect — DM Sans renders first on reload",
    "guard_snippet": "<script> in index.html head: read localStorage, set --font-body before React render",
    "potential_consequence": "100-500ms flash of DM Sans on every reload with font enabled"
  },
  {
    "location": "E51-S03 accessibilityFont.ts loadAccessibilityFont()",
    "trigger_condition": "Dynamic import succeeds but .woff2 file fetch fails silently",
    "guard_snippet": "After import, verify: await document.fonts.load('16px Atkinson Hyperlegible'); if (!document.fonts.check(...)) throw",
    "potential_consequence": "CSS var set to Atkinson but browser renders system-ui fallback"
  },
  {
    "location": "E51-S03 font toggle UI (planned)",
    "trigger_condition": "No loading state during first font enable (100-500ms gap)",
    "guard_snippet": "Add isLoading state to useAccessibilityFont; disable Switch while loading",
    "potential_consequence": "Switch shows ON but text unchanged — user may re-toggle"
  },
  {
    "location": "src/lib/settings.ts:49-56 getSettings()",
    "trigger_condition": "Corrupted localStorage with invalid reduceMotion/contentDensity values",
    "guard_snippet": "After parse: if (!['system','on','off'].includes(v.reduceMotion)) v.reduceMotion = defaults.reduceMotion",
    "potential_consequence": "Hooks receive invalid values — undefined behavior in switch/if branches"
  },
  {
    "location": "E51-S01 reset handler (planned)",
    "trigger_condition": "Reset sets localStorage but CSS classes/variables may lag",
    "guard_snippet": "E2E test: reset → verify .spacious removed AND .reduce-motion removed AND --font-body = DM Sans",
    "potential_consequence": "After reset, old a11y preferences still visually active"
  },
  {
    "location": "E51-S03/S04 hooks (planned)",
    "trigger_condition": "Hooks don't listen for 'storage' event — cross-tab sync fails",
    "guard_snippet": "window.addEventListener('storage', handler) in useAccessibilityFont and useContentDensity",
    "potential_consequence": "A11y settings changed in Tab A not reflected in Tab B"
  },
  {
    "location": "E51-S02 useReducedMotion hook (planned)",
    "trigger_condition": "OS preference changes mid-session while 'Follow system' selected",
    "guard_snippet": "mediaQuery.addEventListener('change', handler) — add AC: OS pref change mid-session triggers update",
    "potential_consequence": "App doesn't respond to OS accessibility change until reload"
  },
  {
    "location": "src/lib/settings.ts:3 STORAGE_KEY",
    "trigger_condition": "Two users on shared device get each other's a11y preferences",
    "guard_snippet": "Document as known limitation; future: scope STORAGE_KEY by userId when auth active",
    "potential_consequence": "User with vestibular sensitivity gets other user's 'Allow all motion'"
  },
  {
    "location": "E51-S03 font preview panel: bg-surface-sunken/30",
    "trigger_condition": "30% opacity background may have insufficient contrast in dark mode",
    "guard_snippet": "Test in dark+vibrant modes; fallback to bg-surface-sunken (full opacity) if contrast < 4.5:1",
    "potential_consequence": "Font preview text unreadable in dark or vibrant theme"
  },
  {
    "location": "E51-S02 AC6: motion preference before first paint",
    "trigger_condition": "useEffect runs post-render — animations flash for ~50-200ms",
    "guard_snippet": "<script> in index.html: read localStorage, add .reduce-motion + .spacious classes before React",
    "potential_consequence": "Vestibular-sensitive users see animation burst on every page load"
  },
  {
    "location": "E51-S04 10-15 component updates",
    "trigger_condition": "Toggling spacious class triggers relayout on all density-token elements",
    "guard_snippet": "Wrap class toggle in requestAnimationFrame; test on Overview (15+ cards) for jank",
    "potential_consequence": "Visible frame drop when toggling spacious on content-heavy pages"
  },
  {
    "location": "E51-S03 font swap (DM Sans ↔ Atkinson)",
    "trigger_condition": "Different character widths cause text reflow and layout shift",
    "guard_snippet": "Consider font-size-adjust CSS to normalize x-height; accept as expected behavior",
    "potential_consequence": "Visible layout jump when toggling font — scroll position shifts"
  },
  {
    "location": "Components with fixed h-*/max-h-* + overflow-hidden in content area",
    "trigger_condition": "Spacious line-height 1.8 causes content to exceed fixed container height",
    "guard_snippet": "Audit fixed-height containers; replace h-* with min-h-* where content is text-based",
    "potential_consequence": "Text or buttons clipped inside accordions/collapsibles in spacious mode"
  },
  {
    "location": "E51-S04 Task 4: updating shared components",
    "trigger_condition": "Shared Card/Badge components used in sidebar would also get spacious padding",
    "guard_snippet": "Never modify src/app/components/ui/ for density tokens — only page-level containers",
    "potential_consequence": "Sidebar spacing accidentally increases, violating AC3"
  },
  {
    "location": "Interaction: useFontScale(extra-large) + useContentDensity(spacious)",
    "trigger_condition": "20px root + 2rem gap = 40px gap; cards may collapse to single column",
    "guard_snippet": "Test extra-large + spacious combo on all pages; consider px units for density tokens",
    "potential_consequence": "Overview grid collapses; excessive scrolling with both settings maxed"
  },
  {
    "location": "Overview.tsx:424",
    "trigger_condition": "Local MotionConfig reads showAnimations from engagement prefs, shadows root",
    "guard_snippet": "Remove local MotionConfig from Overview.tsx; let root MotionConfig govern",
    "potential_consequence": "Overview ignores Display & Accessibility 'Reduce motion' setting"
  },
  {
    "location": "EngagementPreferences animations toggle + E51-S02 reduceMotion",
    "trigger_condition": "Two independent animation controls that don't coordinate",
    "guard_snippet": "When reduceMotion==='on', override engagementPrefs.animations to false; or unify controls",
    "potential_consequence": "Confetti fires despite 'Reduce motion' if engagement prefs allows it"
  },
  {
    "location": "E51-S03 AC3: font reload behavior",
    "trigger_condition": "Browser font cache cleared — Atkinson re-download on every reload",
    "guard_snippet": "Service worker precache @fontsource assets; or accept as acceptable performance cost",
    "potential_consequence": "40KB font download on every reload if not cached"
  },
  {
    "location": "E51-S02 Task 3.5: MotionConfig placement",
    "trigger_condition": "MotionConfig wraps RouterProvider but Toaster/WelcomeWizard are siblings outside it",
    "guard_snippet": "Ensure MotionConfig wraps ALL motion components including Toaster and WelcomeWizard",
    "potential_consequence": "Toast animations and wizard animations ignore reduce motion setting"
  }
]
```

---

## Recommendations by Priority

### Must Fix Before Implementation (HIGH)

1. **Add task to E51-S02:** Remove all 17 local `MotionConfig reducedMotion="user"` overrides (Finding #1)
2. **Add task to E51-S02:** Update confetti/canvas components to check `.reduce-motion` class, not just OS matchMedia (Finding #2)
3. **Add blocking script to index.html:** Apply `.reduce-motion` and `.spacious` classes before React renders (Finding #16)
4. **Add validation to getSettings():** Guard against corrupted localStorage values for new fields (Finding #8)
5. **Reconcile engagement preferences:** Decide relationship between existing "animations" toggle and new "Reduce motion" (Finding #22, #23)
6. **Scope MotionConfig correctly:** Ensure it wraps Toaster and WelcomeWizard, not just RouterProvider (Finding #23 JSON)

### Should Fix During Implementation (MEDIUM)

7. Add `storage` event listener to useAccessibilityFont and useContentDensity hooks (Finding #10)
8. Add E2E test for reset verifying all visual artifacts removed (Finding #9)
9. Test font preview panel contrast in dark/vibrant modes (Finding #15)
10. Audit fixed-height containers before applying density tokens (Finding #19)
11. Never modify shared UI primitives for density tokens (Finding #20)
12. Test extra-large font + spacious mode combination (Finding #21)
13. Update scroll.ts and AnimatedCounter to check `.reduce-motion` class (Finding #3)
14. Add static fallback rendering for QualityScoreRing under reduced motion (Finding #4)
15. Add AC for OS preference change mid-session (Finding #11)

### Nice to Have / Phase 2 (LOW)

16. Add loading state to font toggle Switch (Finding #7)
17. Verify font actually rendered via `document.fonts.check()` (Finding #6)
18. Consider `font-size-adjust` for layout shift mitigation (Finding #18)
19. Document multi-user limitation (Finding #13)
20. Add `prefers-contrast` detection to Phase 2 backlog (Finding #12)
