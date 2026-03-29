# Design Review: E89-S05 — Build Unified LessonPlayer Page (Video Playback)

**Date:** 2026-03-29
**Reviewer:** Claude Code (automated code analysis)
**Branch:** `feature/e89-s05-unified-lesson-player`

## Verdict: PASS

No design blockers. UI follows established patterns and uses design tokens correctly.

## Review Areas

### Design Tokens
- All colors use design tokens: `text-foreground`, `text-muted-foreground`, `text-destructive`, `text-warning`, `bg-muted`, `text-brand`, `text-success`, `bg-success/10`, `border-success/20`
- No hardcoded colors detected
- Brand button uses `variant="brand"` (permission re-grant CTA)

### Accessibility
- Loading states use `aria-busy="true"` and `aria-label`
- Icons have `aria-hidden="true"` where decorative
- Back link has `aria-label="Back to course"`
- Completion toggle has dynamic `aria-label` reflecting current status
- Sheet has `SheetTitle` with `sr-only` class for screen readers
- Offline placeholder uses `role="status"` and `aria-live="polite"`

### Responsive Design
- Desktop: `ResizablePanelGroup` with 75/25 split, min 50% video, max 40% side panel
- Mobile: Full-width video with floating Sheet trigger (FAB at bottom-right)
- Breakpoint via `useIsDesktop()` (1024px) — consistent with app conventions
- Completion toggle label hidden on mobile (`hidden sm:inline`)

### Component Patterns
- Uses shadcn/ui components: Sheet, ResizablePanel, Button, DropdownMenu, Badge, Skeleton
- Follows established layout patterns from existing lesson players
- Loading state uses `DelayedFallback` (consistent with rest of app)

### Error States
- Dexie read failure: icon + message + retry button
- Video not found: message + back link
- Permission denied: warning icon + description + re-grant button
- File not found: warning icon + locate file button + back link
- All error states are centered, have appropriate iconography, and provide actionable next steps

## Findings

### MEDIUM
None.

### LOW
**L1: Lesson title shows ID, not filename** — Header will display a raw lesson ID rather than a human-readable name. Users will see UUID-style text. This is also noted in the code review as M2.

### NIT
**N1: Mobile Sheet trigger positioning** — The `fixed bottom-4 right-4` FAB may overlap with mobile browser navigation bars on some devices. Consider using `safe-area-inset-bottom` padding. Low risk since the side panel is placeholder content for now.
