# Full App Audit: Custom Components

**Date**: 2026-03-26
**Scope**: `src/app/components/figma/*` (58 components), `src/app/components/Layout.tsx`, `src/app/routes.tsx`
**Reviewer**: Adversarial Senior Developer (Opus 4.6)

---

## What Works Well

1. **Consistent lazy-loading architecture in routes.tsx**. Every page component uses `React.lazy` with `SuspensePage` wrappers, and the `PageLoader` skeleton has proper ARIA (`role="status"`, `aria-busy`). Legacy redirect routes (`/instructors` -> `/authors`, `/reports/study` -> `/reports?tab=study`) are handled cleanly.

2. **Layout.tsx accessibility is strong.** Skip-to-content link, `aria-current="page"` on nav items, `aria-label` on sidebar groups, proper ARIA for keyboard shortcuts dialog, 44px minimum touch targets on header buttons, and `role="search"` on the search region. The grouped navigation with `aria-labelledby` is well-structured.

3. **Component prop typing is generally solid.** CourseCard, FlashcardReviewCard, EditableTitle, PomodoroTimer all have explicit TypeScript interfaces. The FlashcardReviewCard's 3D flip uses `MotionConfig reducedMotion="user"` and provides screen-reader announcements.

---

## Findings

### Blockers

None.

### High Priority

- **[Recurring] Hardcoded Tailwind colors across 10+ figma components (confidence: 95)**
  - `CourseCard.tsx:36-40` — `categoryColors` uses `bg-emerald-100 text-emerald-700`, `bg-amber-100 text-amber-700`, `bg-red-100 text-red-700`, `bg-purple-100 text-purple-700`
  - `CourseCard.tsx:431` — `bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50` (thumbnail fallback gradient)
  - `CourseCard.tsx:621-623` — `bg-green-100 text-green-900`, `bg-amber-100 text-amber-900` (difficulty badges)
  - `CourseCard.tsx:717` — `border-green-200 dark:border-green-800` (completed card border)
  - `StatusIndicator.tsx:22,26` — `text-blue-600`, `text-green-600`
  - `StatusSelector.tsx:26,32` — `text-blue-600`, `text-green-600`
  - `ImportedCourseCard.tsx:74,79,84` — `bg-blue-100 text-blue-700`, `bg-green-100 text-green-700`, `bg-gray-100 text-gray-400`
  - `TranscriptPanel.tsx:119` — `bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-600`
  - `ChapterProgressBar.tsx:111` — `bg-yellow-400 border-yellow-600`
  - `VideoPlayer.tsx:1239` — `bg-yellow-500/30 text-yellow-300`
  - `PdfThumbnailSidebar.tsx:62,82` — `border-blue-600`, `text-blue-600`

  **Why**: These colors bypass the theme system entirely. In dark mode or vibrant mode, they produce inconsistent visual treatment. The ESLint rule `design-tokens/no-hardcoded-colors` should catch these, suggesting either the rule has exemptions or these predate the rule.
  **Fix**: Map to theme tokens. For status colors: `text-blue-600` -> `text-brand` or define `--status-in-progress` / `--status-completed` tokens. For category badges: define category-specific tokens or use existing brand/success/warning/destructive tokens. For gradients: `from-blue-50 to-indigo-100` -> use `bg-surface-sunken` or define a `--thumbnail-fallback` token.

- **Layout.tsx:250-258, 262-270 — `JSON.parse` on localStorage without try/catch (confidence: 92)**
  Corrupted localStorage values (e.g., user manually edits, browser extension interference) will throw `SyntaxError` and crash the entire layout, making the app unusable.
  ```typescript
  const saved = localStorage.getItem('knowlune-sidebar-v1')
  return saved !== null ? JSON.parse(saved) : true  // Throws if saved is "undefined" or malformed
  ```
  **Why**: Layout.tsx wraps ALL routes. A crash here renders the entire app blank.
  **Fix**: Wrap in try/catch with fallback:
  ```typescript
  try { return saved !== null ? JSON.parse(saved) : true }
  catch { return true }
  ```

