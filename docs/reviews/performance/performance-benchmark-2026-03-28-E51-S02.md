# Performance Benchmark: E51-S02 — Reduced Motion Toggle with Global MotionConfig

**Date:** 2026-03-28
**Reviewer:** Claude Code (automated)

## Bundle Analysis

- Build completed in 21.14s
- No new dependencies added (motion/react already installed)
- New file: `public/reduce-motion-init.js` (11 lines, ~200 bytes) — negligible impact
- New file: `src/hooks/useReducedMotion.ts` (60 lines) — minimal bundle contribution
- New utility: `shouldReduceMotion()` added to existing `settings.ts` — no additional chunk

## Impact Assessment

### Positive
- Removing 17 local `MotionConfig` wrappers reduces component tree depth slightly
- Consolidating motion queries to a single hook reduces redundant `matchMedia` listeners

### Neutral
- Root-level `MotionConfig` in App.tsx adds one React context provider to the tree — negligible overhead
- `useReducedMotion` hook creates 2 event listeners (`settingsUpdated`, `storage`) and 1 MediaQueryList listener — standard pattern

### Concerns

**MEDIUM: `shouldReduceMotion()` reads localStorage on every call**
The utility function calls `getSettings()` which parses `localStorage.getItem('app-settings')` and `JSON.parse()` on every invocation. In `useCourseCardPreview.ts` this is called on every render. For hot paths, consider caching the result.

## Page Metrics

Note: Playwright MCP was not available for real browser metrics collection. Based on code analysis:
- No new network requests
- No new lazy-loaded chunks
- Flash prevention script is synchronous but tiny (~200 bytes, no network fetch needed as it's cached)

## Verdict

**PASS — No performance regressions detected.** The `shouldReduceMotion()` render-frequency concern is shared with the code review (HIGH #1).
