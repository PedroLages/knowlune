# Plan: E21-S05 — User Engagement Preference Controls

## Context

Knowlune has gamification features (achievements, streaks, badges, celebrations with confetti) baked into the Overview and other pages. Currently users have no way to toggle these features off. This story adds an "Engagement Preferences" section to the Settings page with toggles for each gamification category plus a color scheme picker, all persisted to localStorage.

**Dependency note:** E21-S04 (Visual Energy Boost / Vibrant Color Scheme) is still in backlog. The color scheme picker will be implemented as a ready integration point — Professional (current palette) is the only active option. When E21-S04 ships, the Vibrant palette will slot in without further Settings changes.

**Branch:** `feature/e21-s05-user-engagement-preference-controls`

## Architecture Decisions

### Storage approach: Zustand + localStorage (not extending AppSettings)

The existing `AppSettings` in `src/lib/settings.ts` uses a manual `getSettings()`/`saveSettings()` pattern with no reactivity — components must poll or listen to `settingsUpdated` events. Engagement preferences need to be **reactive** (toggling a switch should instantly hide/show components) and **cross-component** (Overview, Layout, celebrations all need to read them).

**Decision:** Create a new Zustand store (`useEngagementPrefsStore`) with manual localStorage persistence, following the `useOnboardingStore` pattern. This gives us:
- Instant reactivity via Zustand selectors (no prop drilling or events)
- Clean separation from profile settings
- Same persistence pattern as existing stores

**Alternative rejected:** Extending `AppSettings` would require adding event dispatching for each preference change and refactoring all consumers to listen for `settingsUpdated`. Too much blast radius for a feature toggle.

### Gating strategy: Selector hook + conditional rendering

**Decision:** Create a `useEngagementVisible(feature: EngagementFeature)` convenience hook that returns a boolean. Components check this at render time:

```tsx
const showStreaks = useEngagementVisible('streaks')
// In JSX: {showStreaks && <StudyStreakCalendar />}
```

**Why not a wrapper component?** A `<GatedFeature feature="streaks">` wrapper adds an extra DOM node and obscures what's being gated. Direct boolean checks are simpler and match existing patterns in the codebase.

### Animation gating: MotionConfig reducedMotion

The Overview page already uses `<MotionConfig reducedMotion="user">`. When animations are toggled OFF, we'll set `reducedMotion="always"` on the MotionConfig wrapper, which tells framer-motion to skip all animations. This is the idiomatic framer-motion approach and respects the existing pattern.

For confetti (canvas-confetti, react-confetti-explosion), we'll check the animation preference before firing.

---

## Task 1: Create `useEngagementPrefsStore` Zustand store

**Files to create:**
- `src/stores/useEngagementPrefsStore.ts`
- `src/stores/__tests__/useEngagementPrefsStore.test.ts`

**Interface:**
```typescript
type ColorScheme = 'professional' | 'vibrant'

interface EngagementPrefs {
  achievements: boolean  // AchievementBanner, CompletionModal confetti
  streaks: boolean       // StudyStreakCalendar, streak stats, StreakMilestoneToast
  badges: boolean        // MomentumBadge, AtRiskBadge, milestone badges
  animations: boolean    // motion/react variants, confetti, animated counters
  colorScheme: ColorScheme
}
```

**Store shape:**
```typescript
interface EngagementPrefsStore extends EngagementPrefs {
  setPreference: (key: keyof EngagementPrefs, value: boolean | ColorScheme) => void
  resetToDefaults: () => void
}
```

**Defaults (AC5):** All toggles `true`, colorScheme `'professional'`

**Persistence:**
- localStorage key: `'levelup-engagement-prefs-v1'`
- Load on store creation (not lazy)
- Save on every `setPreference` call
- Graceful fallback on corrupt/missing data

**Pattern reference:** `src/stores/useOnboardingStore.ts` (manual localStorage load/persist)

**Unit tests:**
- Default values when no localStorage data
- Persistence round-trip (set → reload → verify)
- Corrupt localStorage graceful fallback
- `resetToDefaults` restores all defaults

**Commit:** `feat(E21-S05): add useEngagementPrefsStore with localStorage persistence`

---

## Task 2: Create `useEngagementVisible` convenience hook

**File to create:**
- `src/hooks/useEngagementVisible.ts`