- **[Recurring] String interpolation for className instead of `cn()` across 11 files, 21+ instances (confidence: 90)**
  - `Layout.tsx:73-79` (NavLink) — template literal for active/inactive/iconOnly classes
  - `Layout.tsx:363` (sidebar aside) — template literal for collapsed/expanded width
  - `Layout.tsx:374-376` (sidebar toggle) — template literal for hover visibility
  - `CourseCard.tsx:180,294,417,431,619` — template literals for conditional classes
  - `ProgressRing.tsx:19` — template literal for className merge
  - `ImageWithFallback.tsx:17` — template literal for className merge
  - `NotificationCenter.tsx:221` — template literal for icon color

  **Why**: Template literals (`\`${a} ${b}\``) don't handle falsy values gracefully (produces `"false"` or `"undefined"` in class strings) and don't merge conflicting Tailwind utilities. `cn()` from `@/app/components/ui/utils` handles both.
  **Fix**: Replace all template literal className patterns with `cn()`. Example for NavLink:
  ```typescript
  className={cn(
    'flex items-center rounded-xl transition-colors duration-150',
    iconOnly ? 'justify-center py-2.5 mx-2' : 'gap-3 px-4 py-2.5',
    isActive
      ? 'bg-brand-soft text-brand-soft-foreground font-medium'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
  )}
  ```

- **[Recurring] `h-* w-*` instead of Tailwind v4 `size-*` shorthand in PomodoroTimer.tsx (confidence: 85)**
  - `PomodoroTimer.tsx:93,137,150,161,173,185,195,219,245,265,288,308` — 12 instances of `h-4 w-4`, `h-3 w-3`, `h-6 w-6`
  - `PdfToolbar.tsx:189,220,241,285,297,309,400,489,503` — 9 instances of `h-11 w-11 sm:h-8 sm:w-8`

  **Why**: Tailwind v4 `size-*` is the canonical shorthand. Using `h-* w-*` bloats the class string and misses the intent of equal dimensions.
  **Fix**: Replace `h-4 w-4` with `size-4`, `h-6 w-6` with `size-6`, etc.

### Medium

- **ProgressRing.tsx — Missing accessible text for screen readers (confidence: 80)**
  The SVG is `aria-hidden="true"` and the percentage text is a `<span>` inside the component, but the whole component has no accessible role or label. When used inside CourseCard thumbnail overlays, screen readers see no meaningful content.
  **Fix**: Add `role="img"` and `aria-label` to the wrapper div:
  ```typescript
  <div role="img" aria-label={`${percent}% complete`} className={...}>
  ```

- **CourseCard.tsx — Component is 784 lines with 3 render variants (confidence: 82)**
  The `library`, `overview`, and `progress` variants share some logic but have significantly different rendering. The file defines 7 internal functions (`renderThumbnailOverlays`, `renderInfoButton`, `renderThumbnail`, `renderBody`, plus helpers). This makes the component difficult to test in isolation and hard to modify one variant without risk to others.
  **Why**: A learner-facing change to the "progress" card view requires reading through 400+ lines of unrelated variant code.
  **Fix**: Extract each variant into its own component (`CourseCardLibrary`, `CourseCardOverview`, `CourseCardProgress`) that share a `CourseCardShell` wrapper and common hooks via a shared `useCourseCardData()` hook.

- **NotificationCenter.tsx:67-121 — Mock data hardcoded in production component (confidence: 88)**
  The `createMockNotifications()` function creates fake notification data with `Date.now()`-relative timestamps. There is a `TODO(notifications)` comment at line 67. This means every user always sees the same 6 fake notifications that never update, creating a misleading UX.
  **Why**: Learners see "Achievement Unlocked!" and "7-Day Streak!" notifications that are fabricated, eroding trust in the notification system.
  **Fix**: Either connect to a real notification store (Zustand + Dexie) or show an empty state until notifications are implemented. At minimum, feature-flag the mock data.

