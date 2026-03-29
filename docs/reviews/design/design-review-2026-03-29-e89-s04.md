# Design Review — E89-S04 Build Unified CourseDetail Page (2026-03-29)

## Summary

Visual and accessibility review of the unified course detail page. Tested error state (course not found), loading skeleton, and component structure via browser and code analysis.

## Findings

### Accessibility (WCAG 2.1 AA)

- **PASS**: `role="status"` on loading skeleton with `aria-busy="true"` and `aria-label="Loading course"`
- **PASS**: `role="alert"` on load error banner
- **PASS**: All decorative icons have `aria-hidden="true"`
- **PASS**: Search input has `aria-label="Filter course content by filename"`
- **PASS**: Progress bars have `aria-label` with percentage
- **PASS**: Disabled items use `aria-disabled="true"` and `cursor-not-allowed`
- **PASS**: "Skip to content" link present in layout
- **PASS**: Offline banner uses `aria-live="polite"` for dynamic announcements

### Design Token Compliance

- **PASS**: Zero hardcoded colors detected in all 4 new components + page
- **PASS**: Uses `text-brand`, `bg-brand-soft`, `text-brand-soft-foreground`, `text-destructive`, `bg-destructive/10`, `text-warning`, `bg-warning/10`, `text-muted-foreground`, `bg-card`, `bg-accent` appropriately
- **PASS**: Brand badge uses correct `text-brand-soft-foreground` on `bg-brand-soft` (WCAG contrast)

### Responsive Design

- **PASS**: `max-w-3xl mx-auto` container constrains width appropriately
- **PASS**: `flex-wrap` on metadata and content items handles narrow viewports
- **PASS**: Refresh button text hidden on mobile (`hidden sm:inline`)
- **PASS**: Course thumbnail uses fixed width (`w-32 h-20`) with `shrink-0`

### MEDIUM

**1. Limited responsive breakpoints**

Only one `sm:` breakpoint used across all 4 components. The header layout (thumbnail + title + actions in a row) may become cramped on very narrow mobile viewports (<375px). Consider `flex-col` on small screens for the header section.

### LOW

**2. Error state missing back navigation**

The "Course not found" error state (lines 228-236) lacks a "Back to Courses" link. Users who land on an invalid course URL have no obvious way to navigate back except the sidebar.

## Verdict

No blockers. 1 MEDIUM (mobile layout), 1 LOW (error state navigation). Accessibility is excellent.