**Implementation:**
```typescript
import { useEngagementPrefsStore } from '@/stores/useEngagementPrefsStore'

type EngagementFeature = 'achievements' | 'streaks' | 'badges' | 'animations'

export function useEngagementVisible(feature: EngagementFeature): boolean {
  return useEngagementPrefsStore(state => state[feature])
}
```

This is a thin selector wrapper that optimizes re-renders — components only re-render when their specific feature toggles.

**Commit:** (combined with Task 1)

---

## Task 3: Build `EngagementPreferences` settings component

**File to create:**
- `src/app/components/settings/EngagementPreferences.tsx`

**Design:**
Card layout following the existing Settings page pattern:
- `CardHeader` with icon (Sparkles from lucide-react) + title "Engagement Preferences" + description
- `CardContent` with:
  - **Toggle section:** 4 rows, each with Label + description + Switch toggle
    - "Achievements" — Show achievement banners and completion celebrations
    - "Streaks" — Show study streak calendar and streak statistics
    - "Badges" — Show momentum and milestone badges
    - "Animations" — Enable page transitions and celebratory effects
  - **Separator**
  - **Color scheme section:** RadioGroup with 2 options (following existing theme selector card pattern)
    - "Professional" — Current muted color palette (default)
    - "Vibrant" — High-contrast vibrant colors (disabled until E21-S04)

**UI components used:**
- `Card`, `CardHeader`, `CardContent` (existing)
- `Switch` (existing shadcn component)
- `Label` (existing)
- `RadioGroup`, `RadioGroupItem` (existing, same pattern as theme selector)
- `Separator` (existing)

**Integration into Settings page:**
- Import and add `<EngagementPreferences />` between the Appearance card and `<ReminderSettings />`
- Position rationale: Engagement preferences are a UI customization concern, logically grouped near Appearance

**Commit:** `feat(E21-S05): add EngagementPreferences settings section`

---

## Task 4: Gate engagement features across the app

### 4.1 Gate achievements (AC2)

**Files to modify:**
- `src/app/pages/Overview.tsx:238` — Wrap `<AchievementBanner>` with `showAchievements &&`
- `src/app/components/AchievementBanner.tsx` — Check `achievements` pref before firing confetti
- `src/app/components/celebrations/CompletionModal.tsx` — Check `achievements` pref before confetti
- `src/app/components/celebrations/ChallengeMilestoneToast.tsx` — Check `achievements` pref before confetti

### 4.2 Gate streaks (AC2)

**Files to modify:**
- `src/app/pages/Overview.tsx:242-258` — Wrap Engagement Zone with `showStreaks &&` for the StudyStreakCalendar
- `src/app/components/ProgressStats.tsx:36-38` — Conditionally render "Study Streak" StatsCard

### 4.3 Gate badges (AC2)

**Files to modify:**
- `src/app/components/figma/MomentumBadge.tsx` — Return `null` when badges are OFF
- Any other badge components that reference momentum tiers

### 4.4 Gate animations (AC2)

**Files to modify:**
- `src/app/pages/Overview.tsx:204` — Change `<MotionConfig reducedMotion="user">` to conditionally use `reducedMotion={showAnimations ? 'user' : 'always'}`
- `src/app/components/AchievementBanner.tsx` — Check `animations` pref in addition to `prefers-reduced-motion`
- `src/app/components/celebrations/StreakMilestoneToast.tsx:20-28` — Check `animations` pref before confetti
- `src/app/components/celebrations/ChallengeMilestoneToast.tsx` — Same pattern
- `src/app/components/celebrations/CompletionModal.tsx` — Same pattern

**Implementation note on confetti gating:** Confetti should be suppressed when EITHER `animations: false` OR `achievements: false` (for achievement-related confetti) or `streaks: false` (for streak milestone confetti). The rule: confetti is a celebration → requires both its parent feature AND animations to be ON.

**Commit:** `feat(E21-S05): gate engagement features based on user preferences`

---

## Task 5: E2E tests

**File to create:**
- `tests/e2e/regression/story-e21-s05.spec.ts`

**Test cases:**

1. **AC1 — Section renders with all toggles:**
   - Navigate to Settings
   - Verify "Engagement Preferences" card visible
   - Verify 4 Switch toggles present (achievements, streaks, badges, animations)
   - Verify color scheme radio group present