- **VideoPlayer.tsx and StatusIndicator.tsx — Still using `forwardRef` (confidence: 78)**
  React 19 (which this project uses per CLAUDE.md: "React 19.2.4") passes `ref` as a regular prop, making `forwardRef` unnecessary. While `forwardRef` still works, it adds unnecessary complexity and is deprecated in React 19.
  **Fix**: Convert to regular function components that accept `ref` as a prop:
  ```typescript
  export function StatusIndicator({ status, ref, ...rest }: StatusIndicatorProps & { ref?: React.Ref<...> }) {
  ```

- **Layout.tsx:206-208 — `loadCourses()` is fire-and-forget without error handling (confidence: 78)**
  ```typescript
  useEffect(() => {
    loadCourses()
  }, [loadCourses])
  ```
  If IndexedDB is corrupted or unavailable, this silently fails. The user sees no courses and has no indication why.
  **Fix**: Add error handling:
  ```typescript
  useEffect(() => {
    loadCourses().catch(() => {
      toast.error('Failed to load courses. Try refreshing the page.')
    })
  }, [loadCourses])
  ```

- **CourseCard.tsx:431 — Hardcoded gradient fallback ignores dark mode token system (confidence: 82)**
  ```
  bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50
  ```
  This manually specifies both light and dark variants using raw Tailwind colors. Any change to the theme (vibrant mode, custom themes) won't affect this gradient.
  **Fix**: Use `bg-surface-sunken` or `bg-muted` for the fallback, which already responds to theme changes.

- **CourseCard.tsx:46-68 — `formatRelativeTime` utility duplicated (confidence: 75)**
  `CourseCard.tsx` defines `formatRelativeTime` (lines 45-69) and `NotificationCenter.tsx` defines `relativeTime` (lines 51-64). Both do the same thing with slightly different thresholds. This is a recurring pattern flagged since E02-S08 for `formatTimestamp`.
  **Fix**: Consolidate into `src/lib/format.ts` (which already exports `formatTimestamp`).

### Nits

- **Nit** `Layout.tsx:489` (confidence: 72): Avatar fallback has `hover:text-white` — hardcoded color instead of `hover:text-brand-foreground`.

- **Nit** `PomodoroTimer.tsx:210-219` (confidence: 70): The preferences toggle button has no minimum touch target. The button renders as a text link with `py-1` padding, likely under 44px on mobile.

- **Nit** `routes.tsx:456-464` (confidence: 70): Commented-out `WebLLMPerformanceTest` route has been disabled for an unspecified duration. Consider removing it entirely or adding a date to the comment for future cleanup.

- **Nit** `EngagementDecayAlert.tsx:62` (confidence: 70): Uses emoji `💡` with `aria-hidden="true"`, which is correct, but the emoji renders inconsistently across platforms. Consider using a Lucide icon (`Lightbulb`) for consistency.

- **Nit** `ImageWithFallback.tsx:21` (confidence: 72): Error fallback exposes `data-original-url={src}` as an attribute, leaking the original URL into the DOM. This is harmless but may expose internal asset paths.

---

## Recommendations

**Fix order by impact:**

1. **JSON.parse crash protection in Layout.tsx** (High, 5 min fix) — This is the only finding that can crash the entire app.
2. **Hardcoded Tailwind colors** (High, 1-2 hours) — Start with StatusIndicator and StatusSelector (4 instances, simple swap), then CourseCard category colors, then ImportedCourseCard.
3. **String interpolation -> cn()** (High, 30 min) — Mechanical replacement across 11 files. Start with Layout.tsx NavLink since it's rendered on every page.
4. **NotificationCenter mock data** (Medium) — Either connect to real data or show empty state.
5. **h-* w-* -> size-*** (Medium, 15 min) — Mechanical replacement in PomodoroTimer and PdfToolbar.
6. **ProgressRing accessibility** (Medium, 5 min fix).
7. **CourseCard decomposition** (Medium, larger refactor) — Plan for a future story.
8. **forwardRef migration** (Medium, 10 min) — Two files to update.

---

Issues found: **15** | Blockers: **0** | High: **4** | Medium: **7** | Nits: **4**
Confidence: avg **82** | >= 90: **3** | 70-89: **12** | < 70: **0**
