---
story_id: E51-S02
story_name: "Reduced Motion Toggle with Global MotionConfig"
status: in-progress
started: 2026-03-28
completed:
reviewed: in-progress
review_started: 2026-03-28
review_gates_passed: []
burn_in_validated: false
---

# Story 51.2: Reduced Motion Toggle with Global MotionConfig

## Story

As a learner with vestibular sensitivity,
I want to control whether animations play regardless of my OS setting,
so that I can use Knowlune comfortably without triggering motion sickness.

## Acceptance Criteria

**Given** a user with OS reduced-motion OFF and app setting "Follow system"
**When** they view any page
**Then** all CSS and Framer Motion animations play normally

**Given** a user with OS reduced-motion ON and app setting "Follow system"
**When** they view any page
**Then** all CSS and Framer Motion animations are suppressed

**Given** a user with app setting "Reduce motion"
**When** they view any page regardless of OS setting
**Then** `<html>` has class `.reduce-motion` and MotionConfig is set to `always` (reduce)
**And** all CSS and Framer Motion animations are suppressed

**Given** a user with app setting "Allow all motion"
**When** they view any page regardless of OS setting
**Then** no `.reduce-motion` class exists and MotionConfig is set to `never`
**And** all animations play normally

**Given** the motion RadioGroup in the Display & Accessibility section
**When** user selects "Reduce motion"
**Then** the setting persists to localStorage and applies instantly without page reload

**Given** a page reload with a saved motion preference
**When** the app initializes
**Then** the saved motion preference is read and applied before first paint (no flash of animations)

## Tasks / Subtasks

- [ ] Task 1: Create `useReducedMotion` hook (AC: 1, 2, 3, 4, 6)
  - [ ] 1.1 Create `src/hooks/useReducedMotion.ts`
  - [ ] 1.2 Read `reduceMotion` from `getSettings()` on mount
  - [ ] 1.3 Listen for `settingsUpdated` and `storage` events (follow `useColorScheme.ts` pattern)
  - [ ] 1.4 If `'system'`: read `window.matchMedia('(prefers-reduced-motion: reduce)')` and listen for changes
  - [ ] 1.5 If `'on'`: return `shouldReduceMotion: true`
  - [ ] 1.6 If `'off'`: return `shouldReduceMotion: false`
  - [ ] 1.7 Return `{ shouldReduceMotion: boolean, preference: 'system' | 'on' | 'off' }`
  - [ ] 1.8 Handle SSR safety (`typeof window` check)
  - [ ] 1.9 Clean up all event listeners on unmount

- [ ] Task 2: Add `.reduce-motion` CSS rules (AC: 3)
  - [ ] 2.1 Open `src/styles/index.css`
  - [ ] 2.2 Add class-based rules immediately after the existing `@media (prefers-reduced-motion: reduce)` block (after line ~320):
    ```css
    html.reduce-motion *,
    html.reduce-motion *::before,
    html.reduce-motion *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }

    html.reduce-motion .reduced-motion-fade {
      transition: opacity 300ms ease !important;
    }
    ```

