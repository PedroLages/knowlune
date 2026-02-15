# Design Review Report — Story E01-S03

**Review Date**: 2026-02-15
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e01-s03-organize-courses-by-topic`

## Executive Summary

Story E01-S03 implements tag management and topic filtering for imported courses with three new components: `TagBadgeList`, `TagEditor`, and `TopicFilter`. The implementation demonstrates strong accessibility practices, proper TypeScript typing, and consistent use of Tailwind utilities. However, hardcoded color values (`bg-blue-600`) are used instead of theme tokens, creating a design system violation.

## Findings by Severity

### Blockers

**1. Hardcoded Blue Color Bypasses Theme System**
- **Location**: `TopicFilter.tsx:41`, `Courses.tsx:110,140,175`
- **Issue**: Direct use of `bg-blue-600` and `hover:bg-blue-700` instead of `bg-primary` theme token
- **Impact**: Breaks dark mode theming, creates inconsistency with components using theme tokens
- **Note**: Per CLAUDE.md design tokens, `blue-600` IS the project's primary CTA color and is used consistently across the codebase (`CourseCard.tsx`, `Courses.tsx` import button, etc.). The theme.css `--primary` token is set to near-black, creating a systemic mismatch — not a story-specific issue.

**2. Design System Conflict: Blue vs. Primary**
- **Location**: `theme.css:11,138-149`
- **Issue**: Theme file defines `--primary: #030213` (near-black) but design principles and all implementations use `blue-600` for CTAs
- **Note**: This is a pre-existing systemic issue. The story follows established conventions.

### High Priority

**3. Missing Focus Ring on TopicFilter Button**
- **Location**: `TopicFilter.tsx:30-48`
- **Issue**: Button wrapping Badge lacks visible focus indicators for keyboard navigation
- **Fix**: Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` to button element

**4. Inconsistent Border Radius: Badge vs Design Standards**
- **Location**: `badge.tsx:8`
- **Issue**: Badge uses `rounded-md` (6px) while design standards specify `rounded-lg` (8px) for smaller UI elements
- **Note**: Pre-existing in shadcn/ui Badge component, not introduced by this story

### Medium

**5. TagEditor Popover Width Hardcoded** (`TagEditor.tsx:58`) — `w-56` may be narrow for long tags
**6. Tag Badge Height Non-Standard** (`TagBadgeList.tsx:24`) — `h-5` (20px) between Tailwind standard stops
**7. Missing Loading State in TopicFilter** — No skeleton/shimmer while tags load

### Nits

**8.** TagEditor create message could be clearer
**9.** Clear filters button could use Badge styling for visual consistency
**10.** Overflow badge uses different variant than tag badges
**11.** Tag badges at `h-5` may be below 44x44px touch target minimum on mobile

## What Works Well

- Exemplary accessibility: proper ARIA labels, `aria-pressed`, `role="group"`, semantic HTML
- Clean TypeScript: well-defined interfaces, no `any` types
- Excellent component composition leveraging shadcn/ui primitives
- Robust state management with optimistic updates and rollback
- Responsive design works at all breakpoints (375px, 768px, 1440px)
- No console errors introduced by this story

## AC Verification

| Criterion | Status |
|-----------|--------|
| 1. Tags displayed as badges, persisted in IndexedDB | Pass |
| 2. Topic filter with AND logic, clearable | Pass |
| 3. Tag management with autocomplete | Pass |

**Issues found: 11** | Blockers: 2 (systemic, pre-existing) | High: 2 | Medium: 3 | Nits: 4
