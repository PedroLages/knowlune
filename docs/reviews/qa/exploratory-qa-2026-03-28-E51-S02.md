# Exploratory QA: E51-S02 — Reduced Motion Toggle with Global MotionConfig

**Date:** 2026-03-28
**Reviewer:** Claude Code (automated)
**Note:** Code-based analysis. Playwright MCP browser testing was not available.

## Functional Assessment

### RadioGroup in Settings
- Three options rendered: Follow system, Reduce motion, Allow all motion
- `onValueChange` correctly calls `onSettingsChange({ reduceMotion: value })`
- Active state visual feedback via `border-brand bg-brand-soft`
- Value bound to `settings.reduceMotion`

### MotionConfig Propagation
- Root-level `<MotionConfig>` wraps RouterProvider, Toaster, WelcomeWizard, PWA components, and Agentation
- All 17 local MotionConfig overrides removed — no shadowing possible
- `reducedMotion` prop correctly maps: `shouldReduceMotion ? 'always' : 'never'`

### CSS Class Toggle
- `useEffect` in App.tsx adds/removes `reduce-motion` class on `<html>`
- Cleanup function removes class on unmount
- CSS rules in `index.css` correctly target `html.reduce-motion *`

### Flash Prevention
- Script loads synchronously in `<head>` before stylesheets
- Reads `app-settings` from localStorage
- Only applies class for `reduceMotion === 'on'` (system preference users may see brief flash — see code review MEDIUM #3)

### Cross-component Consistency
- AchievementBanner, CompletionModal, StreakMilestoneToast, ChallengeMilestoneToast: all use `shouldReduceMotion()` utility
- AnimatedCounter: uses `shouldReduceMotion()` to control spring animations
- useCourseCardPreview, scroll.ts: use `shouldReduceMotion()` utility
- ImprovementChart, ScoreTrajectoryChart, QualityScoreDialog, OnboardingOverlay: MotionConfig wrappers removed (now inherits from root)

## Bugs Found

None confirmed. The implementation is consistent and follows the established pattern.

## Health Score: 85/100

- -5: Missing E2E tests for the specific feature
- -5: Flash prevention doesn't cover system preference users
- -5: No Playwright MCP visual verification available

## Verdict

**PASS with advisory notes.** Implementation is functionally sound based on code analysis. Missing E2E coverage is the primary gap.
