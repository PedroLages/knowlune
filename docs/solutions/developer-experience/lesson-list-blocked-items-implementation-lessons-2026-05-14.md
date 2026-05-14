---
title: Fixing lesson list blocked items — implementation lessons
date: 2026-05-14
category: developer-experience
module: course
problem_type: developer_experience
component: development_workflow
severity: low
applies_when:
  - Removing conditional rendering that gates navigation behind file-availability checks
  - Encountering a codebase with pre-existing private copies of shared utility functions
  - Running ce:review safe_auto fixer on legacy cn() patterns
  - Deciding whether to fix a secondary issue in the same PR or defer it
tags:
  - lesson-list
  - file-status
  - techdebt
  - code-deduplication
  - safe-auto
  - review-scope
---

# Fixing Lesson List Blocked Items -- Implementation Lessons

## Context

PR #570 fixed the course detail page (`LessonList.tsx`) where lesson items with missing or permission-denied file handles were rendered as disabled, non-interactive `<div>` elements instead of navigable `<Link>` elements. The fix was straightforward in theory -- remove the `isUnavailable` ternary and always render a `<Link>` -- but the implementation surfaced several non-obvious patterns in the codebase, tech-debt cleanup opportunities, and tooling behaviors worth documenting.

## Guidance

### 1. Pattern reuse accelerates fixes

The fix's core logic -- rendering all lesson items as navigable links with file status communicated through badges rather than by disabling interaction -- already existed in two other code paths: `renderYouTubeGroups` in the same `LessonList.tsx` file, and the `LessonsTab` sidebar component. Before writing new rendering logic, check whether the pattern already exists in:

- Sibling render functions within the same component
- Co-located components that consume the same data shape
- Alternative rendering branches (e.g., the YouTube vs. local course paths)

In this case, the fix was entirely removing code (+15, -114 lines in `LessonList.tsx`) because the desired behavior was already the default in adjacent code paths.

### 2. /techdebt scan catches pre-existing duplication

The `/techdebt` deduplication scan found that `LessonList.tsx` contained byte-for-byte identical copies of four functions/types already defined in `src/lib/curriculumGrouping.ts`:

- `getFolderName` (same signature, same implementation)
- `groupByFolder` (same logic)
- `groupByChapter` (same logic)
- `ChapterGroup` type (same definition)

These were extracted into a separate chore commit that replaced the private copies with imports from `@/lib/curriculumGrouping`. The only function unique to `LessonList.tsx` was `formatFolderCount` (which formats count strings differently from the shared utilities).

**Invariant**: When you see `byte-for-byte` identical functions in the techdebt report, the replacement is safe and mechanical. When functions are similar-but-not-identical, the shared module should be extended rather than the private copy kept.

### 3. safe_auto fixer removes legacy cn() patterns

The ce:review `safe_auto` fixer flagged and removed 2 redundant `cn()` single-string-wrapper calls in `LessonList.tsx`. These were leftovers from a previous refactoring where conditional class merging was replaced with unconditional classes, but the `cn()` wrapper around the single remaining string was never cleaned up:

```typescript
// Before (legacy):
className={cn("text-muted-foreground")}

// After:
className="text-muted-foreground"
```

These are harmless but accumulate over time. The `safe_auto` fixer handles them automatically during review, so no manual cleanup is needed.

**Pattern**: After removing conditional class logic from a `cn()` call, check whether only one string argument remains. If so, the `cn()` wrapper is dead weight.

### 4. Deferring medium findings keeps PR scope clean

The code review found a secondary issue: `PdfContent` returns early without setting `fileError` when the file handle is null, resulting in a blank page instead of an actionable error UI. This was deferred to a separate plan (`docs/plans/2026-05-14-006-fix-pdf-content-null-handle-error-ui-plan.md`) because:

- The fix is in a separate component (`PdfContent.tsx`) with its own state management
- The lesson player already handles unavailable files at playback time via `LocalVideoContent` and `useVideoFromHandle`
- Fixing it would have added scope and risk to a focused, low-risk PR

The deferral criterion: if the affected file is different from the main fix's file and the existing behavior (blank page) is no worse than the user would experience by clicking a link that can't play content, deferral is safe.

## Why This Matters

These lessons compress what would take multiple discovery cycles into reusable knowledge:

- Pattern reuse across render paths saves time over writing new conditional logic
- The `/techdebt` scan is most valuable when it catches byte-for-byte copies -- those are free wins with zero risk
- `safe_auto` handles cn() cleanup automatically; knowing this prevents manual review of these patterns
- Deferring out-of-scope findings is a scope-management skill that keeps PRs reviewable and mergeable

## When to Apply

- When modifying a component that has multiple render paths for different data types (local vs. YouTube, grid vs. list)
- Before writing new utility functions, check whether they already exist as private copies in another file
- After a refactoring that simplifies conditional class logic, let `safe_auto` handle the cn() cleanup during review
- When a code review finding touches a different file and component, consider deferring to a separate PR

## Examples

**Before (blocked items):**
```typescript
const isUnavailable = status === 'missing' || status === 'permission-denied';

return isUnavailable ? (
  <div aria-disabled="true" className="opacity-50 cursor-not-allowed">
    {lesson.title}
  </div>
) : (
  <Link to={`/courses/${courseId}/lessons/${lesson.id}`}>
    {lesson.title}
  </Link>
);
```

**After (always navigable):**
```typescript
<Link to={`/courses/${courseId}/lessons/${lesson.id}`}>
  {lesson.title}
  {status === 'missing' && <FileStatusBadge status={status} />}
</Link>
```

## Related

- PR #570 — Main fix with 3 commits: the fix, techdebt extraction, safe_auto cleanup
- `docs/solutions/developer-experience/learning-track-detail-reorder-implementation-lessons-2026-05-14.md` — contemporaneous lessons from the same feature branch context
- `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md` — related pattern for extracting shared code on second consumer
- `docs/plans/2026-05-14-006-fix-pdf-content-null-handle-error-ui-plan.md` — deferred tracking for the PdfContent finding
- `src/lib/curriculumGrouping.ts` — shared module that absorbed duplicated functions
