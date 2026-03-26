# Design Review -- E23-S04: Restructure Sidebar Navigation

**Date**: 2026-03-26
**Story**: E23-S04 -- Restructure Sidebar Navigation Groups
**Reviewer**: Claude Code (design-review agent)
**Branch**: feature/e23-s04-restructure-sidebar-navigation

---

## Summary

Visual inspection at desktop (1440x900) and mobile (375x812) viewports. The sidebar correctly renders "Library" and "Study" group labels with proper IDs (`nav-group-library`, `nav-group-study`). The "Track" group is hidden by progressive disclosure (all items gated) which is expected for fresh state. Mobile bottom bar renders Overview, Courses, My Courses, and More button correctly.

## Findings

### Blockers

None from a design perspective.

### High Priority

None.

### Medium Priority

1. **Mobile bottom bar shows 3 items instead of 4**: The "Notes" item is in `primaryNavPaths` but has `disclosureKey: 'note-created'`, causing it to be filtered out for new users. The bottom bar shows 3 items + More instead of the expected 4 + More. Consider whether Notes should always be visible in the bottom bar regardless of disclosure state.

### Low Priority

1. **Group balance**: The implemented structure is 4-5-7 (Library-Study-Track), not the planned 5-4-5 (Learn-Review-Track). The Track group has 7 items which may feel heavy. Consider if some items could move to Study.

## Accessibility

- Group labels use semantic IDs (`nav-group-*`) for ARIA labelledby references
- Collapsed sidebar uses separators with `aria-hidden="true"`
- Navigation landmark uses proper `aria-label="Main navigation"`
- All links are accessible via keyboard

## Verdict

PASS with medium-priority observation about mobile bottom bar item count.