- [ ] Task 3: Wire `useReducedMotion` into App.tsx (AC: 1, 2, 3, 4, 6)
  - [ ] 3.1 Import `useReducedMotion` from `@/hooks/useReducedMotion`
  - [ ] 3.2 Import `MotionConfig` from `motion/react`
  - [ ] 3.3 Call `const { shouldReduceMotion } = useReducedMotion()` in App component
  - [ ] 3.4 Add useEffect that toggles `.reduce-motion` class on `document.documentElement` based on `shouldReduceMotion`
  - [ ] 3.5 Wrap `<RouterProvider>`, `<Toaster>`, AND `<WelcomeWizard>` in `<MotionConfig reducedMotion={shouldReduceMotion ? 'always' : 'never'}>` — MotionConfig must cover ALL animated siblings, not just RouterProvider (Edge case review HIGH #6)
  - [ ] 3.6 Place MotionConfig inside ThemeProvider but wrapping ALL children

- [ ] Task 5: Remove local MotionConfig overrides across codebase (AC: 3, 4)
  - [ ] 5.1 Search for all `MotionConfig reducedMotion="user"` instances — there are 17 across the codebase that will shadow the root-level config (Edge case review HIGH #1)
  - [ ] 5.2 Remove each local `MotionConfig` wrapper, leaving only the root-level one in App.tsx
  - [ ] 5.3 If any component needs a specific motion behavior, use `useReducedMotion()` hook directly instead

- [ ] Task 6: Update confetti/canvas components to respect app setting (AC: 3)
  - [ ] 6.1 Find 5 confetti/canvas components that check `window.matchMedia('(prefers-reduced-motion: reduce)')` directly instead of the app-level setting (Edge case review HIGH #2)
  - [ ] 6.2 Replace OS media query check with `useReducedMotion()` hook's `shouldReduceMotion` value
  - [ ] 6.3 When `shouldReduceMotion` is true, skip confetti/canvas animations entirely

- [ ] Task 7: Add blocking script in index.html for flash prevention (AC: 6)
  - [ ] 7.1 Add inline `<script>` in `index.html` `<head>` BEFORE any stylesheet links
  - [ ] 7.2 Script reads `reduceMotion` from localStorage settings, applies `.reduce-motion` class to `<html>` synchronously
  - [ ] 7.3 This prevents the 50-200ms flash of animations before React hydrates (Edge case review HIGH #3)
  - [ ] 7.4 Pattern: `try { const s = JSON.parse(localStorage.getItem('knowlune-settings')); if (s?.reduceMotion === 'on') document.documentElement.classList.add('reduce-motion'); } catch {}`

- [ ] Task 8: Resolve conflict with existing "animations" toggle (AC: 3)
  - [ ] 8.1 Review the existing "animations" toggle in Engagement Preferences section of Settings
  - [ ] 8.2 Decide: either remove the old toggle (replace with new 3-state motion control) or wire it to delegate to the new `reduceMotion` setting (Edge case review HIGH #5)
  - [ ] 8.3 Add implementation note in code explaining the consolidation

- [ ] Task 4: Add motion RadioGroup to DisplayAccessibilitySection (AC: 5)
  - [ ] 4.1 Open `src/app/components/settings/DisplayAccessibilitySection.tsx`
  - [ ] 4.2 Replace the Motion subsection placeholder with a RadioGroup
  - [ ] 4.3 Three options with bordered card styling:
    - `system`: "Follow system" -- "Uses your device's motion preference"
    - `on`: "Reduce motion" -- "Minimize animations and transitions"
    - `off`: "Allow all motion" -- "Enable all animations regardless of system setting"
  - [ ] 4.4 Style: Same bordered card pattern as AgeRangeSection radio items (`border-2 rounded-xl`, active: `border-brand bg-brand-soft`)
  - [ ] 4.5 Set `aria-label="Motion preference"` on the RadioGroup
  - [ ] 4.6 On change: call `onSettingsChange({ reduceMotion: value })`

## Design Guidance

- **RadioGroup pattern:** Match AgeRangeSection radio items at `src/app/pages/Settings.tsx:85-150`
- **Radio card styling:** `border-2 rounded-xl p-4 cursor-pointer transition-colors` + active: `border-brand bg-brand-soft`
- **Option layout:** Radio dot on left, label + description stacked on right
- **Label typography:** `text-sm font-medium`
- **Description typography:** `text-xs text-muted-foreground`
- **All colors must use design tokens** -- no hardcoded Tailwind colors

## Implementation Notes

- **Hook pattern:** Follow `src/hooks/useColorScheme.ts` exactly for event listener setup/cleanup and `getSettings()` reading
- **Existing reduced-motion CSS:** `src/styles/index.css:306-320` has `@media (prefers-reduced-motion: reduce)` rules. The new `.reduce-motion` class mirrors these for manual override.
- **MotionConfig propagation:** Root-level `<MotionConfig>` propagates to all child Framer Motion components. Components with local `MotionConfig reducedMotion="user"` (e.g., `Flashcards.tsx:303`) may need their local override removed so the root takes effect.
- **Files modified:** `src/hooks/useReducedMotion.ts` (new), `src/styles/index.css`, `src/app/App.tsx`, `src/app/components/settings/DisplayAccessibilitySection.tsx`
- **No new dependencies required** -- `motion/react` (Framer Motion) is already installed

## Testing Notes

- **Unit tests (Vitest):**
  - `useReducedMotion`: test all 3 states (system/on/off)
  - `useReducedMotion`: test OS media query interaction when `'system'` is selected
  - `useReducedMotion`: test event listener cleanup on unmount
  - `useReducedMotion`: test `settingsUpdated` event triggers re-read
- **E2E tests (Playwright):** `tests/e51-s02-reduced-motion.spec.ts`
  - Select "Reduce motion" -> verify `.reduce-motion` class on `<html>`
  - Select "Allow all motion" -> verify no `.reduce-motion` class
  - Select "Follow system" -> verify behavior matches stubbed `matchMedia`
  - Reload page -> verify saved preference re-applied
  - Verify RadioGroup keyboard navigation (arrow keys)
- **matchMedia stub:** Use `src/test/setup.ts` pattern for stubbing `window.matchMedia` in unit tests

## Dependencies

- **Depends on:** E51-S01 (AppSettings fields + DisplayAccessibilitySection shell)
- **Can parallel with:** E51-S03, E51-S04

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