2. **AC2 — Toggling streaks hides streak section:**
   - Navigate to Settings, toggle Streaks OFF
   - Navigate to Overview
   - Assert StudyStreakCalendar section NOT in DOM
   - Navigate back to Settings, toggle Streaks ON
   - Navigate to Overview
   - Assert StudyStreakCalendar section IS in DOM

3. **AC2 — Toggling achievements hides banner:**
   - Toggle Achievements OFF
   - Navigate to Overview
   - Assert AchievementBanner NOT in DOM

4. **AC4 — Persistence across page reload:**
   - Toggle Streaks OFF
   - Reload the page
   - Navigate to Settings
   - Assert Streaks toggle is still OFF
   - Navigate to Overview
   - Assert streak section still hidden

5. **AC5 — Default state for new users:**
   - Clear localStorage
   - Navigate to Settings
   - Assert all 4 toggles are checked (ON)
   - Assert color scheme is "Professional"

**Test data setup:**
- Use `page.evaluate(() => localStorage.removeItem('levelup-engagement-prefs-v1'))` for clean slate tests
- Use `page.evaluate(() => localStorage.setItem(...))` for pre-configured state tests

**Commit:** `test(E21-S05): add E2E tests for engagement preference controls`

---

## Task 6: Unit tests for component

**File to create:**
- `src/app/components/settings/__tests__/EngagementPreferences.test.tsx`

**Test cases:**
- Renders all 4 toggles with correct labels
- Toggling a switch calls `setPreference` on store
- Color scheme radio group renders and changes
- Vibrant option is disabled (until E21-S04)

**Commit:** (combined with Task 3)

---

## Components Inventory (Affected by Preferences)

| Component | File | Gated by | What changes |
|-----------|------|----------|-------------|
| `AchievementBanner` | `src/app/components/AchievementBanner.tsx` | `achievements` | Conditionally rendered + confetti suppressed |
| `StudyStreakCalendar` | `src/app/components/StudyStreakCalendar.tsx` | `streaks` | Conditionally rendered in Overview |
| `StreakMilestoneToast` | `src/app/components/celebrations/StreakMilestoneToast.tsx` | `streaks` + `animations` | Confetti suppressed |
| `ChallengeMilestoneToast` | `src/app/components/celebrations/ChallengeMilestoneToast.tsx` | `achievements` + `animations` | Confetti suppressed |
| `CompletionModal` | `src/app/components/celebrations/CompletionModal.tsx` | `achievements` + `animations` | Confetti suppressed |
| `MomentumBadge` | `src/app/components/figma/MomentumBadge.tsx` | `badges` | Returns null when off |
| `ProgressStats` | `src/app/components/ProgressStats.tsx` | `streaks` | Streak stat card hidden |
| Overview `MotionConfig` | `src/app/pages/Overview.tsx:204` | `animations` | `reducedMotion="always"` when off |
| `MilestoneGallery` | `src/app/components/MilestoneGallery.tsx` | `achievements` | Conditionally rendered |

## Commit Sequence

1. `feat(E21-S05): add useEngagementPrefsStore with localStorage persistence`
2. `feat(E21-S05): add EngagementPreferences settings section`
3. `feat(E21-S05): gate engagement features based on user preferences`
4. `test(E21-S05): add E2E tests for engagement preference controls`

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| E21-S04 not yet implemented | Color scheme picker has no Vibrant option | Disable Vibrant radio with "Coming soon" label; Professional works standalone |
| Gating too aggressively hides useful info | Users lose progress visibility | Toggles are per-category, not global; streak DATA still tracked even when hidden |
| MotionConfig override breaks child animations | Unexpected layout shifts | Use `reducedMotion="always"` which gracefully degrades to instant transitions |
| localStorage quota on data-heavy devices | Preferences fail to save | Wrap in try/catch like useOnboardingStore; preferences are tiny (~100 bytes) |

## Open Questions (Resolved)

- **Q: Should "Animations OFF" also disable CSS transitions?** A: No, only motion/react and confetti. CSS `transition-*` (hover states, color changes) remain — they're functional, not decorative.
- **Q: Should we use Zustand `persist` middleware?** A: No, manual persistence like `useOnboardingStore` is simpler and gives explicit control over what's serialized.
- **Q: Where does the new section go in Settings?** A: Between Appearance and Reminders — it's a UI customization concern.
